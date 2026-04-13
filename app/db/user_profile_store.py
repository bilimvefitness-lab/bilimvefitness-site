import json
from dataclasses import asdict, dataclass
from pathlib import Path
from threading import Lock


@dataclass(slots=True)
class StoredMacroTarget:
    grams: float
    grams_per_kg: float
    calories: float
    rationale: str


@dataclass(slots=True)
class StoredGoalCalculation:
    bmr_kcal: float
    activity_multiplier: float
    tdee_kcal: float
    calorie_adjustment_kcal: float
    calorie_target_kcal: float
    protein: StoredMacroTarget
    fat: StoredMacroTarget
    carbs_g: float
    carbs_kcal: float
    explanations: list[str]
    calculated_at: str


@dataclass(slots=True)
class StoredWeightLogEntry:
    weight_kg: float
    measured_at: str
    created_at: str


@dataclass(slots=True)
class StoredUserProfile:
    user_id: str
    weight_kg: float
    height_cm: float
    age: int
    gender: str
    activity_level: str
    training_frequency_per_week: int
    goal: str
    created_at: str
    updated_at: str
    goals: StoredGoalCalculation | None = None
    weight_history: list[StoredWeightLogEntry] | None = None


class JsonUserProfileStore:
    def __init__(self, file_path: Path) -> None:
        self._file_path = file_path
        self._file_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = Lock()
        if not self._file_path.exists():
            self._write_records({})

    async def get_profile(self, user_id: str) -> StoredUserProfile | None:
        with self._lock:
            records = self._read_records()

        payload = records.get(user_id)
        if payload is None:
            return None
        return self._deserialize_profile(payload)

    async def save_profile(self, profile: StoredUserProfile) -> None:
        with self._lock:
            records = self._read_records()
            records[profile.user_id] = asdict(profile)
            self._write_records(records)

    def _read_records(self) -> dict[str, dict]:
        try:
            content = self._file_path.read_text(encoding="utf-8-sig")
        except FileNotFoundError:
            return {}
        if not content.strip():
            return {}
        return json.loads(content)

    def _write_records(self, records: dict[str, dict]) -> None:
        self._file_path.write_text(
            json.dumps(records, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )

    def _deserialize_profile(self, payload: dict) -> StoredUserProfile:
        goals = payload.get("goals")
        return StoredUserProfile(
            user_id=payload["user_id"],
            weight_kg=payload["weight_kg"],
            height_cm=payload["height_cm"],
            age=payload["age"],
            gender=payload["gender"],
            activity_level=payload["activity_level"],
            training_frequency_per_week=payload["training_frequency_per_week"],
            goal=payload["goal"],
            created_at=payload["created_at"],
            updated_at=payload["updated_at"],
            goals=self._deserialize_goals(goals) if goals else None,
            weight_history=[self._deserialize_weight_log(item) for item in payload.get("weight_history", [])],
        )

    def _deserialize_goals(self, payload: dict) -> StoredGoalCalculation:
        return StoredGoalCalculation(
            bmr_kcal=payload["bmr_kcal"],
            activity_multiplier=payload["activity_multiplier"],
            tdee_kcal=payload["tdee_kcal"],
            calorie_adjustment_kcal=payload["calorie_adjustment_kcal"],
            calorie_target_kcal=payload["calorie_target_kcal"],
            protein=self._deserialize_macro_target(payload["protein"]),
            fat=self._deserialize_macro_target(payload["fat"]),
            carbs_g=payload["carbs_g"],
            carbs_kcal=payload["carbs_kcal"],
            explanations=list(payload.get("explanations", [])),
            calculated_at=payload["calculated_at"],
        )

    @staticmethod
    def _deserialize_macro_target(payload: dict) -> StoredMacroTarget:
        return StoredMacroTarget(
            grams=payload["grams"],
            grams_per_kg=payload["grams_per_kg"],
            calories=payload["calories"],
            rationale=payload["rationale"],
        )

    @staticmethod
    def _deserialize_weight_log(payload: dict) -> StoredWeightLogEntry:
        return StoredWeightLogEntry(
            weight_kg=payload["weight_kg"],
            measured_at=payload["measured_at"],
            created_at=payload["created_at"],
        )
