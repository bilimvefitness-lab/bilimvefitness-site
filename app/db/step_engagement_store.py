import json
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock
from typing import Protocol


@dataclass(slots=True)
class StoredStepEngagementSnapshot:
    user_id: str
    date: str
    daily_task: dict
    achievements: list[dict]
    streak: dict
    prime_tone: str
    prime_message: str
    fomo_messages: list[str]
    leaderboard_rank: int | None
    session_summary: dict | None
    created_at: str
    updated_at: str


class StepEngagementStore(Protocol):
    async def get_snapshot(self, user_id: str, date: str) -> StoredStepEngagementSnapshot | None:
        """Return a stored engagement snapshot."""

    async def upsert_snapshot(
        self,
        snapshot: StoredStepEngagementSnapshot,
    ) -> StoredStepEngagementSnapshot:
        """Create or update a snapshot."""


class JsonStepEngagementStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self._file_path.exists():
            self._write_records({})

    async def get_snapshot(self, user_id: str, date: str) -> StoredStepEngagementSnapshot | None:
        with self._lock:
            records = self._read_records()

        payload = records.get(user_id, {}).get(date)
        if payload is None:
            return None
        return self._deserialize_snapshot(payload)

    async def upsert_snapshot(
        self,
        snapshot: StoredStepEngagementSnapshot,
    ) -> StoredStepEngagementSnapshot:
        with self._lock:
            records = self._read_records()
            user_records = records.setdefault(snapshot.user_id, {})
            user_records[snapshot.date] = asdict(snapshot)
            self._write_records(records)
        return snapshot

    def _read_records(self) -> dict[str, dict[str, dict]]:
        try:
            content = self._file_path.read_text(encoding="utf-8-sig")
        except FileNotFoundError:
            return {}
        if not content.strip():
            return {}
        return json.loads(content)

    def _write_records(self, records: dict[str, dict[str, dict]]) -> None:
        self._file_path.write_text(
            json.dumps(records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @staticmethod
    def _deserialize_snapshot(payload: dict) -> StoredStepEngagementSnapshot:
        return StoredStepEngagementSnapshot(
            user_id=payload["user_id"],
            date=payload["date"],
            daily_task=payload.get("daily_task") or {},
            achievements=payload.get("achievements") or [],
            streak=payload.get("streak") or {},
            prime_tone=payload.get("prime_tone") or "motive",
            prime_message=payload.get("prime_message") or "",
            fomo_messages=payload.get("fomo_messages") or [],
            leaderboard_rank=payload.get("leaderboard_rank"),
            session_summary=payload.get("session_summary"),
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
        )
