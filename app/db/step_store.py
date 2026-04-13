import json
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock
from typing import Protocol, Sequence


@dataclass(slots=True)
class StoredStepRecord:
    user_id: str
    date: str
    step_count: int
    source: str
    last_synced_at: str
    created_at: str
    updated_at: str


class StepStore(Protocol):
    async def get_record(self, user_id: str, date: str) -> StoredStepRecord | None:
        """Return a single stored step record."""

    async def upsert_record(self, record: StoredStepRecord) -> StoredStepRecord:
        """Create or update a step record."""

    async def list_records(self, user_id: str, start_date: str, end_date: str) -> Sequence[StoredStepRecord]:
        """Return step records between the provided dates."""

    async def list_daily_ranking(self, date: str) -> Sequence[StoredStepRecord]:
        """Return all records for a given day ordered by step count."""


class JsonStepStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self._file_path.exists():
            self._write_records({})

    async def get_record(self, user_id: str, date: str) -> StoredStepRecord | None:
        with self._lock:
            records = self._read_records()

        payload = records.get(user_id, {}).get(date)
        if payload is None:
            return None
        return self._deserialize_record(payload)

    async def upsert_record(self, record: StoredStepRecord) -> StoredStepRecord:
        with self._lock:
            records = self._read_records()
            user_records = records.setdefault(record.user_id, {})
            user_records[record.date] = asdict(record)
            self._write_records(records)
        return record

    async def list_records(self, user_id: str, start_date: str, end_date: str) -> Sequence[StoredStepRecord]:
        with self._lock:
            records = self._read_records()

        user_records = records.get(user_id, {})
        items = [
            self._deserialize_record(payload)
            for date_key, payload in user_records.items()
            if start_date <= date_key <= end_date
        ]
        items.sort(key=lambda item: item.date)
        return items

    async def list_daily_ranking(self, date: str) -> Sequence[StoredStepRecord]:
        with self._lock:
            records = self._read_records()

        items: list[StoredStepRecord] = []
        for user_records in records.values():
            payload = user_records.get(date)
            if payload is None:
                continue
            items.append(self._deserialize_record(payload))

        items.sort(key=lambda item: (-item.step_count, item.user_id))
        return items

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
    def _deserialize_record(payload: dict) -> StoredStepRecord:
        return StoredStepRecord(
            user_id=payload["user_id"],
            date=payload["date"],
            step_count=int(payload["step_count"]),
            source=payload["source"],
            last_synced_at=payload["last_synced_at"],
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
        )
