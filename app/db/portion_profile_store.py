import json
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock
from typing import Protocol


@dataclass(slots=True)
class StoredPortionProfile:
    user_id: str
    canonical_food_id: str
    unit: str
    modifiers_key: str
    average_weight_g: float
    sample_count: int
    min_observed_weight_g: float
    max_observed_weight_g: float
    last_updated_at: str


class PortionProfileStore(Protocol):
    async def get_profile(
        self,
        user_id: str,
        canonical_food_id: str,
        unit: str,
        modifiers_key: str,
    ) -> StoredPortionProfile | None:
        """Return a learned portion profile for the user."""

    async def save_profile(self, profile: StoredPortionProfile) -> None:
        """Persist a learned portion profile."""


class JsonPortionProfileStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self._file_path.exists():
            self._write_records([])

    async def get_profile(
        self,
        user_id: str,
        canonical_food_id: str,
        unit: str,
        modifiers_key: str,
    ) -> StoredPortionProfile | None:
        with self._lock:
            records = self._read_records()

        for record in records:
            if (
                record.get("user_id") == user_id
                and record.get("canonical_food_id") == canonical_food_id
                and record.get("unit") == unit
                and record.get("modifiers_key") == modifiers_key
            ):
                return self._deserialize(record)
        return None

    async def save_profile(self, profile: StoredPortionProfile) -> None:
        with self._lock:
            records = self._read_records()
            replaced = False
            for index, record in enumerate(records):
                if (
                    record.get("user_id") == profile.user_id
                    and record.get("canonical_food_id") == profile.canonical_food_id
                    and record.get("unit") == profile.unit
                    and record.get("modifiers_key") == profile.modifiers_key
                ):
                    records[index] = asdict(profile)
                    replaced = True
                    break

            if not replaced:
                records.append(asdict(profile))

            self._write_records(records)

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

    def _deserialize(self, record: dict) -> StoredPortionProfile:
        return StoredPortionProfile(
            user_id=record["user_id"],
            canonical_food_id=record["canonical_food_id"],
            unit=record["unit"],
            modifiers_key=record["modifiers_key"],
            average_weight_g=record["average_weight_g"],
            sample_count=record["sample_count"],
            min_observed_weight_g=record["min_observed_weight_g"],
            max_observed_weight_g=record["max_observed_weight_g"],
            last_updated_at=record.get("last_updated_at", datetime.now(timezone.utc).isoformat()),
        )
