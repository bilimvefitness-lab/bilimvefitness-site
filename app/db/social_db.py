"""
social_db.py — Centralised SQLite access layer for the social/friends domain.

All tables defined here. Both friends.py and social.py import from this module.

═══════════════════════════════════════════════════════════════════════
CONCURRENCY MODEL
═══════════════════════════════════════════════════════════════════════

WAL mode:
  Enables concurrent readers.  Writers still serialise (SQLite limitation).
  Eliminates the need for portalocker on a single-host deployment.

Threading lock:
  A module-level threading.Lock serialises all write paths within one
  process.  This is defence-in-depth on top of WAL's writer serialisation.
  Reads do NOT acquire the lock (WAL is safe for concurrent reads).

busy_timeout = 10 s:
  SQLite retries automatically if another writer holds the lock, so
  transient "database is locked" errors are avoided in practice.

═══════════════════════════════════════════════════════════════════════
TABLES
═══════════════════════════════════════════════════════════════════════

  users                   — identity, device token, photo metadata
  friend_requests         — pending / accepted / rejected requests
  friendships             — canonical accepted friendship pairs (user_a < user_b)
  daily_social_scores     — one row per (user_id, score_date)
  challenges              — challenge definitions
  challenge_participants  — many-to-many: challenge ↔ user
  challenge_progress      — one row per (challenge_id, user_id, date)
  steps                   — synced step counts (read-only for social scoring)

═══════════════════════════════════════════════════════════════════════
MIGRATION
═══════════════════════════════════════════════════════════════════════

migrate_from_json() is idempotent.  It reads each legacy JSON file once
and inserts rows with INSERT OR IGNORE.  Existing SQLite rows are never
overwritten, so the function can be called at every startup safely.
"""

import json
import logging
import random
import sqlite3
import threading
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import HTTPException

log = logging.getLogger(__name__)

_DB_PATH    = Path(__file__).resolve().parents[2] / "data" / "social.db"
_DATA_DIR   = _DB_PATH.parent
_WRITE_LOCK = threading.Lock()


# ── Connection factory ────────────────────────────────────────────────────────

def _connect() -> sqlite3.Connection:
    _DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(_DB_PATH), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.execute("PRAGMA busy_timeout=10000")
    return conn


@contextmanager
def db_write():
    """
    Serialised write transaction.

    Acquires the module-level threading.Lock and wraps the body in an
    explicit SQLite transaction.  Commits on clean exit; rolls back on
    any exception.  Callers must NOT call conn.commit() themselves.
    """
    with _WRITE_LOCK:
        conn = _connect()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


@contextmanager
def db_read():
    """
    Read-only connection.  No lock — WAL mode allows concurrent readers.
    """
    conn = _connect()
    try:
        yield conn
    finally:
        conn.close()


# ── Schema ────────────────────────────────────────────────────────────────────

_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS users (
    user_id        TEXT PRIMARY KEY,
    public_user_id TEXT UNIQUE NOT NULL,
    device_token   TEXT NOT NULL,
    display_name   TEXT NOT NULL DEFAULT '',
    photo_path     TEXT,
    photo_version  INTEGER NOT NULL DEFAULT 0,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS friend_requests (
    id             TEXT PRIMARY KEY,
    from_user_id   TEXT NOT NULL,
    from_public_id TEXT NOT NULL DEFAULT '',
    from_name      TEXT NOT NULL DEFAULT '',
    to_user_id     TEXT NOT NULL,
    to_public_id   TEXT NOT NULL DEFAULT '',
    status         TEXT NOT NULL DEFAULT 'pending',
    created_at     TEXT NOT NULL,
    responded_at   TEXT
);

CREATE TABLE IF NOT EXISTS friendships (
    user_a     TEXT NOT NULL,
    user_b     TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS daily_social_scores (
    user_id           TEXT    NOT NULL,
    score_date        TEXT    NOT NULL,
    steps             INTEGER NOT NULL DEFAULT 0,
    steps_raw         INTEGER,
    steps_source      TEXT    NOT NULL DEFAULT 'client',
    water_consumed_ml INTEGER NOT NULL DEFAULT 0,
    water_target_ml   INTEGER NOT NULL DEFAULT 2500,
    nutrition_meals   INTEGER NOT NULL DEFAULT 0,
    sleep_minutes     INTEGER NOT NULL DEFAULT 0,
    steps_complete    INTEGER NOT NULL DEFAULT 0,
    water_complete    INTEGER NOT NULL DEFAULT 0,
    nutrition_logged  INTEGER NOT NULL DEFAULT 0,
    sleep_logged      INTEGER NOT NULL DEFAULT 0,
    all_complete      INTEGER NOT NULL DEFAULT 0,
    streak_days       INTEGER NOT NULL DEFAULT 0,
    score             INTEGER NOT NULL DEFAULT 0,
    submitted_at      TEXT    NOT NULL,
    PRIMARY KEY (user_id, score_date)
);

CREATE TABLE IF NOT EXISTS challenges (
    id             TEXT    PRIMARY KEY,
    challenge_type TEXT    NOT NULL,
    title          TEXT    NOT NULL,
    creator_id     TEXT    NOT NULL,
    start_date     TEXT    NOT NULL,
    end_date       TEXT    NOT NULL,
    duration_days  INTEGER NOT NULL DEFAULT 7,
    status         TEXT    NOT NULL DEFAULT 'active',
    created_at     TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS challenge_participants (
    challenge_id TEXT NOT NULL,
    user_id      TEXT NOT NULL,
    joined_at    TEXT NOT NULL,
    PRIMARY KEY (challenge_id, user_id)
);

CREATE TABLE IF NOT EXISTS challenge_progress (
    challenge_id  TEXT NOT NULL,
    user_id       TEXT NOT NULL,
    progress_date TEXT NOT NULL,
    value         REAL NOT NULL DEFAULT 0.0,
    updated_at    TEXT NOT NULL,
    PRIMARY KEY (challenge_id, user_id, progress_date)
);

CREATE TABLE IF NOT EXISTS steps (
    user_id    TEXT NOT NULL,
    step_date  TEXT NOT NULL,
    step_count INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, step_date)
);

-- Indexes for common read patterns
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_public_user_id
    ON users(public_user_id);

CREATE INDEX IF NOT EXISTS idx_freq_from
    ON friend_requests(from_user_id, status);

CREATE INDEX IF NOT EXISTS idx_freq_to
    ON friend_requests(to_user_id, status);

CREATE INDEX IF NOT EXISTS idx_dss_date
    ON daily_social_scores(score_date);

CREATE INDEX IF NOT EXISTS idx_ch_status
    ON challenges(status);

CREATE INDEX IF NOT EXISTS idx_cp_challenge
    ON challenge_progress(challenge_id);

CREATE INDEX IF NOT EXISTS idx_steps_user_date
    ON steps(user_id, step_date);
"""


def init_schema() -> None:
    """Create all tables and indexes if they don't exist.  Idempotent."""
    with db_write() as conn:
        conn.executescript(_SCHEMA_SQL)
    log.info("[social_db] Schema initialised at %s", _DB_PATH)


# ── Shared auth helper ────────────────────────────────────────────────────────

def require_token_db(conn: sqlite3.Connection, user_id: str, token: Optional[str]) -> None:
    """
    Validate X-Device-Token for user_id against the users table.

    Raises HTTP 401 on:
      - missing token
      - unknown user_id
      - token mismatch
      - stored token is empty (self-healing: call POST /friends/public-id)
    """
    if not token:
        raise HTTPException(status_code=401, detail="Kimlik doğrulama gerekli")
    row = conn.execute(
        "SELECT device_token FROM users WHERE user_id = ?", (user_id,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Kullanıcı bulunamadı")
    stored = row["device_token"] or ""
    if not stored:
        raise HTTPException(
            status_code=401,
            detail="Oturum bulunamadı. Uygulamayı yeniden başlatın.",
        )
    if stored != token:
        raise HTTPException(
            status_code=401,
            detail="Geçersiz oturum. Uygulamayı yeniden başlatın.",
        )


# ── Public ID generation ──────────────────────────────────────────────────────

def generate_public_id(conn: sqlite3.Connection) -> str:
    """
    Generate a unique AG-XXXXXX identifier not already in users.public_user_id.
    Attempts up to 30 random draws; raises ValueError if all collide (pathological).
    Must be called inside a db_write() block.
    """
    for _ in range(30):
        pid = f"AG-{random.randint(100_000, 999_999)}"
        exists = conn.execute(
            "SELECT 1 FROM users WHERE public_user_id = ?", (pid,)
        ).fetchone()
        if not exists:
            return pid
    raise ValueError("ID generation failed after 30 attempts")


# ── JSON → SQLite migration ───────────────────────────────────────────────────

def _load_json(name: str) -> dict | list:
    """Load a JSON file from data/. Returns {} or [] on missing / corrupt file."""
    p = _DATA_DIR / name
    if not p.exists():
        return {}
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except Exception as exc:
        log.warning("[social_db] Cannot read %s: %s", name, exc)
        return {}


def migrate_from_json() -> dict:
    """
    One-time migration of legacy JSON data into SQLite.

    Strategy:
      - INSERT OR IGNORE for all tables — existing rows are NEVER overwritten.
      - Safe to call at every startup; subsequent calls are no-ops for existing data.
      - Returns a summary dict: { table: { "migrated": N, "skipped": N } }

    Duplicate-insert prevention:
      SQLite's PRIMARY KEY and UNIQUE constraints reject duplicate rows at the
      DB level.  INSERT OR IGNORE silently skips any row whose primary key or
      unique-indexed column already exists, so the migration is strictly additive.

    JSON sources consumed:
      public_ids.json       → users
      friends.json          → friend_requests, friendships
      social_scores.json    → daily_social_scores
      challenges.json       → challenges, challenge_participants
      challenge_progress.json → challenge_progress
      steps.json            → steps
    """
    now_utc = datetime.now(timezone.utc).isoformat()

    tables = [
        "users", "friend_requests", "friendships",
        "daily_social_scores", "challenges",
        "challenge_participants", "challenge_progress", "steps",
    ]
    migrated = {t: 0 for t in tables}
    skipped  = {t: 0 for t in tables}

    def _track(table: str, rowcount: int) -> None:
        if rowcount > 0:
            migrated[table] += 1
        else:
            skipped[table] += 1

    with db_write() as conn:

        # ── 1. Users from public_ids.json ─────────────────────────────────────
        ids: dict = _load_json("public_ids.json")
        for user_id, entry in ids.items():
            # Resolve current photo path from disk (versioned directory)
            photo_path = _find_latest_photo(user_id)
            r = conn.execute(
                """
                INSERT OR IGNORE INTO users
                    (user_id, public_user_id, device_token, display_name,
                     photo_path, photo_version, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    user_id,
                    entry.get("public_id", ""),
                    entry.get("device_token", ""),
                    entry.get("display_name", ""),
                    str(photo_path) if photo_path else None,
                    entry.get("photo_version", 0),
                    entry.get("created_at", now_utc),
                    now_utc,
                ),
            )
            _track("users", r.rowcount)

        # ── 2. Friend requests + friendships from friends.json ────────────────
        friends_data: dict = _load_json("friends.json")
        for req in friends_data.get("requests", []):
            r = conn.execute(
                """
                INSERT OR IGNORE INTO friend_requests
                    (id, from_user_id, from_public_id, from_name,
                     to_user_id, to_public_id, status, created_at, responded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    req.get("id"), req.get("from_user_id"), req.get("from_public_id", ""),
                    req.get("from_name", ""), req.get("to_user_id"), req.get("to_public_id", ""),
                    req.get("status", "pending"), req.get("created_at", now_utc),
                    req.get("responded_at"),
                ),
            )
            _track("friend_requests", r.rowcount)

        for fship in friends_data.get("friendships", []):
            ua, ub = sorted([fship.get("user_a", ""), fship.get("user_b", "")])
            r = conn.execute(
                "INSERT OR IGNORE INTO friendships (user_a, user_b, created_at) VALUES (?, ?, ?)",
                (ua, ub, fship.get("created_at", now_utc)),
            )
            _track("friendships", r.rowcount)

        # ── 3. Daily social scores ────────────────────────────────────────────
        scores: dict = _load_json("social_scores.json")
        for user_id, date_map in scores.items():
            for score_date, d in date_map.items():
                r = conn.execute(
                    """
                    INSERT OR IGNORE INTO daily_social_scores
                        (user_id, score_date, steps, steps_raw, steps_source,
                         water_consumed_ml, water_target_ml, nutrition_meals, sleep_minutes,
                         steps_complete, water_complete, nutrition_logged, sleep_logged,
                         all_complete, streak_days, score, submitted_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        user_id, score_date,
                        d.get("steps", 0), d.get("steps_raw"),
                        d.get("steps_source", "client"),
                        d.get("water_consumed_ml", 0), d.get("water_target_ml", 2500),
                        d.get("nutrition_meals", 0), d.get("sleep_minutes", 0),
                        int(bool(d.get("steps_complete"))),
                        int(bool(d.get("water_complete"))),
                        int(bool(d.get("nutrition_logged"))),
                        int(bool(d.get("sleep_logged"))),
                        int(bool(d.get("all_complete"))),
                        d.get("streak_days", 0), d.get("score", 0),
                        d.get("submitted_at", now_utc),
                    ),
                )
                _track("daily_social_scores", r.rowcount)

        # ── 4. Challenges + participants ──────────────────────────────────────
        challenges: dict = _load_json("challenges.json")
        for cid, ch in challenges.items():
            r = conn.execute(
                """
                INSERT OR IGNORE INTO challenges
                    (id, challenge_type, title, creator_id,
                     start_date, end_date, duration_days, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    cid, ch.get("type", ""), ch.get("title", ""),
                    ch.get("creator_id", ""), ch.get("start_date", ""),
                    ch.get("end_date", ""), ch.get("duration_days", 7),
                    ch.get("status", "active"), ch.get("created_at", now_utc),
                ),
            )
            _track("challenges", r.rowcount)

            for uid in ch.get("participants", []):
                r = conn.execute(
                    """
                    INSERT OR IGNORE INTO challenge_participants
                        (challenge_id, user_id, joined_at)
                    VALUES (?, ?, ?)
                    """,
                    (cid, uid, ch.get("created_at", now_utc)),
                )
                _track("challenge_participants", r.rowcount)

        # ── 5. Challenge progress ─────────────────────────────────────────────
        progress: dict = _load_json("challenge_progress.json")
        for cid, user_map in progress.items():
            for uid, date_map in user_map.items():
                for prog_date, entry in date_map.items():
                    r = conn.execute(
                        """
                        INSERT OR IGNORE INTO challenge_progress
                            (challenge_id, user_id, progress_date, value, updated_at)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (
                            cid, uid, prog_date,
                            entry.get("value", 0.0),
                            entry.get("updated_at", now_utc),
                        ),
                    )
                    _track("challenge_progress", r.rowcount)

        # ── 6. Steps ─────────────────────────────────────────────────────────
        steps_data: dict = _load_json("steps.json")
        for user_id, date_map in steps_data.items():
            for step_date, entry in date_map.items():
                r = conn.execute(
                    """
                    INSERT OR IGNORE INTO steps (user_id, step_date, step_count)
                    VALUES (?, ?, ?)
                    """,
                    (user_id, step_date, entry.get("step_count", 0)),
                )
                _track("steps", r.rowcount)

    summary = {t: {"migrated": migrated[t], "skipped": skipped[t]} for t in tables}
    log.info("[social_db] Migration complete: %s", summary)
    return summary


# ── Photo path helper ─────────────────────────────────────────────────────────

_PHOTOS_DIR          = _DATA_DIR / "photos"
_ALLOWED_PHOTO_EXTS  = {".jpg", ".jpeg", ".png", ".webp"}


def _find_latest_photo(user_id: str) -> Optional[Path]:
    """
    Scan data/photos/{user_id}/ for the newest versioned photo file.
    Returns None if the directory is empty or absent.
    Used only during migration and as a fallback.
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
