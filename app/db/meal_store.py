import json
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock
from typing import Protocol, Sequence


@dataclass(slots=True)
class StoredMealEntryItem:
    raw_text: str
    canonical_food_id: str
    canonical_display_name: str
    amount: float | None
    unit: str | None
    estimated_weight_g: float
    estimated_weight_min_g: float | None
    estimated_weight_max_g: float | None
    portion_source: str | None
    user_history_samples: int | None
    confidence_level: str
    confidence_score: float
    kcal: float
    protein_g: float
    carbs_g: float
    fat_g: float
    preparation_method: str | None = None
    modifiers: list[str] | None = None


@dataclass(slots=True)
class StoredMealEntry:
    meal_id: str
    user_id: str | None
    meal_type: str
    date: str
    consumed_at: str
    notes: str | None
    items: list[StoredMealEntryItem]
    total_kcal: float
    total_protein_g: float
    total_carbs_g: float
    total_fat_g: float
    created_at: str


class MealStore(Protocol):
    async def save_meal(self, record: StoredMealEntry) -> None:
        """Persist a meal log entry."""

    async def get_meals_for_date(self, date: str, user_id: str | None = None) -> Sequence[StoredMealEntry]:
        """Return meals logged on a specific date."""

    async def get_all_meals(self, user_id: str | None = None) -> Sequence[StoredMealEntry]:
        """Return all meals, optionally filtered by user."""


class InMemoryMealStore:
    def __init__(self) -> None:
        self._meals_by_date: dict[str, list[StoredMealEntry]] = {}

    async def save_meal(self, record: StoredMealEntry) -> None:
        self._meals_by_date.setdefault(record.date, []).append(record)

    async def get_meals_for_date(self, date: str, user_id: str | None = None) -> Sequence[StoredMealEntry]:
        meals = list(self._meals_by_date.get(date, []))
        if user_id is not None:
            meals = [meal for meal in meals if meal.user_id == user_id]
        return meals

    async def get_all_meals(self, user_id: str | None = None) -> Sequence[StoredMealEntry]:
        meals = [meal for day_meals in self._meals_by_date.values() for meal in day_meals]
        if user_id is not None:
            meals = [meal for meal in meals if meal.user_id == user_id]
        meals.sort(key=lambda item: item.consumed_at, reverse=True)
        return meals


class JsonMealStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self._file_path.exists():
            self._write_records([])

    async def save_meal(self, record: StoredMealEntry) -> None:
        with self._lock:
            records = self._read_records()
            records.append(asdict(record))
            self._write_records(records)

    async def get_meals_for_date(self, date: str, user_id: str | None = None) -> Sequence[StoredMealEntry]:
        with self._lock:
            records = self._read_records()

        meals = [
            self._deserialize(record)
            for record in records
            if record.get("date") == date and (user_id is None or record.get("user_id") == user_id)
        ]
        meals.sort(key=lambda item: item.consumed_at)
        return meals

    async def get_all_meals(self, user_id: str | None = None) -> Sequence[StoredMealEntry]:
        with self._lock:
            records = self._read_records()

        meals = [
            self._deserialize(record)
            for record in records
            if user_id is None or record.get("user_id") == user_id
        ]
        meals.sort(key=lambda item: item.consumed_at, reverse=True)
        return meals

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

    def _deserialize(self, record: dict) -> StoredMealEntry:
        return StoredMealEntry(
            meal_id=record["meal_id"],
            user_id=record.get("user_id"),
            meal_type=record["meal_type"],
            date=record["date"],
            consumed_at=record["consumed_at"],
            notes=record.get("notes"),
            items=[
                StoredMealEntryItem(
                    raw_text=item["raw_text"],
                    canonical_food_id=item["canonical_food_id"],
                    canonical_display_name=item["canonical_display_name"],
                    amount=item.get("amount"),
                    unit=item.get("unit"),
                    estimated_weight_g=item["estimated_weight_g"],
                    estimated_weight_min_g=item.get("estimated_weight_min_g"),
                    estimated_weight_max_g=item.get("estimated_weight_max_g"),
                    portion_source=item.get("portion_source"),
                    user_history_samples=item.get("user_history_samples"),
                    confidence_level=item["confidence_level"],
                    confidence_score=item["confidence_score"],
                    kcal=item["kcal"],
                    protein_g=item["protein_g"],
                    carbs_g=item["carbs_g"],
                    fat_g=item["fat_g"],
                    preparation_method=item.get("preparation_method"),
                    modifiers=item.get("modifiers"),
                )
                for item in record.get("items", [])
            ],
            total_kcal=record["total_kcal"],
            total_protein_g=record["total_protein_g"],
            total_carbs_g=record["total_carbs_g"],
            total_fat_g=record["total_fat_g"],
            created_at=record["created_at"],
        )
