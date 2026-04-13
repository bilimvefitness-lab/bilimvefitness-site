"""
social.py — Social scoring, leaderboard, and challenges.
HARDENED v3 — SQLite-backed. JSON files eliminated.

═══════════════════════════════════════════════════════════════
TRUST MODEL
═══════════════════════════════════════════════════════════════

Score (POST /social/score):
  Client sends RAW numeric observations only.
  Backend derives ALL completion flags, streak, and final score.

  Accepted fields:   steps, water_consumed_ml, water_target_ml,
                     nutrition_meals, sleep_minutes
  Removed fields:    streak_days  (was accepted, now ignored if sent)
  Rejected fields:   steps_complete, water_complete, score
  Extra fields:      silently dropped (model_config extra='ignore')
  Clamped fields:    water_target_ml [500, 8000]
                     steps          [0, 200_000]  OR overridden by backend

Step source alignment:
  Backend first looks up the steps table for the submitted date.
  If synced step data exists → that value is used, client value dropped.
  If no backend data exists → client value is accepted as fallback.
  Client can never inflate steps beyond a synced backend value.

Streak source:
  streak_days is NOT accepted from the client.
  Backend derives streak by querying daily_social_scores history:
    Walk backwards from (as_of_date − 1 day).
    Count consecutive days where all four categories are complete.
    Add 1 if today's submission is also all_complete.
    Break on any day with no submission or incomplete flags.

Challenge progress (POST /social/challenges/{id}/progress):
  Client sends raw value per challenge type.
  Backend clamps per type before storing:
    steps-7day       → [0, 100_000] steps
    water-7day       → [0, 10_000]  ml
    consistency-7day → binary 0.0 or 1.0

═══════════════════════════════════════════════════════════════
DATE VALIDATION
═══════════════════════════════════════════════════════════════

  not more than 2 days in the past    (localtime drift tolerance)
  not more than 1 day in the future   (clock skew tolerance)
  Challenge progress dates further bounded to challenge window.

═══════════════════════════════════════════════════════════════
STORAGE
═══════════════════════════════════════════════════════════════

  SQLite (data/social.db) — daily_social_scores, challenges,
  challenge_participants, challenge_progress, steps, users,
  friend_requests, friendships tables via app.db.social_db.
"""

import logging
import sqlite3
import uuid
from datetime import datetime, timezone, date as _Date, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, Header
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.social_db import db_write, db_read, require_token_db

log = logging.getLogger(__name__)

router = APIRouter(prefix="/social", tags=["social"])

# ── Domain constants ──────────────────────────────────────────────────────────

STEP_GOAL = 10_000

_RAW_CAPS = {
    "steps":              200_000,
    "water_consumed_ml":   10_000,
    "water_target_ml_min":    500,
    "water_target_ml_max":  8_000,
    "nutrition_meals":         50,
    "sleep_minutes":        1_440,
}

_PROGRESS_CAPS = {
    "steps-7day":        100_000.0,
    "water-7day":         10_000.0,
    "consistency-7day":       1.0,
}

CHALLENGE_TYPES = set(_PROGRESS_CAPS)

CHALLENGE_DEFAULTS = {
    "steps-7day":        "7 Günlük Adım Yarışması",
    "water-7day":        "7 Günlük Su Yarışması",
    "consistency-7day":  "7 Günlük Tutarlılık Yarışması",
}

_CHALLENGE_GRACE_DAYS = 3


# ── Date validation ───────────────────────────────────────────────────────────

def _parse_and_validate_date(
    date_str: str,
    *,
    max_past_days: int = 2,
    max_future_days: int = 1,
) -> _Date:
    try:
        d = _Date.fromisoformat(date_str.strip())
    except (ValueError, AttributeError):
        raise HTTPException(status_code=422, detail="Geçersiz tarih formatı. YYYY-MM-DD gerekli.")
    today = _Date.today()
    if d < today - timedelta(days=max_past_days):
        raise HTTPException(
            status_code=422,
            detail=f"Tarih çok eski ({max_past_days} günden öncesi kabul edilmez).",
        )
    if d > today + timedelta(days=max_future_days):
        raise HTTPException(status_code=422, detail="İlerideki tarihler kabul edilmez.")
    return d


# ── Step source alignment ─────────────────────────────────────────────────────

def _resolve_steps(
    conn: sqlite3.Connection,
    user_id: str,
    date_str: str,
    client_steps: int,
) -> tuple[int, str]:
    """
    Return (authoritative_step_count, source) where source is "backend" or "client".

    Priority:
      1. Backend-synced value from the steps table — cannot be inflated by client.
      2. Client-submitted value — fallback when no sync data exists for the date.

    Both values are capped at _RAW_CAPS["steps"] regardless of source.
    """
    row = conn.execute(
        "SELECT step_count FROM steps WHERE user_id = ? AND step_date = ?",
        (user_id, date_str),
    ).fetchone()
    if row:
        return max(0, min(int(row["step_count"]), _RAW_CAPS["steps"])), "backend"
    return max(0, min(client_steps, _RAW_CAPS["steps"])), "client"


# ── Backend-authoritative streak derivation ───────────────────────────────────

def _derive_streak(
    conn: sqlite3.Connection,
    user_id: str,
    as_of_date: _Date,
    today_all_complete: bool,
) -> int:
    """
    Derive consecutive-day streak ending on as_of_date from the DB.

    Algorithm:
      1. If today is NOT all_complete → streak = 0 (broken).
      2. If today IS all_complete → streak = 1 + consecutive all_complete
         days immediately preceding as_of_date in daily_social_scores.
         A day with no row counts as incomplete (streak break).

    Client-submitted streak_days has NO influence on this function.
    """
    if not today_all_complete:
        return 0

    streak  = 1                          # today itself counts
    current = as_of_date - timedelta(days=1)

    for _ in range(365):                 # hard limit — prevents pathological loops
        row = conn.execute(
            """
            SELECT steps_complete, water_complete, nutrition_logged, sleep_logged
            FROM   daily_social_scores
            WHERE  user_id = ? AND score_date = ?
            """,
            (user_id, current.isoformat()),
        ).fetchone()

        if not row:
            break                        # no submission = streak ends
        if not (row["steps_complete"] and row["water_complete"] and
                row["nutrition_logged"] and row["sleep_logged"]):
            break                        # incomplete day = streak ends

        streak  += 1
        current -= timedelta(days=1)

    return streak


# ── Score computation ─────────────────────────────────────────────────────────

def _derive_score(
    steps: int,
    water_consumed_ml: int,
    water_target_ml: int,
    nutrition_meals: int,
    sleep_minutes: int,
    streak_days: int,           # MUST be backend-derived; caller is responsible
) -> dict:
    """
    Compute social score from raw (already-clamped) inputs + backend-derived streak.
    Returns a dict with completion flags, clamped inputs, and final score.
    """
    # Defense-in-depth clamping (primary clamping happens before the call)
    steps             = max(0, min(steps,             _RAW_CAPS["steps"]))
    water_consumed_ml = max(0, min(water_consumed_ml, _RAW_CAPS["water_consumed_ml"]))
    water_target_ml   = max(
        _RAW_CAPS["water_target_ml_min"],
        min(water_target_ml, _RAW_CAPS["water_target_ml_max"]),
    )
    nutrition_meals   = max(0, min(nutrition_meals,   _RAW_CAPS["nutrition_meals"]))
    sleep_minutes     = max(0, min(sleep_minutes,     _RAW_CAPS["sleep_minutes"]))
    streak_days       = max(0, streak_days)

    steps_complete   = steps             >= STEP_GOAL
    water_complete   = water_consumed_ml >= water_target_ml
    nutrition_logged = nutrition_meals   >= 1
    sleep_logged     = sleep_minutes     >  0
    all_complete     = steps_complete and water_complete and nutrition_logged and sleep_logged

    score = 0
    if steps_complete:   score += 40
    if water_complete:   score += 20
    if nutrition_logged: score += 20
    if sleep_logged:     score += 20
    if all_complete:     score += 20      # bonus — only when all four done
    if streak_days >= 7:   score += 25
    elif streak_days >= 3: score += 10

    return {
        "steps":             steps,
        "water_consumed_ml": water_consumed_ml,
        "water_target_ml":   water_target_ml,
        "nutrition_meals":   nutrition_meals,
        "sleep_minutes":     sleep_minutes,
        "streak_days":       streak_days,
        "steps_complete":    steps_complete,
        "water_complete":    water_complete,
        "nutrition_logged":  nutrition_logged,
        "sleep_logged":      sleep_logged,
        "all_complete":      all_complete,
        "score":             score,
    }


# ── Challenge progress clamping ───────────────────────────────────────────────

def _clamp_progress_value(ch_type: str, value: float) -> float:
    if ch_type == "consistency-7day":
        return 1.0 if value > 0 else 0.0
    cap = _PROGRESS_CAPS.get(ch_type)
    if cap is None:
        return 0.0
    return max(0.0, min(float(value), float(cap)))


# ── Friend helpers ────────────────────────────────────────────────────────────

def _friend_uids(conn: sqlite3.Connection, user_id: str) -> list:
    """Return list of user_ids that are friends with *user_id*."""
    rows = conn.execute(
        "SELECT user_a, user_b FROM friendships WHERE user_a = ? OR user_b = ?",
        (user_id, user_id),
    ).fetchall()
    seen   = set()
    result = []
    for r in rows:
        other = r["user_b"] if r["user_a"] == user_id else r["user_a"]
        if other not in seen:
            seen.add(other)
            result.append(other)
    return result


# ── Schemas ───────────────────────────────────────────────────────────────────

class ScorePayload(BaseModel):
    """
    Raw daily observations. streak_days is NOT accepted — derived server-side.
    Any extra fields the client sends (e.g. old streak_days) are silently dropped.
    """
    model_config = ConfigDict(extra="ignore")

    user_id: str = Field(..., min_length=1)
    date:    str = Field(..., description="YYYY-MM-DD local date")

    steps:             int = Field(default=0,    ge=0)
    water_consumed_ml: int = Field(default=0,    ge=0)
    water_target_ml:   int = Field(default=2500, ge=1)
    nutrition_meals:   int = Field(default=0,    ge=0)
    sleep_minutes:     int = Field(default=0,    ge=0)
    # streak_days intentionally absent — backend derives it


class ChallengeCreatePayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    user_id:       str = Field(..., min_length=1)
    type:          str
    title:         str = ""
    duration_days: int = Field(default=7, ge=1, le=30)

    @field_validator("type")
    @classmethod
    def type_must_be_valid(cls, v: str) -> str:
        if v not in CHALLENGE_TYPES:
            raise ValueError(f"Geçersiz tür. Kabul edilenler: {', '.join(sorted(CHALLENGE_TYPES))}")
        return v


class ChallengeJoinPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(..., min_length=1)


class ProgressPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str   = Field(..., min_length=1)
    date:    str   = Field(..., description="YYYY-MM-DD local date")
    value:   float = Field(default=0.0, ge=0.0)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/score")
async def submit_score(
    payload: ScorePayload,
    x_device_token: Optional[str] = Header(None),
) -> dict:
    """
    Submit or update the caller's daily social score.

    Pipeline (all server-side):
      1. Validate and normalise date.
      2. Authenticate via X-Device-Token.
      3. Resolve authoritative step count (steps table → client fallback).
      4. Derive completion flags from clamped raw values (streak = 0 placeholder).
      5. Derive streak from daily_social_scores history (client input ignored).
      6. Recompute final score with authoritative streak.
      7. Upsert row — same-day re-submission overwrites previous record.
    """
    date_obj  = _parse_and_validate_date(payload.date, max_past_days=2, max_future_days=1)
    norm_date = date_obj.isoformat()
    now_utc   = datetime.now(timezone.utc).isoformat()

    with db_write() as conn:
        require_token_db(conn, payload.user_id, x_device_token)

        # ── Step source alignment ─────────────────────────────────────────────
        final_steps, steps_source = _resolve_steps(
            conn, payload.user_id, norm_date, payload.steps
        )

        # ── First-pass derive (streak placeholder = 0) ────────────────────────
        derived = _derive_score(
            steps             = final_steps,
            water_consumed_ml = payload.water_consumed_ml,
            water_target_ml   = payload.water_target_ml,
            nutrition_meals   = payload.nutrition_meals,
            sleep_minutes     = payload.sleep_minutes,
            streak_days       = 0,
        )

        # ── Streak derivation from DB history ─────────────────────────────────
        # We have NOT written today's row yet, so lookback is clean.
        streak = _derive_streak(
            conn, payload.user_id, date_obj, derived["all_complete"]
        )

        # ── Recompute with authoritative streak ───────────────────────────────
        derived = _derive_score(
            steps             = final_steps,
            water_consumed_ml = payload.water_consumed_ml,
            water_target_ml   = payload.water_target_ml,
            nutrition_meals   = payload.nutrition_meals,
            sleep_minutes     = payload.sleep_minutes,
            streak_days       = streak,
        )

        # ── Upsert (compound PK: user_id + score_date) ───────────────────────
        conn.execute(
            """
            INSERT OR REPLACE INTO daily_social_scores
                (user_id, score_date,
                 steps, steps_raw, steps_source,
                 water_consumed_ml, water_target_ml,
                 nutrition_meals, sleep_minutes,
                 steps_complete, water_complete, nutrition_logged, sleep_logged,
                 all_complete, streak_days, score, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                payload.user_id, norm_date,
                derived["steps"], payload.steps, steps_source,
                derived["water_consumed_ml"], derived["water_target_ml"],
                derived["nutrition_meals"],   derived["sleep_minutes"],
                int(derived["steps_complete"]),
                int(derived["water_complete"]),
                int(derived["nutrition_logged"]),
                int(derived["sleep_logged"]),
                int(derived["all_complete"]),
                streak, derived["score"], now_utc,
            ),
        )

    log.info(
        "[social] score user=%s date=%s score=%d steps=%d(%s) streak=%d(derived)",
        payload.user_id, norm_date, derived["score"],
        final_steps, steps_source, streak,
    )
    return {
        "ok":               True,
        "score":            derived["score"],
        "date":             norm_date,
        "streak_days":      streak,
        "steps_source":     steps_source,
        "steps_complete":   derived["steps_complete"],
        "water_complete":   derived["water_complete"],
        "nutrition_logged": derived["nutrition_logged"],
        "sleep_logged":     derived["sleep_logged"],
        "all_complete":     derived["all_complete"],
    }


@router.get("/leaderboard")
async def get_leaderboard(
    user_id: str           = Query(..., min_length=1),
    date:    Optional[str] = Query(None),
    x_device_token: Optional[str] = Header(None),
) -> list:
    """
    Friends-only leaderboard for *date* (default: today).
    Scores are 100% backend-derived — no client field passes through.
    X-Device-Token required.
    """
    target_date = date or _Date.today().isoformat()

    with db_read() as conn:
        require_token_db(conn, user_id, x_device_token)
        friend_ids = _friend_uids(conn, user_id)
        all_uids   = [user_id] + friend_ids

        ph = ",".join("?" * len(all_uids))

        user_rows = conn.execute(
            f"SELECT user_id, public_user_id, display_name FROM users WHERE user_id IN ({ph})",
            all_uids,
        ).fetchall()

        score_rows = conn.execute(
            f"""
            SELECT user_id, score, streak_days,
                   steps_complete, water_complete, nutrition_logged, sleep_logged, all_complete
            FROM   daily_social_scores
            WHERE  user_id IN ({ph}) AND score_date = ?
            """,
            all_uids + [target_date],
        ).fetchall()

    user_map  = {r["user_id"]: r for r in user_rows}
    score_map = {r["user_id"]: r for r in score_rows}

    rows = []
    for uid in all_uids:
        u = user_map.get(uid)
        s = score_map.get(uid)
        rows.append({
            "user_id":          uid,
            "display_name":     (u["display_name"] if u else None) or "İsimsiz",
            "public_user_id":   u["public_user_id"] if u else "",
            "is_self":          uid == user_id,
            "score":            s["score"]           if s else 0,
            "streak_days":      s["streak_days"]     if s else 0,
            "steps_complete":   bool(s["steps_complete"])   if s else False,
            "water_complete":   bool(s["water_complete"])   if s else False,
            "nutrition_logged": bool(s["nutrition_logged"]) if s else False,
            "sleep_logged":     bool(s["sleep_logged"])     if s else False,
            "all_complete":     bool(s["all_complete"])     if s else False,
            "has_data":         s is not None,
        })

    rows.sort(key=lambda r: r["score"], reverse=True)
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    return rows


@router.post("/challenges")
async def create_challenge(
    payload: ChallengeCreatePayload,
    x_device_token: Optional[str] = Header(None),
) -> dict:
    """Create a challenge. Creator is automatically a participant."""
    now     = datetime.now(timezone.utc)
    now_s   = now.isoformat()
    start   = _Date.today().isoformat()
    end     = (_Date.today() + timedelta(days=payload.duration_days - 1)).isoformat()
    title   = payload.title.strip() or CHALLENGE_DEFAULTS[payload.type]
    cid     = str(uuid.uuid4())

    with db_write() as conn:
        require_token_db(conn, payload.user_id, x_device_token)

        conn.execute(
            """
            INSERT INTO challenges
                (id, challenge_type, title, creator_id,
                 start_date, end_date, duration_days, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
            """,
            (cid, payload.type, title, payload.user_id,
             start, end, payload.duration_days, now_s),
        )
        conn.execute(
            "INSERT INTO challenge_participants (challenge_id, user_id, joined_at) VALUES (?, ?, ?)",
            (cid, payload.user_id, now_s),
        )

    log.info("[social] challenge created id=%s by=%s type=%s end=%s",
             cid, payload.user_id, payload.type, end)
    return {
        "id":            cid,
        "type":          payload.type,
        "title":         title,
        "creator_id":    payload.user_id,
        "start_date":    start,
        "end_date":      end,
        "duration_days": payload.duration_days,
        "participants":  [payload.user_id],
        "status":        "active",
        "created_at":    now_s,
    }


@router.get("/challenges")
async def list_challenges(
    user_id: str = Query(..., min_length=1),
    x_device_token: Optional[str] = Header(None),
) -> list:
    """List challenges visible to the caller. X-Device-Token required."""
    cutoff = (_Date.today() - timedelta(days=_CHALLENGE_GRACE_DAYS)).isoformat()

    with db_read() as conn:
        require_token_db(conn, user_id, x_device_token)
        friend_set = set(_friend_uids(conn, user_id))

        chal_rows = conn.execute(
            "SELECT * FROM challenges WHERE end_date >= ?", (cutoff,)
        ).fetchall()

        if not chal_rows:
            return []

        chal_ids = [r["id"] for r in chal_rows]
        ph       = ",".join("?" * len(chal_ids))

        # All participants for these challenges
        part_rows = conn.execute(
            f"SELECT challenge_id, user_id FROM challenge_participants WHERE challenge_id IN ({ph})",
            chal_ids,
        ).fetchall()

        # Current user's progress for these challenges
        prog_rows = conn.execute(
            f"""
            SELECT challenge_id, progress_date, value
            FROM   challenge_progress
            WHERE  challenge_id IN ({ph}) AND user_id = ?
            """,
            chal_ids + [user_id],
        ).fetchall()

        # Creator display names
        creator_ids = list({r["creator_id"] for r in chal_rows})
        creator_names: dict = {}
        if creator_ids:
            cph = ",".join("?" * len(creator_ids))
            creator_rows = conn.execute(
                f"SELECT user_id, display_name FROM users WHERE user_id IN ({cph})",
                creator_ids,
            ).fetchall()
            creator_names = {r["user_id"]: r["display_name"] for r in creator_rows}

    # Build participant sets per challenge
    participants_map: dict[str, list] = {}
    for pr in part_rows:
        participants_map.setdefault(pr["challenge_id"], []).append(pr["user_id"])

    # Build current user's progress per challenge
    my_progress_map: dict[str, dict] = {}
    for pr in prog_rows:
        my_progress_map.setdefault(pr["challenge_id"], {})[pr["progress_date"]] = {
            "value": pr["value"]
        }

    result = []
    for ch in chal_rows:
        cid            = ch["id"]
        participants   = participants_map.get(cid, [])
        is_participant = user_id in participants
        creator_visible = ch["creator_id"] == user_id or ch["creator_id"] in friend_set
        if not (is_participant or creator_visible):
            continue

        result.append({
            "id":                cid,
            "type":              ch["challenge_type"],
            "title":             ch["title"],
            "creator_id":        ch["creator_id"],
            "creator_name":      creator_names.get(ch["creator_id"], "") or "İsimsiz",
            "start_date":        ch["start_date"],
            "end_date":          ch["end_date"],
            "status":            ch["status"],
            "participant_count": len(participants),
            "is_participant":    is_participant,
            "my_progress":       my_progress_map.get(cid, {}),
        })

    result.sort(key=lambda c: c["start_date"], reverse=True)
    return result


@router.post("/challenges/{challenge_id}/join")
async def join_challenge(
    challenge_id: str,
    payload: ChallengeJoinPayload,
    x_device_token: Optional[str] = Header(None),
) -> dict:
    """Join an active challenge. X-Device-Token required."""
    now_utc = datetime.now(timezone.utc).isoformat()

    with db_write() as conn:
        require_token_db(conn, payload.user_id, x_device_token)

        ch = conn.execute(
            "SELECT * FROM challenges WHERE id = ?", (challenge_id,)
        ).fetchone()
        if not ch:
            raise HTTPException(status_code=404, detail="Challenge bulunamadı")
        if ch["status"] != "active":
            raise HTTPException(status_code=400, detail="Bu challenge artık aktif değil")
        if _Date.today() > _Date.fromisoformat(ch["end_date"]):
            raise HTTPException(status_code=400, detail="Bu challenge sona erdi")

        already = conn.execute(
            "SELECT 1 FROM challenge_participants WHERE challenge_id = ? AND user_id = ?",
            (challenge_id, payload.user_id),
        ).fetchone()
        if already:
            raise HTTPException(status_code=400, detail="Zaten bu challenge'a katıldınız")

        conn.execute(
            "INSERT INTO challenge_participants (challenge_id, user_id, joined_at) VALUES (?, ?, ?)",
            (challenge_id, payload.user_id, now_utc),
        )

    log.info("[social] %s joined challenge %s", payload.user_id, challenge_id)
    return {"ok": True}


@router.post("/challenges/{challenge_id}/progress")
async def update_progress(
    challenge_id: str,
    payload: ProgressPayload,
    x_device_token: Optional[str] = Header(None),
) -> dict:
    """
    Upsert daily challenge progress. Backend clamps value per challenge type.
    Guards: participant check, not ended, date within challenge window.
    X-Device-Token required.
    """
    now_utc = datetime.now(timezone.utc).isoformat()

    with db_write() as conn:
        require_token_db(conn, payload.user_id, x_device_token)

        ch = conn.execute(
            "SELECT * FROM challenges WHERE id = ?", (challenge_id,)
        ).fetchone()
        if not ch:
            raise HTTPException(status_code=404, detail="Challenge bulunamadı")

        is_participant = conn.execute(
            "SELECT 1 FROM challenge_participants WHERE challenge_id = ? AND user_id = ?",
            (challenge_id, payload.user_id),
        ).fetchone()
        if not is_participant:
            raise HTTPException(status_code=403, detail="Bu challenge'a katılmadınız")

        ch_end = _Date.fromisoformat(ch["end_date"])
        if _Date.today() > ch_end + timedelta(days=1):
            raise HTTPException(status_code=400, detail="Bu challenge sona erdi")

        date_obj  = _parse_and_validate_date(payload.date, max_past_days=2, max_future_days=0)
        norm_date = date_obj.isoformat()

        ch_start = _Date.fromisoformat(ch["start_date"])
        if date_obj < ch_start:
            raise HTTPException(
                status_code=422,
                detail=f"Tarih challenge başlangıcından ({ch['start_date']}) önce",
            )
        if date_obj > ch_end:
            raise HTTPException(
                status_code=422,
                detail=f"Tarih challenge bitiş tarihinden ({ch['end_date']}) sonra",
            )

        clamped = _clamp_progress_value(ch["challenge_type"], payload.value)

        conn.execute(
            """
            INSERT OR REPLACE INTO challenge_progress
                (challenge_id, user_id, progress_date, value, updated_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (challenge_id, payload.user_id, norm_date, clamped, now_utc),
        )

    log.info(
        "[social] progress ch=%s user=%s date=%s raw=%.1f→%.1f type=%s",
        challenge_id, payload.user_id, norm_date,
        payload.value, clamped, ch["challenge_type"],
    )
    return {"ok": True, "value": clamped, "date": norm_date}


@router.get("/challenges/{challenge_id}/ranking")
async def get_challenge_ranking(
    challenge_id: str,
    user_id: str = Query(..., min_length=1),
    x_device_token: Optional[str] = Header(None),
) -> list:
    """Challenge ranking. Caller must be a participant. X-Device-Token required."""
    with db_read() as conn:
        require_token_db(conn, user_id, x_device_token)

        ch = conn.execute(
            "SELECT * FROM challenges WHERE id = ?", (challenge_id,)
        ).fetchone()
        if not ch:
            raise HTTPException(status_code=404, detail="Challenge bulunamadı")

        is_participant = conn.execute(
            "SELECT 1 FROM challenge_participants WHERE challenge_id = ? AND user_id = ?",
            (challenge_id, user_id),
        ).fetchone()
        if not is_participant:
            raise HTTPException(status_code=403, detail="Bu challenge'a katılmadınız")

        participants = conn.execute(
            "SELECT user_id FROM challenge_participants WHERE challenge_id = ?",
            (challenge_id,),
        ).fetchall()
        part_ids = [r["user_id"] for r in participants]

        if not part_ids:
            return []

        ph = ",".join("?" * len(part_ids))

        user_rows = conn.execute(
            f"SELECT user_id, display_name, public_user_id FROM users WHERE user_id IN ({ph})",
            part_ids,
        ).fetchall()
        user_map = {r["user_id"]: r for r in user_rows}

        prog_rows = conn.execute(
            f"""
            SELECT user_id, value
            FROM   challenge_progress
            WHERE  challenge_id = ? AND user_id IN ({ph})
            """,
            [challenge_id] + part_ids,
        ).fetchall()

    # Aggregate progress per user
    prog_map: dict[str, list] = {}
    for pr in prog_rows:
        prog_map.setdefault(pr["user_id"], []).append(pr["value"])

    rows = []
    for uid in part_ids:
        u              = user_map.get(uid)
        values         = prog_map.get(uid, [])
        total_value    = sum(values)
        days_completed = sum(1 for v in values if v > 0)
        rows.append({
            "user_id":        uid,
            "display_name":   (u["display_name"] if u else None) or "İsimsiz",
            "public_user_id": u["public_user_id"] if u else "",
            "is_self":        uid == user_id,
            "total_value":    total_value,
            "days_completed": days_completed,
        })

    rows.sort(key=lambda r: r["total_value"], reverse=True)
    for i, r in enumerate(rows):
        r["rank"] = i + 1

    return rows
