"""
friends.py — Friend system: public IDs, friend requests, friendships, profile photos.
SQLite-backed via app.db.social_db. JSON files and portalocker eliminated.

Storage layout
──────────────
  SQLite (data/social.db)  — users, friend_requests, friendships tables
  data/photos/{user_id}/   — versioned profile photos (files stay on disk)
                              each upload creates {unix_ts}.{ext}
                              active photo path cached in users.photo_path

Security model
──────────────
  All write operations and personal data reads validate X-Device-Token
  against the users table via require_token_db() from social_db.

Locking strategy
────────────────
  db_write() acquires a module-level threading.Lock + SQLite WAL mode.
  No portalocker needed — WAL handles concurrent readers; the write lock
  serialises all writes within the process.

Photo versioning
────────────────
  Each upload lands in data/photos/{user_id}/{unix_ts}.{ext}.
  users.photo_path stores the active photo path for fast lookup.
  users.photo_version stores the unix timestamp for client cache-busting.
  Up to _PHOTO_KEEP_VERSIONS previous versions are kept on disk.
"""

import logging
import shutil
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query, UploadFile, File, Header
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.db.social_db import (
    db_write,
    db_read,
    require_token_db,
    generate_public_id,
    _PHOTOS_DIR,
    _ALLOWED_PHOTO_EXTS,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/friends", tags=["friends"])

_PHOTO_KEEP_VERSIONS = 2


# ── Photo file helpers ────────────────────────────────────────────────────────

def _photo_path_for(user_id: str) -> Optional[Path]:
    """
    Return the active profile photo for *user_id* by scanning the photos dir.
    Used as a fallback when users.photo_path is NULL or the file is missing.
    """
    user_dir = _PHOTOS_DIR / user_id
    if not user_dir.exists():
        return None
    photos = sorted(
        [f for f in user_dir.iterdir() if f.suffix.lower() in _ALLOWED_PHOTO_EXTS],
        key=lambda f: f.stem,
        reverse=True,
    )
    return photos[0] if photos else None


def _cleanup_old_photos(user_dir: Path, keep: int = _PHOTO_KEEP_VERSIONS) -> None:
    """Delete old versioned photos, keeping the *keep* newest."""
    photos = sorted(
        [f for f in user_dir.iterdir() if f.suffix.lower() in _ALLOWED_PHOTO_EXTS],
        key=lambda f: f.stem,
        reverse=True,
    )
    for old in photos[keep:]:
        try:
            old.unlink()
        except OSError:
            pass


# ── Schemas ───────────────────────────────────────────────────────────────────

class PublicIdRequest(BaseModel):
    user_id: str
    display_name: str = ""


class SendRequestPayload(BaseModel):
    from_user_id: str
    from_public_id: str
    from_name: str
    to_public_id: str


class RespondPayload(BaseModel):
    request_id: str
    user_id: str
    accept: bool


class UpdateDisplayNamePayload(BaseModel):
    user_id: str
    display_name: str


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/public-id")
async def get_or_create_public_id(payload: PublicIdRequest) -> dict:
    """
    Bootstrap endpoint — idempotent.

    Returns:
      public_user_id  — permanent AG-XXXXXX identifier
      device_token    — permanent session secret for X-Device-Token header
      has_photo       — whether a server-side photo exists for this user
      photo_version   — unix timestamp of last upload (use as ?v= cache-buster)

    Self-healing: entries missing device_token get one auto-generated on this call.
    """
    now_utc = datetime.now(timezone.utc).isoformat()

    with db_write() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE user_id = ?", (payload.user_id,)
        ).fetchone()

        if row:
            display_name = row["display_name"]
            device_token = row["device_token"]
            changed = False

            if payload.display_name and display_name != payload.display_name:
                display_name = payload.display_name
                changed = True

            if not device_token:
                device_token = str(uuid.uuid4())
                log.info("[friends] auto-generated device_token for legacy user %s", payload.user_id)
                changed = True

            if changed:
                conn.execute(
                    "UPDATE users SET display_name = ?, device_token = ?, updated_at = ? WHERE user_id = ?",
                    (display_name, device_token, now_utc, payload.user_id),
                )

            has_photo = bool(row["photo_path"]) or _photo_path_for(payload.user_id) is not None
            return {
                "public_user_id": row["public_user_id"],
                "display_name":   display_name,
                "device_token":   device_token,
                "has_photo":      has_photo,
                "photo_version":  row["photo_version"],
            }

        # New user — generate unique public ID and device token inside write lock
        public_id = generate_public_id(conn)
        token = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO users
                (user_id, public_user_id, device_token, display_name,
                 photo_path, photo_version, created_at, updated_at)
            VALUES (?, ?, ?, ?, NULL, 0, ?, ?)
            """,
            (payload.user_id, public_id, token, payload.display_name, now_utc, now_utc),
        )
        log.info("[friends] registered new user %s → %s", payload.user_id, public_id)
        return {
            "public_user_id": public_id,
            "display_name":   payload.display_name,
            "device_token":   token,
            "has_photo":      False,
            "photo_version":  0,
        }


@router.patch("/display-name")
async def update_display_name(payload: UpdateDisplayNamePayload) -> dict:
    """Sync display_name to the users table (best-effort, no token required)."""
    now_utc = datetime.now(timezone.utc).isoformat()
    with db_write() as conn:
        row = conn.execute(
            "SELECT 1 FROM users WHERE user_id = ?", (payload.user_id,)
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Kullanıcı arkadaş sistemine kayıtlı değil")
        conn.execute(
            "UPDATE users SET display_name = ?, updated_at = ? WHERE user_id = ?",
            (payload.display_name, now_utc, payload.user_id),
        )
    return {"ok": True}


@router.post("/photo")
async def upload_photo(
    user_id: str = Query(..., min_length=1),
    file: UploadFile = File(...),
    x_device_token: Optional[str] = Header(None),
) -> dict:
    """
    Upload profile photo. Requires X-Device-Token.

    Writes file to data/photos/{user_id}/{unix_ts}.{ext}.
    Updates users.photo_path and users.photo_version in SQLite.
    Only _PHOTO_KEEP_VERSIONS previous versions are retained on disk.
    """
    # Validate token before touching the filesystem
    with db_read() as conn:
        require_token_db(conn, user_id, x_device_token)

    ext = Path(file.filename).suffix.lower() if file.filename else ".jpg"
    if ext not in _ALLOWED_PHOTO_EXTS:
        ext = ".jpg"

    version = int(time.time())
    user_dir = _PHOTOS_DIR / user_id
    user_dir.mkdir(parents=True, exist_ok=True)
    dest = user_dir / f"{version}{ext}"

    try:
        with dest.open("wb") as f:
            shutil.copyfileobj(file.file, f)
    except Exception as exc:
        log.error("[friends] photo write failed for %s: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Fotoğraf kaydedilemedi")

    _cleanup_old_photos(user_dir, keep=_PHOTO_KEEP_VERSIONS)

    now_utc = datetime.now(timezone.utc).isoformat()
    with db_write() as conn:
        conn.execute(
            "UPDATE users SET photo_path = ?, photo_version = ?, updated_at = ? WHERE user_id = ?",
            (str(dest), version, now_utc, user_id),
        )

    log.info("[friends] photo uploaded for %s version=%s", user_id, version)
    return {"ok": True, "photo_version": version}


@router.get("/photo/{user_id}")
async def get_photo(user_id: str, v: Optional[str] = None):
    """
    Serve the active profile photo for *user_id*.

    First checks users.photo_path in SQLite for a fast path.
    Falls back to filesystem scan if the DB path is missing or stale.
    Cache-Control: no-store — browsers always re-fetch.
    """
    path = None
    with db_read() as conn:
        row = conn.execute(
            "SELECT photo_path FROM users WHERE user_id = ?", (user_id,)
        ).fetchone()
        if row and row["photo_path"]:
            p = Path(row["photo_path"])
            if p.exists():
                path = p

    if path is None:
        path = _photo_path_for(user_id)

    if path is None:
        raise HTTPException(status_code=404, detail="Fotoğraf bulunamadı")

    return FileResponse(
        str(path),
        headers={"Cache-Control": "no-store, no-cache, must-revalidate"},
    )


@router.get("/find")
async def find_user_by_public_id(public_id: str = Query(..., min_length=1)) -> dict:
    """Public profile search by AG-XXXXXX. No token required (public data only)."""
    normalized = public_id.strip().upper()
    with db_read() as conn:
        row = conn.execute(
            "SELECT user_id, public_user_id, display_name, photo_path, photo_version "
            "FROM users WHERE UPPER(public_user_id) = ?",
            (normalized,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

    has_photo = bool(row["photo_path"]) or _photo_path_for(row["user_id"]) is not None
    return {
        "user_id":        row["user_id"],
        "public_user_id": row["public_user_id"],
        "display_name":   row["display_name"],
        "has_photo":      has_photo,
        "photo_version":  row["photo_version"],
    }


@router.post("/request")
async def send_friend_request(
    payload: SendRequestPayload,
    x_device_token: Optional[str] = Header(None),
) -> dict:
    """
    Send a friend request. X-Device-Token required for from_user_id.
    All guards (self-request, duplicate, reverse-pending, already-friends)
    run inside db_write() to prevent races.
    """
    now_utc = datetime.now(timezone.utc).isoformat()
    normalized_target = payload.to_public_id.strip().upper()

    with db_write() as conn:
        require_token_db(conn, payload.from_user_id, x_device_token)

        to_row = conn.execute(
            "SELECT user_id, public_user_id FROM users WHERE UPPER(public_user_id) = ?",
            (normalized_target,),
        ).fetchone()
        if not to_row:
            raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı")

        to_user_id   = to_row["user_id"]
        to_public_id = to_row["public_user_id"]

        if to_user_id == payload.from_user_id:
            raise HTTPException(status_code=400, detail="Kendinize istek gönderemezsiniz")

        ua, ub = sorted([payload.from_user_id, to_user_id])
        already_friends = conn.execute(
            "SELECT 1 FROM friendships WHERE user_a = ? AND user_b = ?", (ua, ub)
        ).fetchone()
        if already_friends:
            raise HTTPException(status_code=400, detail="Zaten arkadaşsınız")

        # Check existing pending request in both directions
        existing = conn.execute(
            """
            SELECT from_user_id, to_user_id FROM friend_requests
            WHERE status = 'pending'
              AND (
                (from_user_id = ? AND to_user_id = ?) OR
                (from_user_id = ? AND to_user_id = ?)
              )
            LIMIT 1
            """,
            (payload.from_user_id, to_user_id, to_user_id, payload.from_user_id),
        ).fetchone()
        if existing:
            if existing["from_user_id"] == payload.from_user_id:
                raise HTTPException(status_code=400, detail="Zaten bekleyen bir istek var")
            else:
                raise HTTPException(status_code=400, detail="Bu kullanıcı sana zaten istek gönderdi")

        req_id = str(uuid.uuid4())
        conn.execute(
            """
            INSERT INTO friend_requests
                (id, from_user_id, from_public_id, from_name,
                 to_user_id, to_public_id, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
            """,
            (
                req_id,
                payload.from_user_id, payload.from_public_id, payload.from_name,
                to_user_id, to_public_id,
                now_utc,
            ),
        )

    return {"status": "sent", "request_id": req_id}


@router.get("/incoming")
async def get_incoming_requests(
    user_id: str = Query(..., min_length=1),
    x_device_token: Optional[str] = Header(None),
) -> list:
    """Personal data — X-Device-Token required. Returns pending incoming requests."""
    with db_read() as conn:
        require_token_db(conn, user_id, x_device_token)
        rows = conn.execute(
            """
            SELECT id, from_user_id, from_public_id, from_name,
                   to_user_id, to_public_id, status, created_at, responded_at
            FROM friend_requests
            WHERE to_user_id = ? AND status = 'pending'
            ORDER BY created_at DESC
            """,
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.get("/outgoing")
async def get_outgoing_requests(
    user_id: str = Query(..., min_length=1),
    x_device_token: Optional[str] = Header(None),
) -> list:
    """Personal data — X-Device-Token required. Returns pending outgoing requests."""
    with db_read() as conn:
        require_token_db(conn, user_id, x_device_token)
        rows = conn.execute(
            """
            SELECT id, from_user_id, from_public_id, from_name,
                   to_user_id, to_public_id, status, created_at, responded_at
            FROM friend_requests
            WHERE from_user_id = ? AND status = 'pending'
            ORDER BY created_at DESC
            """,
            (user_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/respond")
async def respond_to_request(
    payload: RespondPayload,
    x_device_token: Optional[str] = Header(None),
) -> dict:
    """
    Accept or reject a pending friend request.
    Only the target user may respond; validated via X-Device-Token.
    Duplicate friendship guard runs inside db_write().
    """
    now_utc = datetime.now(timezone.utc).isoformat()

    with db_write() as conn:
        require_token_db(conn, payload.user_id, x_device_token)

        req = conn.execute(
            "SELECT * FROM friend_requests WHERE id = ?", (payload.request_id,)
        ).fetchone()
        if not req:
            raise HTTPException(status_code=404, detail="İstek bulunamadı")
        if req["to_user_id"] != payload.user_id:
            raise HTTPException(status_code=403, detail="Bu isteğe yanıt verme yetkiniz yok")
        if req["status"] != "pending":
            raise HTTPException(status_code=400, detail="Bu istek zaten yanıtlandı")

        new_status = "accepted" if payload.accept else "rejected"
        conn.execute(
            "UPDATE friend_requests SET status = ?, responded_at = ? WHERE id = ?",
            (new_status, now_utc, payload.request_id),
        )

        if payload.accept:
            ua, ub = sorted([req["from_user_id"], req["to_user_id"]])
            conn.execute(
                "INSERT OR IGNORE INTO friendships (user_a, user_b, created_at) VALUES (?, ?, ?)",
                (ua, ub, now_utc),
            )

    return {"status": new_status}


@router.get("/list")
async def get_friends_list(
    user_id: str = Query(..., min_length=1),
    x_device_token: Optional[str] = Header(None),
) -> list:
    """Personal data — X-Device-Token required. Returns accepted friends list."""
    with db_read() as conn:
        require_token_db(conn, user_id, x_device_token)
        rows = conn.execute(
            """
            SELECT u.user_id, u.public_user_id, u.display_name,
                   u.photo_path, u.photo_version
            FROM friendships f
            JOIN users u
              ON u.user_id = CASE WHEN f.user_a = ? THEN f.user_b ELSE f.user_a END
            WHERE f.user_a = ? OR f.user_b = ?
            ORDER BY u.display_name
            """,
            (user_id, user_id, user_id),
        ).fetchall()

    result = []
    for r in rows:
        has_photo = bool(r["photo_path"]) or _photo_path_for(r["user_id"]) is not None
        result.append({
            "user_id":        r["user_id"],
            "public_user_id": r["public_user_id"],
            "display_name":   r["display_name"],
            "has_photo":      has_photo,
            "photo_version":  r["photo_version"],
        })
    return result
