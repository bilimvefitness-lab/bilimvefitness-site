import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from threading import Lock


@dataclass(slots=True)
class StoredFavoriteFood:
    quick_add_id: str
    canonical_food_id: str | None
    display_name_tr: str
    quick_text: str
    meal_type_hint: str | None
    created_at: str
    updated_at: str


@dataclass(slots=True)
class StoredFavoriteMeal:
    template_id: str
    title: str
    quick_text: str
    meal_type: str | None
    item_count: int
    created_at: str
    updated_at: str


@dataclass(slots=True)
class StoredQuickAddProfile:
    user_id: str
    favorite_foods: list[StoredFavoriteFood] = field(default_factory=list)
    favorite_meals: list[StoredFavoriteMeal] = field(default_factory=list)


class JsonQuickAddStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self._file_path.exists():
            self._write_records({})

    async def get_profile(self, user_id: str) -> StoredQuickAddProfile:
        with self._lock:
            records = self._read_records()
        profile = records.get(user_id)
        if not profile:
            return StoredQuickAddProfile(user_id=user_id)
        return self._deserialize_profile(user_id, profile)

    async def save_profile(self, profile: StoredQuickAddProfile) -> None:
        with self._lock:
            records = self._read_records()
            records[profile.user_id] = {
                "favorite_foods": [asdict(item) for item in profile.favorite_foods],
                "favorite_meals": [asdict(item) for item in profile.favorite_meals],
            }
            self._write_records(records)

    def _read_records(self) -> dict:
        try:
            content = self._file_path.read_text(encoding="utf-8-sig")
        except FileNotFoundError:
            return {}
        if not content.strip():
            return {}
        return json.loads(content)

    def _write_records(self, records: dict) -> None:
        self._file_path.write_text(
            json.dumps(records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _deserialize_profile(self, user_id: str, payload: dict) -> StoredQuickAddProfile:
        return StoredQuickAddProfile(
            user_id=user_id,
            favorite_foods=[
                StoredFavoriteFood(
                    quick_add_id=item["quick_add_id"],
                    canonical_food_id=item.get("canonical_food_id"),
                    display_name_tr=item["display_name_tr"],
                    quick_text=item["quick_text"],
                    meal_type_hint=item.get("meal_type_hint"),
                    created_at=item["created_at"],
                    updated_at=item["updated_at"],
                )
                for item in payload.get("favorite_foods", [])
            ],
            favorite_meals=[
                StoredFavoriteMeal(
                    template_id=item["template_id"],
                    title=item["title"],
                    quick_text=item["quick_text"],
                    meal_type=item.get("meal_type"),
                    item_count=item.get("item_count", 0),
                    created_at=item["created_at"],
                    updated_at=item["updated_at"],
                )
                for item in payload.get("favorite_meals", [])
            ],
        )
