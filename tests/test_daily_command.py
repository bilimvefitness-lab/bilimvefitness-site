import asyncio
import shutil
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import dashboard as dashboard_route
from app.db.hydration_store import JsonHydrationStore
from app.db.meal_store import JsonMealStore, StoredMealEntry, StoredMealEntryItem
from app.db.portion_profile_store import JsonPortionProfileStore
from app.db.user_profile_store import JsonUserProfileStore, StoredUserProfile
from app.main import app
from app.schemas.hydration import WaterLogRequest
from app.services.adaptive_coach_engine import AdaptiveCoachEngine
from app.services.behavior_engine import BehaviorEngine
from app.services.daily_command_service import DailyCommandService
from app.services.goal_engine import GoalEngine
from app.services.hydration_service import HydrationService
from app.services.meal_logging import MealLoggingService
from app.services.portion_learning import PortionLearningService


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _create_user_profile(user_profile_store: JsonUserProfileStore, user_id: str = "command-test-user") -> None:
    timestamp = _now_iso()
    asyncio.run(
        user_profile_store.save_profile(
            StoredUserProfile(
                user_id=user_id,
                weight_kg=80.0,
                height_cm=180.0,
                age=30,
                gender="male",
                activity_level="moderate",
                training_frequency_per_week=4,
                goal="maintenance",
                created_at=timestamp,
                updated_at=timestamp,
                goals=None,
                weight_history=[],
            )
        )
    )


def _meal_record(
    *,
    user_id: str,
    date: str,
    meal_type: str,
    kcal: float,
    protein_g: float,
    carbs_g: float = 0,
    fat_g: float = 0,
) -> StoredMealEntry:
    timestamp = f"{date}T12:00:00+03:00"
    item = StoredMealEntryItem(
        raw_text="test item",
        canonical_food_id="test-food",
        canonical_display_name="Test Food",
        amount=1,
        unit="portion",
        estimated_weight_g=100,
        estimated_weight_min_g=100,
        estimated_weight_max_g=100,
        portion_source="test",
        user_history_samples=1,
        confidence_level="high",
        confidence_score=0.99,
        kcal=kcal,
        protein_g=protein_g,
        carbs_g=carbs_g,
        fat_g=fat_g,
        preparation_method=None,
        modifiers=[],
    )
    return StoredMealEntry(
        meal_id=str(uuid4()),
        user_id=user_id,
        meal_type=meal_type,
        date=date,
        consumed_at=timestamp,
        notes=None,
        items=[item],
        total_kcal=kcal,
        total_protein_g=protein_g,
        total_carbs_g=carbs_g,
        total_fat_g=fat_g,
        created_at=timestamp,
    )


def _build_service(root: Path) -> tuple[DailyCommandService, JsonMealStore, HydrationService]:
    user_profile_store = JsonUserProfileStore(root / "user_profiles.json")
    meal_store = JsonMealStore(root / "meals.json")
    hydration_store = JsonHydrationStore(root / "hydration.json")
    portion_store = JsonPortionProfileStore(root / "portion_profiles.json")
    _create_user_profile(user_profile_store)

    meal_logging_service = MealLoggingService(
        meal_store=meal_store,
        portion_learning_service=PortionLearningService(store=portion_store),
        adaptive_coach_engine=AdaptiveCoachEngine(),
        behavior_engine=BehaviorEngine(),
    )
    hydration_service = HydrationService(
        hydration_store=hydration_store,
        user_profile_store=user_profile_store,
    )
    service = DailyCommandService(
        meal_logging_service=meal_logging_service,
        hydration_service=hydration_service,
        user_profile_store=user_profile_store,
        goal_engine=GoalEngine(),
    )
    return service, meal_store, hydration_service


class DailyCommandServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = Path(__file__).resolve().parent / ".tmp"
        self.temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_dir = self.temp_root / f"daily-command-{uuid4().hex}"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.service, self.meal_store, self.hydration_service = _build_service(self.temp_dir)
        self.user_id = "command-test-user"

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _save_meal(self, *, date: str, kcal: float, protein_g: float) -> None:
        asyncio.run(
            self.meal_store.save_meal(
                _meal_record(
                    user_id=self.user_id,
                    date=date,
                    meal_type="öğle yemeği",
                    kcal=kcal,
                    protein_g=protein_g,
                )
            )
        )

    def _save_water(self, *, date: str, amount: float, unit: str) -> None:
        asyncio.run(
            self.hydration_service.log_water(
                WaterLogRequest(
                    user_id=self.user_id,
                    amount=amount,
                    unit=unit,
                    logged_at=f"{date}T12:00:00+03:00",
                )
            )
        )

    def test_hydration_priority_when_hydration_is_severely_behind(self) -> None:
        analysis_date = "2026-03-28"
        self._save_meal(date=analysis_date, kcal=2000, protein_g=120)

        command = asyncio.run(
            self.service.build_daily_command(
                user_id=self.user_id,
                date=analysis_date,
                protein_target_g=160,
                calorie_target_kcal=2200,
            )
        )
        self.assertEqual(command.primary_domain, "hydration")
        self.assertEqual(command.priority, "high")
        self.assertIn("su", command.overall_status.lower())
        self.assertIsNotNone(command.hydration_quick_add_ml)

    def test_protein_priority_when_hydration_is_okay(self) -> None:
        analysis_date = "2026-03-29"
        self._save_meal(date=analysis_date, kcal=2050, protein_g=70)
        self._save_water(date=analysis_date, amount=2.8, unit="liter")

        command = asyncio.run(
            self.service.build_daily_command(
                user_id=self.user_id,
                date=analysis_date,
                protein_target_g=160,
                calorie_target_kcal=2200,
            )
        )
        self.assertEqual(command.primary_domain, "protein")
        self.assertEqual(command.priority, "high")
        self.assertIn("protein", command.primary_action.lower())

    def test_calorie_priority_when_overshoot_is_clear(self) -> None:
        analysis_date = "2026-03-30"
        self._save_meal(date=analysis_date, kcal=2900, protein_g=150)
        self._save_water(date=analysis_date, amount=2.8, unit="liter")

        command = asyncio.run(
            self.service.build_daily_command(
                user_id=self.user_id,
                date=analysis_date,
                protein_target_g=160,
                calorie_target_kcal=2200,
            )
        )
        self.assertEqual(command.primary_domain, "calories")
        self.assertIn("atıştırma", command.primary_action.lower())

    def test_maintain_when_all_systems_are_on_track(self) -> None:
        analysis_date = "2026-03-31"
        self._save_meal(date=analysis_date, kcal=2100, protein_g=150)
        self._save_water(date=analysis_date, amount=2.8, unit="liter")

        command = asyncio.run(
            self.service.build_daily_command(
                user_id=self.user_id,
                date=analysis_date,
                protein_target_g=160,
                calorie_target_kcal=2200,
            )
        )
        self.assertEqual(command.primary_domain, "maintain")
        self.assertEqual(command.priority, "low")
        self.assertIn("koru", command.primary_action.lower())

    def test_hydration_wins_when_hydration_and_protein_are_both_behind(self) -> None:
        analysis_date = "2026-03-27"
        self._save_meal(date=analysis_date, kcal=2000, protein_g=60)

        command = asyncio.run(
            self.service.build_daily_command(
                user_id=self.user_id,
                date=analysis_date,
                protein_target_g=160,
                calorie_target_kcal=2200,
            )
        )
        self.assertEqual(command.primary_domain, "hydration")
        self.assertEqual(command.sub_status.protein, "behind")
        self.assertEqual(command.sub_status.hydration, "behind")


class DailyCommandApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = Path(__file__).resolve().parent / ".tmp"
        self.temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_dir = self.temp_root / f"daily-command-api-{uuid4().hex}"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.service, self.meal_store, self.hydration_service = _build_service(self.temp_dir)
        self.original_service = dashboard_route.daily_command_service
        dashboard_route.daily_command_service = self.service
        self.client = TestClient(app)

        asyncio.run(
            self.meal_store.save_meal(
                _meal_record(
                    user_id="command-test-user",
                    date="2026-03-26",
                    meal_type="öğle yemeği",
                    kcal=2100,
                    protein_g=150,
                )
            )
        )
        asyncio.run(
            self.hydration_service.log_water(
                WaterLogRequest(
                    user_id="command-test-user",
                    amount=2.8,
                    unit="liter",
                    logged_at="2026-03-26T12:00:00+03:00",
                )
            )
        )

    def tearDown(self) -> None:
        dashboard_route.daily_command_service = self.original_service
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_daily_command_endpoint(self) -> None:
        response = self.client.get(
            "/api/v1/dashboard/daily-command",
            params={
                "user_id": "command-test-user",
                "date": "2026-03-26",
                "protein_target_g": 160,
                "calorie_target_kcal": 2200,
            },
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn("overall_status", payload)
        self.assertIn("primary_action", payload)
        self.assertIn("sub_status", payload)
        self.assertIn("metrics", payload)
