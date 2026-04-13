import json
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock
from typing import Protocol, Sequence


@dataclass(slots=True)
class StoredSleepSummary:
    user_id: str
    sleep_day: str
    primary_source: str
    bedtime: str
    wake_time: str
    total_sleep_minutes: int
    time_in_bed_minutes: int | None
    awake_minutes: int | None
    rem_minutes: int | None
    core_minutes: int | None
    deep_minutes: int | None
    awakenings_count: int | None
    manual_quality_score: int | None
    trend_3d_average: float | None
    trend_7d_average: float | None
    bedtime_trend: str | None
    is_stage_data_available: bool
    is_manual: bool
    confidence_level: str
    last_synced_at: str
    created_at: str
    updated_at: str


class SleepStore(Protocol):
    async def get_summary(self, user_id: str, sleep_day: str) -> StoredSleepSummary | None:
        """Return a single stored sleep summary."""

    async def upsert_summary(self, summary: StoredSleepSummary) -> StoredSleepSummary:
        """Create or update a stored sleep summary."""

    async def list_summaries(self, user_id: str, start_day: str, end_day: str) -> Sequence[StoredSleepSummary]:
        """Return stored sleep summaries between the provided dates."""


class JsonSleepStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self._file_path.exists():
            self._write_records({})

    async def get_summary(self, user_id: str, sleep_day: str) -> StoredSleepSummary | None:
        with self._lock:
            records = self._read_records()

        payload = records.get(user_id, {}).get(sleep_day)
        if payload is None:
            return None
        return self._deserialize_summary(payload)

    async def upsert_summary(self, summary: StoredSleepSummary) -> StoredSleepSummary:
        with self._lock:
            records = self._read_records()
            user_records = records.setdefault(summary.user_id, {})
            user_records[summary.sleep_day] = asdict(summary)
            self._write_records(records)
        return summary

    async def list_summaries(self, user_id: str, start_day: str, end_day: str) -> Sequence[StoredSleepSummary]:
        with self._lock:
            records = self._read_records()

        user_records = records.get(user_id, {})
        items = [
            self._deserialize_summary(payload)
            for sleep_day, payload in user_records.items()
            if start_day <= sleep_day <= end_day
        ]
        items.sort(key=lambda item: item.sleep_day)
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
    def _deserialize_summary(payload: dict) -> StoredSleepSummary:
        return StoredSleepSummary(
            user_id=payload["user_id"],
            sleep_day=payload["sleep_day"],
            primary_source=payload["primary_source"],
            bedtime=payload["bedtime"],
            wake_time=payload["wake_time"],
            total_sleep_minutes=int(payload["total_sleep_minutes"]),
            time_in_bed_minutes=payload.get("time_in_bed_minutes"),
            awake_minutes=payload.get("awake_minutes"),
            rem_minutes=payload.get("rem_minutes"),
            core_minutes=payload.get("core_minutes"),
            deep_minutes=payload.get("deep_minutes"),
            awakenings_count=payload.get("awakenings_count"),
            manual_quality_score=payload.get("manual_quality_score"),
            trend_3d_average=payload.get("trend_3d_average"),
            trend_7d_average=payload.get("trend_7d_average"),
            bedtime_trend=payload.get("bedtime_trend"),
            is_stage_data_available=bool(payload.get("is_stage_data_available", False)),
            is_manual=bool(payload.get("is_manual", False)),
            confidence_level=payload.get("confidence_level", "low"),
            last_synced_at=payload["last_synced_at"],
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
        )
