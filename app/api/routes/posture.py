"""
POST /posture/analyze — Server-side posture analysis via MediaPipe.

Accepts up to 3 images (front, side, back) as multipart form data.
Returns score, confidence, issues, angles, and a human-readable message.
"""

from fastapi import APIRouter, File, UploadFile
from pydantic import BaseModel

from app.services.posture_analysis import analyze_posture

router = APIRouter(prefix="/posture", tags=["posture"])


class PostureIssueResponse(BaseModel):
    view: str
    code: str
    label: str
    severity: str
    value: float
    threshold: float
    penalty: int


class PostureViewResponse(BaseModel):
    detected: bool
    landmark_count: int
    avg_visibility: float
    issue_count: int
    processing_ms: float


class PostureAnalysisResponse(BaseModel):
    score: int
    confidence: str
    issues: list[PostureIssueResponse]
    angles: dict
    message: str
    views: dict[str, PostureViewResponse]
    processing_ms: float


@router.post("/analyze", response_model=PostureAnalysisResponse)
async def analyze_posture_endpoint(
    front: UploadFile | None = File(None, description="Front-facing full body photo"),
    side: UploadFile | None = File(None, description="Side-facing full body photo"),
    back: UploadFile | None = File(None, description="Back-facing full body photo"),
) -> PostureAnalysisResponse:
    """
    Analyze posture from uploaded images using MediaPipe Pose.

    - Upload at least one image (front recommended).
    - All three views give the highest confidence score.
    - Returns a 0–100 score with specific issues found.
    """
    front_bytes = await front.read() if front else None
    side_bytes = await side.read() if side else None
    back_bytes = await back.read() if back else None

    result = analyze_posture(
        front_bytes=front_bytes,
        side_bytes=side_bytes,
        back_bytes=back_bytes,
    )

    return PostureAnalysisResponse(
        score=result.score,
        confidence=result.confidence,
        issues=[PostureIssueResponse(**i) for i in result.issues],
        angles=result.angles,
        message=result.message,
        views={k: PostureViewResponse(**v) for k, v in result.views.items()},
        processing_ms=result.processing_ms,
    )
