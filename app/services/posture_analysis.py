"""
Posture analysis service using MediaPipe Pose Landmarker (Task API).

Pipeline per image:
  1. Decode bytes → MediaPipe Image
  2. Run PoseLandmarker → 33 landmarks (normalized 0..1)
  3. Calculate angles and asymmetries
  4. Score 0–100 with penalty deductions
"""

from __future__ import annotations

import math
import os
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import mediapipe as mp
import numpy as np
from mediapipe.tasks.python import BaseOptions
from mediapipe.tasks.python.vision import (
    PoseLandmark,
    PoseLandmarker,
    PoseLandmarkerOptions,
    RunningMode,
)

# ─── Model path ─────────────────────────────────────────────────────

_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
_MODEL_PATH = str(_PROJECT_ROOT / "data" / "models" / "pose_landmarker_heavy.task")

# ─── Landmark indices ───────────────────────────────────────────────

IDX_NOSE = PoseLandmark.NOSE
IDX_LEFT_EAR = PoseLandmark.LEFT_EAR
IDX_RIGHT_EAR = PoseLandmark.RIGHT_EAR
IDX_LEFT_SHOULDER = PoseLandmark.LEFT_SHOULDER
IDX_RIGHT_SHOULDER = PoseLandmark.RIGHT_SHOULDER
IDX_LEFT_HIP = PoseLandmark.LEFT_HIP
IDX_RIGHT_HIP = PoseLandmark.RIGHT_HIP
IDX_LEFT_KNEE = PoseLandmark.LEFT_KNEE
IDX_RIGHT_KNEE = PoseLandmark.RIGHT_KNEE
IDX_LEFT_ANKLE = PoseLandmark.LEFT_ANKLE
IDX_RIGHT_ANKLE = PoseLandmark.RIGHT_ANKLE

REQUIRED_INDICES = [
    IDX_NOSE,
    IDX_LEFT_SHOULDER, IDX_RIGHT_SHOULDER,
    IDX_LEFT_HIP, IDX_RIGHT_HIP,
    IDX_LEFT_KNEE, IDX_RIGHT_KNEE,
]

MIN_VISIBILITY = 0.5


# ─── Data classes ───────────────────────────────────────────────────

@dataclass
class PostureIssue:
    code: str
    label: str
    severity: str
    value: float
    threshold: float
    penalty: int


@dataclass
class AnglesMeasured:
    head_tilt_deg: Optional[float] = None
    shoulder_tilt_deg: Optional[float] = None
    hip_tilt_deg: Optional[float] = None
    forward_head_offset: Optional[float] = None
    knee_alignment_deg: Optional[float] = None
    spine_lateral_deg: Optional[float] = None


@dataclass
class ViewResult:
    view: str
    detected: bool = False
    landmark_count: int = 0
    avg_visibility: float = 0.0
    angles: AnglesMeasured = field(default_factory=AnglesMeasured)
    issues: list[PostureIssue] = field(default_factory=list)
    processing_ms: float = 0.0


@dataclass
class PostureAnalysisResult:
    score: int = 100
    confidence: str = "low"
    issues: list[dict] = field(default_factory=list)
    angles: dict = field(default_factory=dict)
    message: str = ""
    views: dict = field(default_factory=dict)
    processing_ms: float = 0.0


# ─── Singleton landmarker ───────────────────────────────────────────

_landmarker: PoseLandmarker | None = None


def _get_landmarker() -> PoseLandmarker:
    global _landmarker
    if _landmarker is None:
        if not os.path.exists(_MODEL_PATH):
            raise FileNotFoundError(
                f"Pose model not found at {_MODEL_PATH}. "
                "Download pose_landmarker_heavy.task from Google."
            )
        options = PoseLandmarkerOptions(
            base_options=BaseOptions(model_asset_path=_MODEL_PATH),
            running_mode=RunningMode.IMAGE,
            num_poses=1,
            min_pose_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        )
        _landmarker = PoseLandmarker.create_from_options(options)
    return _landmarker


# ─── Geometry helpers ───────────────────────────────────────────────

def _r(v: float, precision: int = 2) -> float:
    return round(v, precision)


def _tilt_deg(a, b) -> float:
    """Tilt angle between two landmarks (0 = perfectly level)."""
    dy = b.y - a.y
    dx = b.x - a.x
    return _r(math.degrees(math.atan2(dy, dx + 1e-9)))


def _vis_ok(lm) -> bool:
    return lm.visibility >= MIN_VISIBILITY


# ─── Issue checker ──────────────────────────────────────────────────

def _check_issue(
    issues: list[PostureIssue],
    code: str,
    label: str,
    value: float,
    mild: float,
    moderate: float,
    severe: float,
    pen_mild: int,
    pen_mod: int,
    pen_sev: int,
) -> None:
    if value >= severe:
        issues.append(PostureIssue(code, label, "severe", _r(value), severe, pen_sev))
    elif value >= moderate:
        issues.append(PostureIssue(code, label, "moderate", _r(value), moderate, pen_mod))
    elif value >= mild:
        issues.append(PostureIssue(code, label, "mild", _r(value), mild, pen_mild))


# ─── Core analysis per view ─────────────────────────────────────────

def _process_single_image(image_bytes: bytes, view: str) -> ViewResult:
    t0 = time.perf_counter()
    result = ViewResult(view=view)

    # Decode to MediaPipe Image via numpy
    arr = np.frombuffer(image_bytes, dtype=np.uint8)

    # Use OpenCV to decode, then wrap as MediaPipe Image
    import cv2
    bgr = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if bgr is None:
        result.processing_ms = _r((time.perf_counter() - t0) * 1000, 1)
        return result

    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)

    landmarker = _get_landmarker()
    detection = landmarker.detect(mp_image)

    if not detection.pose_landmarks or not detection.pose_landmarks[0]:
        result.processing_ms = _r((time.perf_counter() - t0) * 1000, 1)
        return result

    lms = detection.pose_landmarks[0]
    result.detected = True
    result.landmark_count = len(lms)

    # Average visibility of required landmarks
    vis_values = [lms[int(i)].visibility for i in REQUIRED_INDICES]
    result.avg_visibility = _r(sum(vis_values) / len(vis_values), 3)

    # ── Measure angles ──────────────────────────────────────────────
    angles = AnglesMeasured()
    issues: list[PostureIssue] = []

    ls = lms[int(IDX_LEFT_SHOULDER)]
    rs = lms[int(IDX_RIGHT_SHOULDER)]
    lh = lms[int(IDX_LEFT_HIP)]
    rh = lms[int(IDX_RIGHT_HIP)]
    le = lms[int(IDX_LEFT_EAR)]
    re = lms[int(IDX_RIGHT_EAR)]
    lk = lms[int(IDX_LEFT_KNEE)]
    rk = lms[int(IDX_RIGHT_KNEE)]

    if view in ("front", "back"):
        # HEAD TILT
        if _vis_ok(le) and _vis_ok(re):
            raw = _tilt_deg(re, le)
            angles.head_tilt_deg = _r(abs(raw))
            _check_issue(issues, "head_tilt", "Baş Eğikliği", abs(raw),
                         mild=3.0, moderate=6.0, severe=10.0,
                         pen_mild=5, pen_mod=12, pen_sev=20)

        # SHOULDER TILT
        if _vis_ok(ls) and _vis_ok(rs):
            raw = _tilt_deg(rs, ls)
            angles.shoulder_tilt_deg = _r(abs(raw))
            _check_issue(issues, "shoulder_tilt", "Omuz Asimetrisi", abs(raw),
                         mild=2.5, moderate=5.0, severe=9.0,
                         pen_mild=5, pen_mod=12, pen_sev=22)

        # HIP TILT
        if _vis_ok(lh) and _vis_ok(rh):
            raw = _tilt_deg(rh, lh)
            angles.hip_tilt_deg = _r(abs(raw))
            _check_issue(issues, "hip_tilt", "Pelvis Eğikliği", abs(raw),
                         mild=2.0, moderate=4.5, severe=8.0,
                         pen_mild=4, pen_mod=10, pen_sev=18)

        # SPINE LATERAL
        if _vis_ok(ls) and _vis_ok(rs) and _vis_ok(lh) and _vis_ok(rh):
            shoulder_mid_x = (ls.x + rs.x) / 2
            hip_mid_x = (lh.x + rh.x) / 2
            lateral_offset = abs(shoulder_mid_x - hip_mid_x)
            lateral_deg = _r(math.degrees(math.atan2(lateral_offset, 1.0)))
            angles.spine_lateral_deg = lateral_deg
            _check_issue(issues, "spine_lateral", "Omurga Lateral Sapma", lateral_deg,
                         mild=1.5, moderate=3.0, severe=6.0,
                         pen_mild=3, pen_mod=8, pen_sev=15)

        # KNEE ALIGNMENT
        if _vis_ok(lk) and _vis_ok(rk) and _vis_ok(lh) and _vis_ok(rh):
            knee_dx = abs(lk.x - rk.x)
            hip_dx = abs(lh.x - rh.x)
            ratio = knee_dx / (hip_dx + 1e-9)
            knee_angle = _r(abs(1.0 - ratio) * 10)
            angles.knee_alignment_deg = knee_angle
            _check_issue(issues, "knee_alignment", "Diz Hizalama", knee_angle,
                         mild=2.0, moderate=4.0, severe=7.0,
                         pen_mild=3, pen_mod=7, pen_sev=12)

    elif view == "side":
        # FORWARD HEAD
        ear = le if _vis_ok(le) else (re if _vis_ok(re) else None)
        shoulder = ls if _vis_ok(ls) else (rs if _vis_ok(rs) else None)
        if ear and shoulder:
            forward_offset = _r(ear.x - shoulder.x, 4)
            angles.forward_head_offset = _r(abs(forward_offset), 4)
            forward_deg = _r(math.degrees(math.atan2(
                abs(forward_offset), abs(ear.y - shoulder.y) + 1e-9)))
            _check_issue(issues, "forward_head", "Öne Baş Pozisyonu", forward_deg,
                         mild=8.0, moderate=15.0, severe=25.0,
                         pen_mild=5, pen_mod=14, pen_sev=22)

        # SHOULDER ROUNDING
        if shoulder and (_vis_ok(lh) or _vis_ok(rh)):
            hip = lh if _vis_ok(lh) else rh
            shoulder_forward = _r(shoulder.x - hip.x, 4)
            shoulder_deg = _r(math.degrees(math.atan2(
                abs(shoulder_forward), abs(shoulder.y - hip.y) + 1e-9)))
            angles.shoulder_tilt_deg = shoulder_deg
            _check_issue(issues, "rounded_shoulders", "Omuz Yuvarlanması", shoulder_deg,
                         mild=5.0, moderate=10.0, severe=18.0,
                         pen_mild=4, pen_mod=10, pen_sev=18)

    result.angles = angles
    result.issues = issues
    result.processing_ms = _r((time.perf_counter() - t0) * 1000, 1)
    return result


# ─── Aggregate scoring ──────────────────────────────────────────────

def _compute_score_and_confidence(
    views: list[ViewResult],
) -> tuple[int, str, str]:
    detected_views = [v for v in views if v.detected]

    if not detected_views:
        return 0, "none", "Hiçbir fotoğrafta vücut algılanamadı."

    all_issues: list[PostureIssue] = []
    for v in detected_views:
        all_issues.extend(v.issues)

    total_penalty = sum(i.penalty for i in all_issues)
    score = max(0, 100 - total_penalty)

    avg_vis = sum(v.avg_visibility for v in detected_views) / len(detected_views)
    view_count = len(detected_views)

    if view_count >= 3 and avg_vis >= 0.7:
        confidence = "high"
    elif view_count >= 2 and avg_vis >= 0.5:
        confidence = "medium"
    else:
        confidence = "low"

    if score >= 85:
        message = "Duruşun genel olarak iyi durumda. Küçük iyileştirmelerle mükemmel seviyeye ulaşabilirsin."
    elif score >= 65:
        message = "Bazı postür sorunları tespit edildi. Düzenli egzersiz ve farkındalıkla düzeltilebilir."
    elif score >= 40:
        message = "Belirgin postür sorunları var. Bilinçli düzeltme ve egzersiz programı önerilir."
    else:
        message = "Ciddi postür sorunları tespit edildi. Profesyonel değerlendirme önerilir."

    return score, confidence, message


# ─── Public API ─────────────────────────────────────────────────────

def analyze_posture(
    front_bytes: Optional[bytes] = None,
    side_bytes: Optional[bytes] = None,
    back_bytes: Optional[bytes] = None,
) -> PostureAnalysisResult:
    """Run full posture analysis on up to 3 images."""
    t0 = time.perf_counter()

    views: list[ViewResult] = []

    if front_bytes:
        views.append(_process_single_image(front_bytes, "front"))
    if side_bytes:
        views.append(_process_single_image(side_bytes, "side"))
    if back_bytes:
        views.append(_process_single_image(back_bytes, "back"))

    if not views:
        return PostureAnalysisResult(
            score=0,
            confidence="none",
            message="Analiz için en az bir fotoğraf gerekli.",
        )

    score, confidence, message = _compute_score_and_confidence(views)

    all_issues = []
    for v in views:
        for issue in v.issues:
            all_issues.append({
                "view": v.view,
                "code": issue.code,
                "label": issue.label,
                "severity": issue.severity,
                "value": issue.value,
                "threshold": issue.threshold,
                "penalty": issue.penalty,
            })

    angles_dict = {}
    for v in views:
        if v.detected:
            a = v.angles
            angles_dict[v.view] = {
                k: getattr(a, k) for k in a.__dataclass_fields__
                if getattr(a, k) is not None
            }

    views_dict = {}
    for v in views:
        views_dict[v.view] = {
            "detected": v.detected,
            "landmark_count": v.landmark_count,
            "avg_visibility": v.avg_visibility,
            "issue_count": len(v.issues),
            "processing_ms": v.processing_ms,
        }

    total_ms = _r((time.perf_counter() - t0) * 1000, 1)

    return PostureAnalysisResult(
        score=score,
        confidence=confidence,
        issues=all_issues,
        angles=angles_dict,
        message=message,
        views=views_dict,
        processing_ms=total_ms,
    )
