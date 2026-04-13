import json
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock
from typing import Protocol, Sequence


@dataclass(slots=True)
class StoredHydrationProfile:
    user_id: str
    weight_kg: float | None
    default_glass_ml: int
    target_mode: str
    manual_target_ml: int | None
    activity_adjustment_enabled: bool
    created_at: str
    updated_at: str


@dataclass(slots=True)
class StoredHydrationReminderSettings:
    user_id: str
    enabled: bool
    start_time: str
    end_time: str
    interval_minutes: int
    created_at: str
    updated_at: str


@dataclass(slots=True)
class StoredWaterLogEntry:
    id: str
    user_id: str
    amount_ml: int
    source_unit: str
    source_value: float
    logged_at: str
    note: str | None = None


class HydrationStore(Protocol):
    async def get_profile(self, user_id: str) -> StoredHydrationProfile | None:
        """Return hydration profile for the user."""

    async def save_profile(self, profile: StoredHydrationProfile) -> None:
        """Persist hydration profile."""

    async def get_reminder_settings(self, user_id: str) -> StoredHydrationReminderSettings | None:
        """Return reminder settings for the user."""

    async def save_reminder_settings(self, settings: StoredHydrationReminderSettings) -> None:
        """Persist reminder settings."""

    async def save_log(self, entry: StoredWaterLogEntry) -> None:
        """Persist a water log."""

    async def get_logs_for_date(self, date: str, user_id: str) -> Sequence[StoredWaterLogEntry]:
        """Return logs for a user and date."""

    async def get_all_logs(self, user_id: str) -> Sequence[StoredWaterLogEntry]:
        """Return all logs for a user."""

    async def delete_log(self, user_id: str, log_id: str) -> bool:
        """Delete a water log entry."""


class JsonHydrationStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self._file_path.exists():
            self._write_records({"profiles": {}, "reminder_settings": {}, "logs": []})

    async def get_profile(self, user_id: str) -> StoredHydrationProfile | None:
        with self._lock:
            records = self._read_records()
        payload = records.get("profiles", {}).get(user_id)
        if payload is None:
            return None
        return self._deserialize_profile(payload)

    async def save_profile(self, profile: StoredHydrationProfile) -> None:
        with self._lock:
            records = self._read_records()
            records.setdefault("profiles", {})[profile.user_id] = asdict(profile)
            self._write_records(records)

    async def get_reminder_settings(self, user_id: str) -> StoredHydrationReminderSettings | None:
        with self._lock:
            records = self._read_records()
        payload = records.get("reminder_settings", {}).get(user_id)
        if payload is None:
            return None
        return self._deserialize_reminder_settings(payload)

    async def save_reminder_settings(self, settings: StoredHydrationReminderSettings) -> None:
        with self._lock:
            records = self._read_records()
            records.setdefault("reminder_settings", {})[settings.user_id] = asdict(settings)
            self._write_records(records)

    async def save_log(self, entry: StoredWaterLogEntry) -> None:
        with self._lock:
            records = self._read_records()
            records.setdefault("logs", []).append(asdict(entry))
            self._write_records(records)

    async def get_logs_for_date(self, date: str, user_id: str) -> Sequence[StoredWaterLogEntry]:
        with self._lock:
            records = self._read_records()
        logs = [
            self._deserialize_log(item)
            for item in records.get("logs", [])
            if item.get("user_id") == user_id and str(item.get("logged_at", "")).startswith(date)
        ]
        logs.sort(key=lambda item: item.logged_at, reverse=True)
        return logs

    async def get_all_logs(self, user_id: str) -> Sequence[StoredWaterLogEntry]:
        with self._lock:
            records = self._read_records()
        logs = [
            self._deserialize_log(item)
            for item in records.get("logs", [])
            if item.get("user_id") == user_id
        ]
        logs.sort(key=lambda item: item.logged_at, reverse=True)
        return logs

    async def delete_log(self, user_id: str, log_id: str) -> bool:
        with self._lock:
            records = self._read_records()
            original_logs = records.get("logs", [])
            filtered_logs = [
                item
                for item in original_logs
                if not (item.get("user_id") == user_id and item.get("id") == log_id)
            ]
            deleted = len(filtered_logs) != len(original_logs)
            if deleted:
                records["logs"] = filtered_logs
                self._write_records(records)
        return deleted

    def _read_records(self) -> dict:
        try:
            content = self._file_path.read_text(encoding="utf-8-sig")
        except FileNotFoundError:
            return {"profiles": {}, "reminder_settings": {}, "logs": []}
        if not content.strip():
            return {"profiles": {}, "reminder_settings": {}, "logs": []}
        payload = json.loads(content)
        payload.setdefault("profiles", {})
        payload.setdefault("reminder_settings", {})
        payload.setdefault("logs", [])
        return payload

    def _write_records(self, records: dict) -> None:
        self._file_path.write_text(
            json.dumps(records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    @staticmethod
    def _deserialize_profile(payload: dict) -> StoredHydrationProfile:
        return StoredHydrationProfile(
            user_id=payload["user_id"],
            weight_kg=payload.get("weight_kg"),
            default_glass_ml=payload["default_glass_ml"],
            target_mode=payload["target_mode"],
            manual_target_ml=payload.get("manual_target_ml"),
            activity_adjustment_enabled=bool(payload.get("activity_adjustment_enabled", False)),
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
        )

    @staticmethod
    def _deserialize_reminder_settings(payload: dict) -> StoredHydrationReminderSettings:
        return StoredHydrationReminderSettings(
            user_id=payload["user_id"],
            enabled=bool(payload.get("enabled", False)),
            start_time=payload.get("start_time", "08:00"),
            end_time=payload.get("end_time", "22:00"),
            interval_minutes=int(payload.get("interval_minutes", 60)),
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
        )

    @staticmethod
    def _deserialize_log(payload: dict) -> StoredWaterLogEntry:
        return StoredWaterLogEntry(
            id=payload["id"],
            user_id=payload["user_id"],
            amount_ml=int(payload["amount_ml"]),
            source_unit=payload["source_unit"],
            source_value=float(payload["source_value"]),
            logged_at=payload["logged_at"],
            note=payload.get("note"),
        )
