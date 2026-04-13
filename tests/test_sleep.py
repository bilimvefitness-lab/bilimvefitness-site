import asyncio
import shutil
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import sleep as sleep_route
from app.db.sleep_store import JsonSleepStore
from app.main import app
from app.schemas.nutrition import DailyCoachResponse
from app.schemas.sleep import SleepCoachContext, SleepDailySummaryPayload
from app.schemas.user_profile import ProgressResponse
from app.services.adaptive_coach_engine import AdaptiveCoachEngine, CoachDaySnapshot
from app.services.decision_engine import DecisionEngine
from app.services.sleep_service import SleepService


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _build_sleep_service(root: Path) -> SleepService:
    return SleepService(sleep_store=JsonSleepStore(root / "sleep.json"))


class SleepServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = Path(__file__).resolve().parent / ".tmp"
        self.temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_dir = self.temp_root / f"sleep-service-{uuid4().hex}"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.service = _build_sleep_service(self.temp_dir)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_sync_range_and_coach_context_handle_wake_day_and_midnight_bedtime(self) -> None:
        asyncio.run(
            self.service.sync_daily_summaries(
                "sleep-test-user",
                [
                    SleepDailySummaryPayload(
                        sleep_day="2026-03-30",
                        primary_source="apple_health",
                        bedtime="2026-03-29T23:10:00+03:00",
                        wake_time="2026-03-30T06:20:00+03:00",
                        total_sleep_minutes=430,
                        time_in_bed_minutes=450,
                        awake_minutes=20,
                        rem_minutes=95,
                        deep_minutes=60,
                        trend_3d_average=None,
                        trend_7d_average=None,
                        bedtime_trend=None,
                        is_stage_data_available=True,
                        is_manual=False,
                        confidence_level="high",
                    ),
                    SleepDailySummaryPayload(
                        sleep_day="2026-03-31",
                        primary_source="apple_health",
                        bedtime="2026-03-31T00:05:00+03:00",
                        wake_time="2026-03-31T05:35:00+03:00",
                        total_sleep_minutes=330,
                        time_in_bed_minutes=360,
                        awake_minutes=18,
                        rem_minutes=70,
                        deep_minutes=45,
                        trend_3d_average=None,
                        trend_7d_average=None,
                        bedtime_trend=None,
                        is_stage_data_available=True,
                        is_manual=False,
                        confidence_level="high",
                    ),
                    SleepDailySummaryPayload(
                        sleep_day="2026-04-01",
                        primary_source="apple_health",
                        bedtime="2026-04-01T00:45:00+03:00",
                        wake_time="2026-04-01T05:10:00+03:00",
                        total_sleep_minutes=265,
                        time_in_bed_minutes=290,
                        awake_minutes=25,
                        rem_minutes=50,
                        deep_minutes=35,
                        trend_3d_average=None,
                        trend_7d_average=None,
                        bedtime_trend=None,
                        is_stage_data_available=True,
                        is_manual=False,
                        confidence_level="high",
                    ),
                ],
            )
        )

        daily = asyncio.run(self.service.get_daily("sleep-test-user", "2026-04-01"))
        self.assertIsNotNone(daily.summary)
        self.assertEqual(daily.summary.sleep_day, "2026-04-01")
        self.assertEqual(daily.summary.total_sleep_minutes, 265)

        range_response = asyncio.run(
            self.service.get_range("sleep-test-user", "2026-03-30", "2026-04-01")
        )
        self.assertEqual(len(range_response.summaries), 3)

        context = asyncio.run(
            self.service.build_coach_context(
                user_id="sleep-test-user",
                sleep_day="2026-04-01",
            )
        )
        self.assertTrue(context.available)
        self.assertEqual(context.total_sleep_minutes, 265)
        self.assertEqual(context.recovery_signal, "low")
        self.assertEqual(context.sleep_consistency_flag, "delayed")
        self.assertEqual(context.bedtime_trend, "later")
        self.assertAlmostEqual(context.trend_3d_average or 0, 341.7, places=1)
        self.assertIn("Stage verisi mevcut", " ".join(context.insights))


class SleepApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = Path(__file__).resolve().parent / ".tmp"
        self.temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_dir = self.temp_root / f"sleep-api-{uuid4().hex}"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.service = _build_sleep_service(self.temp_dir)
        self.original_service = sleep_route.sleep_service
        sleep_route.sleep_service = self.service
        self.client = TestClient(app)

    def tearDown(self) -> None:
        sleep_route.sleep_service = self.original_service
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_sync_daily_and_range_endpoints(self) -> None:
        sync_response = self.client.post(
            "/api/v1/sleep/sync",
            json={
                "user_id": "sleep-test-user",
                "summaries": [
                    {
                        "sleep_day": "2026-04-01",
                        "primary_source": "health_connect",
                        "bedtime": "2026-03-31T23:20:00+03:00",
                        "wake_time": "2026-04-01T06:40:00+03:00",
                        "total_sleep_minutes": 410,
                        "time_in_bed_minutes": 445,
                        "awake_minutes": 18,
                        "is_stage_data_available": False,
                        "is_manual": False,
                        "confidence_level": "standard",
                    },
                    {
                        "sleep_day": "2026-03-31",
                        "primary_source": "manual",
                        "bedtime": "2026-03-30T23:45:00+03:00",
                        "wake_time": "2026-03-31T06:15:00+03:00",
                        "total_sleep_minutes": 390,
                        "manual_quality_score": 4,
                        "is_stage_data_available": False,
                        "is_manual": True,
                        "confidence_level": "low",
                    },
                ],
            },
        )
        self.assertEqual(sync_response.status_code, 200)
        self.assertEqual(sync_response.json()["upserted_count"], 2)

        daily_response = self.client.get(
            "/api/v1/sleep/daily",
            params={"user_id": "sleep-test-user", "sleep_day": "2026-04-01"},
        )
        self.assertEqual(daily_response.status_code, 200)
        self.assertEqual(daily_response.json()["summary"]["total_sleep_minutes"], 410)

        range_response = self.client.get(
            "/api/v1/sleep/range",
            params={
                "user_id": "sleep-test-user",
                "start_day": "2026-03-31",
                "end_day": "2026-04-01",
            },
        )
        self.assertEqual(range_response.status_code, 200)
        self.assertEqual(len(range_response.json()["summaries"]), 2)


class SleepCoachIntegrationTests(unittest.TestCase):
    def test_adaptive_coach_engine_uses_sleep_context(self) -> None:
        engine = AdaptiveCoachEngine()
        sleep_context = SleepCoachContext(
            available=True,
            sleep_day="2026-04-01",
            total_sleep_minutes=300,
            bedtime="2026-04-01T00:30:00+03:00",
            wake_time="2026-04-01T05:30:00+03:00",
            source_type="apple_health",
            trend_3d_average=320.0,
            trend_7d_average=410.0,
            bedtime_trend="later",
            sleep_consistency_flag="delayed",
            confidence_level="standard",
            is_stage_data_available=False,
            recovery_signal="low",
            insights=["Uyku suresi kisa gorunuyor."],
        )

        coach = engine.build_daily_coach(
            analysis_date="2026-04-01",
            protein_target_g=150,
            calorie_target_kcal=2300,
            actual_protein_g=150,
            actual_kcal=2300,
            meal_count=3,
            historical_days=[
                CoachDaySnapshot(
                    date="2026-03-30",
                    actual_kcal=2300,
                    actual_protein_g=150,
                    meal_count=3,
                    calorie_difference_kcal=0,
                    protein_gap_g=0,
                    logged=True,
                ),
                CoachDaySnapshot(
                    date="2026-03-31",
                    actual_kcal=2250,
                    actual_protein_g=148,
                    meal_count=3,
                    calorie_difference_kcal=-50,
                    protein_gap_g=2,
                    logged=True,
                ),
                CoachDaySnapshot(
                    date="2026-04-01",
                    actual_kcal=2300,
                    actual_protein_g=150,
                    meal_count=3,
                    calorie_difference_kcal=0,
                    protein_gap_g=0,
                    logged=True,
                ),
            ],
            historical_meals=[],
            sleep_context=sleep_context,
        )

        self.assertTrue(any("Son uyku kisa gorunuyor" in item for item in coach.suggestions))
        self.assertIn("Son uyku kisa gorunuyor", coach.coaching_message)
        self.assertIsNotNone(coach.sleep)


class SleepDecisionIntegrationTests(unittest.TestCase):
    def test_decision_engine_uses_low_sleep_day_as_constraint(self) -> None:
        decision_engine = DecisionEngine()
        coach = DailyCoachResponse(
            date="2026-04-01",
            protein_target_g=150,
            actual_protein_g=145,
            protein_gap_g=-5,
            protein_status="close",
            calorie_target_kcal=2300,
            actual_kcal=2280,
            calorie_difference_kcal=-20,
            calorie_balance="near_target",
            suggestions=[],
            coaching_message="",
            coaching_focus="maintain",
        )
        progress = ProgressResponse(
            user_id="sleep-test-user",
            goal="maintenance",
            current_weight_kg=80,
            weight_history=[],
            trend={
                "log_count": 0,
                "change_kg": 0,
                "change_percent": 0,
                "average_weekly_change_kg": 0,
                "direction": "stable",
                "summary": "",
            },
            predictions=[],
            risks=[],
            status="needs_more_data",
            assumptions=[],
        )
        sleep_context = SleepCoachContext(
            available=True,
            sleep_day="2026-04-01",
            total_sleep_minutes=290,
            bedtime="2026-04-01T00:45:00+03:00",
            wake_time="2026-04-01T05:35:00+03:00",
            source_type="manual",
            trend_3d_average=310.0,
            trend_7d_average=390.0,
            bedtime_trend="later",
            sleep_consistency_flag="delayed",
            confidence_level="low",
            is_stage_data_available=False,
            recovery_signal="low",
            insights=["Uyku suresi kisa gorunuyor."],
        )

        decision = decision_engine.build_decision(
            coach=coach,
            progress=progress,
            goal="maintenance",
            sleep_context=sleep_context,
        )

        self.assertEqual(decision.priority, "Bugun toparlanmayi koru. Duzenli ve sade kal.")
        self.assertEqual(
            decision.today_decision[0],
            "Son uyku kisa gorunuyor. Bugun plani sade tut ve plansiz atistirma acma.",
        )
