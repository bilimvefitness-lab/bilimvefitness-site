import json
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock
from typing import Protocol, Sequence


@dataclass(slots=True)
class StoredDailyActionRecord:
    user_id: str
    date: str
    action_id: str
    action_type: str
    label: str
    shown_at: str
    clicked_count: int = 0
    completed_count: int = 0
    last_clicked_at: str | None = None
    last_completed_at: str | None = None


class ActionTrackingStore(Protocol):
    async def upsert_action(self, record: StoredDailyActionRecord) -> StoredDailyActionRecord:
        """Create or update a daily action record."""

    async def get_actions_for_date(self, date: str, user_id: str) -> Sequence[StoredDailyActionRecord]:
        """Return action records for a date."""

    async def get_recent_actions(
        self,
        *,
        user_id: str,
        before_date: str,
        action_type: str | None = None,
        limit: int = 7,
    ) -> Sequence[StoredDailyActionRecord]:
        """Return recent actions before a date."""


class JsonActionTrackingStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self._file_path.exists():
            self._write_records([])

    async def upsert_action(self, record: StoredDailyActionRecord) -> StoredDailyActionRecord:
        with self._lock:
            records = self._read_records()
            for index, existing in enumerate(records):
                if (
                    existing.get("user_id") == record.user_id
                    and existing.get("date") == record.date
                    and existing.get("action_id") == record.action_id
                ):
                    records[index] = asdict(record)
                    self._write_records(records)
                    return record
            records.append(asdict(record))
            self._write_records(records)
        return record

    async def get_actions_for_date(self, date: str, user_id: str) -> Sequence[StoredDailyActionRecord]:
        with self._lock:
            records = self._read_records()
        actions = [
            self._deserialize(record)
            for record in records
            if record.get("user_id") == user_id and record.get("date") == date
        ]
        actions.sort(key=lambda item: item.shown_at)
        return actions

    async def get_recent_actions(
        self,
        *,
        user_id: str,
        before_date: str,
        action_type: str | None = None,
        limit: int = 7,
    ) -> Sequence[StoredDailyActionRecord]:
        with self._lock:
            records = self._read_records()
        actions = [
            self._deserialize(record)
            for record in records
            if record.get("user_id") == user_id
            and str(record.get("date", "")) < before_date
            and (action_type is None or record.get("action_type") == action_type)
        ]
        actions.sort(key=lambda item: item.date, reverse=True)
        return actions[:limit]

    def _read_records(self) -> list[dict]:
        try:
            content = self._file_path.read_text(encoding="utf-8-sig")
        except FileNotFoundError:
            return []
        if not content.strip():
            return []
        return json.loads(content)

    def _write_records(self, records: list[dict]) -> None:
        self._file_path.write_text(
            json.dumps(records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @staticmethod
    def _deserialize(payload: dict) -> StoredDailyActionRecord:
        return StoredDailyActionRecord(
            user_id=payload["user_id"],
            date=payload["date"],
            action_id=payload["action_id"],
            action_type=payload["action_type"],
            label=payload["label"],
            shown_at=payload["shown_at"],
            clicked_count=int(payload.get("clicked_count", 0)),
            completed_count=int(payload.get("completed_count", 0)),
            last_clicked_at=payload.get("last_clicked_at"),
            last_completed_at=payload.get("last_completed_at"),
        )
