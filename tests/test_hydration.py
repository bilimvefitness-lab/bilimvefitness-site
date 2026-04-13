import asyncio
import shutil
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import hydration as hydration_route
from app.db.hydration_store import JsonHydrationStore
from app.db.user_profile_store import JsonUserProfileStore, StoredUserProfile
from app.main import app
from app.schemas.hydration import HydrationReminderSettingsPayload, UserHydrationProfilePayload, WaterLogRequest
from app.services.hydration_service import HydrationService


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _create_user_profile(user_profile_store: JsonUserProfileStore, user_id: str = "hydration-test-user") -> None:
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


def _build_service(root: Path) -> HydrationService:
    user_profile_store = JsonUserProfileStore(root / "user_profiles.json")
    hydration_store = JsonHydrationStore(root / "hydration.json")
    _create_user_profile(user_profile_store)
    return HydrationService(
        hydration_store=hydration_store,
        user_profile_store=user_profile_store,
    )


class HydrationServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = Path(__file__).resolve().parent / ".tmp"
        self.temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_dir = self.temp_root / f"hydration-service-{uuid4().hex}"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.service = _build_service(self.temp_dir)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_auto_target_and_unit_conversion(self) -> None:
        profile_response = asyncio.run(self.service.get_profile_response("hydration-test-user"))
        self.assertEqual(profile_response.target.target_ml, 2800)

        asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=2,
                    unit="glass",
                    logged_at="2026-04-01T08:00:00+00:00",
                )
            )
        )
        asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=1.5,
                    unit="liter",
                    logged_at="2026-04-01T10:00:00+00:00",
                )
            )
        )
        asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=300,
                    unit="ml",
                    logged_at="2026-04-01T12:00:00+00:00",
                )
            )
        )

        summary = asyncio.run(self.service.get_daily_summary("hydration-test-user", "2026-04-01"))
        self.assertEqual(summary.consumed_ml, 2300)
        self.assertEqual(summary.target_ml, 2800)
        self.assertEqual(summary.remaining_ml, 500)
        self.assertEqual(summary.status, "on_track")
        self.assertEqual(summary.hydration_score, 80)
        self.assertEqual(summary.streak.current_streak, 0)
        self.assertEqual(summary.feedback.message, "Geridesin. Hemen toparla.")

    def test_manual_target_and_delete_flow(self) -> None:
        asyncio.run(
            self.service.save_profile(
                UserHydrationProfilePayload(
                    user_id="hydration-test-user",
                    weight_kg=80,
                    default_glass_ml=300,
                    target_mode="manual",
                    manual_target_ml=2000,
                    activity_adjustment_enabled=False,
                )
            )
        )

        first_log_response = asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=1,
                    unit="liter",
                    logged_at="2026-04-02T08:00:00+00:00",
                )
            )
        )
        first_log = first_log_response.log
        asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=1200,
                    unit="ml",
                    logged_at="2026-04-02T11:00:00+00:00",
                )
            )
        )

        summary = asyncio.run(self.service.get_daily_summary("hydration-test-user", "2026-04-02"))
        self.assertEqual(summary.target_ml, 2000)
        self.assertEqual(summary.consumed_ml, 2200)
        self.assertEqual(summary.remaining_ml, 0)
        self.assertEqual(summary.status, "above_target")
        self.assertEqual(summary.hydration_score, 100)
        self.assertEqual(summary.streak.current_streak, 1)

        delete_result = asyncio.run(self.service.delete_log("hydration-test-user", first_log.id))
        self.assertTrue(delete_result.deleted)

        updated_summary = asyncio.run(self.service.get_daily_summary("hydration-test-user", "2026-04-02"))
        self.assertEqual(updated_summary.consumed_ml, 1200)
        self.assertEqual(updated_summary.remaining_ml, 800)
        self.assertEqual(updated_summary.status, "on_track")

    def test_streak_accumulates_across_days(self) -> None:
        asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=2.6,
                    unit="liter",
                    logged_at="2026-04-03T08:00:00+00:00",
                )
            )
        )
        asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=2.7,
                    unit="liter",
                    logged_at="2026-04-04T08:00:00+00:00",
                )
            )
        )

        summary = asyncio.run(self.service.get_daily_summary("hydration-test-user", "2026-04-04"))
        self.assertEqual(summary.streak.current_streak, 2)
        self.assertEqual(summary.streak.best_streak, 2)
        self.assertGreaterEqual(summary.hydration_score, 93)

    def test_time_status_segments(self) -> None:
        morning = asyncio.run(
            self.service.get_daily_summary(
                "hydration-test-user",
                "2026-04-05",
                reference_time="2026-04-05T10:00:00+03:00",
            )
        )
        self.assertEqual(morning.time_status, "behind_schedule")
        self.assertEqual(morning.expected_progress_percent, 15.0)
        self.assertEqual(morning.next_action.suggested_ml, 400)
        self.assertEqual(morning.feedback.message, "Geridesin. Hemen toparla.")

        asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=1.4,
                    unit="liter",
                    logged_at="2026-04-06T14:30:00+03:00",
                )
            )
        )
        midday = asyncio.run(
            self.service.get_daily_summary(
                "hydration-test-user",
                "2026-04-06",
                reference_time="2026-04-06T14:30:00+03:00",
            )
        )
        self.assertEqual(midday.time_status, "on_track")
        self.assertEqual(midday.expected_progress_percent, 50.0)
        self.assertEqual(midday.progress_gap, 0.0)
        self.assertEqual(midday.feedback.message, "Ritmi yakaladın.")

        asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=2.6,
                    unit="liter",
                    logged_at="2026-04-07T20:00:00+03:00",
                )
            )
        )
        evening = asyncio.run(
            self.service.get_daily_summary(
                "hydration-test-user",
                "2026-04-07",
                reference_time="2026-04-07T20:00:00+03:00",
            )
        )
        self.assertEqual(evening.time_status, "ahead")
        self.assertEqual(evening.expected_progress_percent, 88.0)
        self.assertGreater(evening.progress_gap, 0)
        self.assertEqual(evening.feedback.message, "Öndesin. Bu seviyeyi koru.")

    def test_delete_last_log_resets_day_and_old_day_expected_progress(self) -> None:
        response = asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=300,
                    unit="ml",
                    logged_at="2026-04-08T09:00:00+03:00",
                )
            )
        )
        asyncio.run(self.service.delete_log("hydration-test-user", response.log.id))

        cleared = asyncio.run(
            self.service.get_daily_summary(
                "hydration-test-user",
                "2026-04-08",
                reference_time="2026-04-08T09:00:00+03:00",
            )
        )
        self.assertEqual(cleared.consumed_ml, 0)
        self.assertEqual(cleared.remaining_ml, 2800)
        self.assertEqual(len(cleared.logs), 0)
        self.assertEqual(cleared.time_status, "behind_schedule")

        old_day = asyncio.run(
            self.service.get_daily_summary(
                "hydration-test-user",
                "2026-04-01",
                reference_time="2026-04-10T10:00:00+03:00",
            )
        )
        self.assertEqual(old_day.expected_progress_percent, 100.0)
        self.assertEqual(old_day.time_status, "behind_schedule")

    def test_same_minute_logs_and_above_target_penalty(self) -> None:
        asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=2,
                    unit="liter",
                    logged_at="2026-04-09T12:00:00+03:00",
                )
            )
        )
        asyncio.run(
            self.service.log_water(
                WaterLogRequest(
                    user_id="hydration-test-user",
                    amount=1.2,
                    unit="liter",
                    logged_at="2026-04-09T12:00:00+03:00",
                )
            )
        )

        summary = asyncio.run(
            self.service.get_daily_summary(
                "hydration-test-user",
                "2026-04-09",
                reference_time="2026-04-09T12:00:00+03:00",
            )
        )
        self.assertEqual(summary.consumed_ml, 3200)
        self.assertEqual(summary.status, "above_target")
        self.assertEqual(len(summary.logs), 2)
        self.assertGreaterEqual(summary.hydration_score, 92)
        self.assertLessEqual(summary.hydration_score, 100)

    def test_reminder_settings_persist_and_validate(self) -> None:
        saved = asyncio.run(
            self.service.save_reminder_settings(
                HydrationReminderSettingsPayload(
                    user_id="hydration-test-user",
                    enabled=True,
                    start_time="09:00",
                    end_time="21:00",
                    interval_minutes=90,
                )
            )
        )
        self.assertTrue(saved.settings.enabled)
        self.assertEqual(saved.settings.interval_minutes, 90)
        self.assertIn("1.5 saat", saved.next_hint)

        loaded = asyncio.run(self.service.get_reminder_settings("hydration-test-user"))
        self.assertEqual(loaded.settings.start_time, "09:00")
        self.assertEqual(loaded.settings.end_time, "21:00")

        with self.assertRaises(ValueError):
            asyncio.run(
                self.service.save_reminder_settings(
                    HydrationReminderSettingsPayload(
                        user_id="hydration-test-user",
                        enabled=True,
                        start_time="21:00",
                        end_time="09:00",
                        interval_minutes=60,
                    )
                )
            )

    def test_weekly_stats_aggregate_correctly(self) -> None:
        logs = (
            ("2026-04-10T09:00:00+03:00", 2.8, "liter"),
            ("2026-04-11T09:00:00+03:00", 2.6, "liter"),
            ("2026-04-12T09:00:00+03:00", 1.4, "liter"),
            ("2026-04-14T09:00:00+03:00", 3.1, "liter"),
        )
        for logged_at, amount, unit in logs:
            asyncio.run(
                self.service.log_water(
                    WaterLogRequest(
                        user_id="hydration-test-user",
                        amount=amount,
                        unit=unit,
                        logged_at=logged_at,
                    )
                )
            )

        stats = asyncio.run(self.service.get_weekly_stats("hydration-test-user", "2026-04-14"))
        self.assertEqual(stats.start_date, "2026-04-08")
        self.assertEqual(stats.end_date, "2026-04-14")
        self.assertEqual(len(stats.days), 7)
        self.assertEqual(stats.total_ml, 9900)
        self.assertEqual(stats.average_daily_ml, round(9900 / 7, 1))
        self.assertEqual(stats.goal_reached_days, 3)
        self.assertEqual(stats.best_streak, 2)
        self.assertEqual(stats.highest_day_ml, 3100)
        self.assertEqual(stats.highest_day_date, "2026-04-14")


class HydrationApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = Path(__file__).resolve().parent / ".tmp"
        self.temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_dir = self.temp_root / f"hydration-api-{uuid4().hex}"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.service = _build_service(self.temp_dir)
        self.original_service = hydration_route.hydration_service
        hydration_route.hydration_service = self.service
        self.client = TestClient(app)

    def tearDown(self) -> None:
        hydration_route.hydration_service = self.original_service
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_profile_log_summary_and_delete_endpoints(self) -> None:
        profile_response = self.client.post(
            "/api/v1/hydration/profile",
            json={
                "user_id": "hydration-test-user",
                "weight_kg": 80,
                "default_glass_ml": 250,
                "target_mode": "auto",
                "manual_target_ml": None,
                "activity_adjustment_enabled": False,
            },
        )
        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.json()["target"]["target_ml"], 2800)

        log_response = self.client.post(
            "/api/v1/hydration/log",
            json={
                "user_id": "hydration-test-user",
                "amount": 2,
                "unit": "glass",
            },
        )
        self.assertEqual(log_response.status_code, 200)
        self.assertEqual(log_response.json()["log"]["amount_ml"], 500)
        self.assertEqual(log_response.json()["summary"]["consumed_ml"], 500)
        self.assertIn("next_hint", log_response.json()["feedback"])
        self.assertIn("next_action", log_response.json()["summary"])
        self.assertIn("time_status", log_response.json()["summary"])

        summary_response = self.client.get(
            "/api/v1/hydration/daily-summary",
            params={
                "user_id": "hydration-test-user",
                "date": log_response.json()["log"]["logged_at"][:10],
            },
        )
        self.assertEqual(summary_response.status_code, 200)
        self.assertEqual(summary_response.json()["consumed_ml"], 500)
        self.assertIn("hydration_score", summary_response.json())
        self.assertIn("streak", summary_response.json())
        self.assertIn("expected_progress_percent", summary_response.json())
        self.assertIn("progress_gap", summary_response.json())
        self.assertIn("time_status", summary_response.json())

        delete_response = self.client.delete(
            f"/api/v1/hydration/log/{log_response.json()['log']['id']}",
            params={"user_id": "hydration-test-user"},
        )
        self.assertEqual(delete_response.status_code, 200)
        self.assertTrue(delete_response.json()["deleted"])

    def test_validation_and_missing_profile_errors(self) -> None:
        missing_profile_response = self.client.get(
            "/api/v1/hydration/profile",
            params={"user_id": "unknown-user"},
        )
        self.assertEqual(missing_profile_response.status_code, 404)

        invalid_manual_response = self.client.post(
            "/api/v1/hydration/profile",
            json={
                "user_id": "hydration-test-user",
                "weight_kg": 80,
                "default_glass_ml": 250,
                "target_mode": "manual",
                "manual_target_ml": None,
                "activity_adjustment_enabled": False,
            },
        )
        self.assertEqual(invalid_manual_response.status_code, 400)

        invalid_glass_response = self.client.post(
            "/api/v1/hydration/profile",
            json={
                "user_id": "hydration-test-user",
                "weight_kg": 80,
                "default_glass_ml": 0,
                "target_mode": "auto",
                "manual_target_ml": None,
                "activity_adjustment_enabled": False,
            },
        )
        self.assertEqual(invalid_glass_response.status_code, 422)

        invalid_water_response = self.client.post(
            "/api/v1/hydration/log",
            json={
                "user_id": "hydration-test-user",
                "amount": 0,
                "unit": "ml",
            },
        )
        self.assertEqual(invalid_water_response.status_code, 422)

        invalid_reminder_response = self.client.post(
            "/api/v1/hydration/reminder-settings",
            json={
                "user_id": "hydration-test-user",
                "enabled": True,
                "start_time": "21:00",
                "end_time": "09:00",
                "interval_minutes": 60,
            },
        )
        self.assertEqual(invalid_reminder_response.status_code, 400)

    def test_manual_target_and_conversion_endpoints(self) -> None:
        profile_response = self.client.post(
            "/api/v1/hydration/profile",
            json={
                "user_id": "hydration-test-user",
                "weight_kg": 80,
                "default_glass_ml": 250,
                "target_mode": "manual",
                "manual_target_ml": 3000,
                "activity_adjustment_enabled": False,
            },
        )
        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.json()["target"]["target_ml"], 3000)

        for payload in (
            {"user_id": "hydration-test-user", "amount": 300, "unit": "ml", "logged_at": "2026-04-10T09:00:00+03:00"},
            {"user_id": "hydration-test-user", "amount": 1.5, "unit": "liter", "logged_at": "2026-04-10T09:01:00+03:00"},
            {"user_id": "hydration-test-user", "amount": 2, "unit": "glass", "logged_at": "2026-04-10T09:02:00+03:00"},
        ):
            log_response = self.client.post("/api/v1/hydration/log", json=payload)
            self.assertEqual(log_response.status_code, 200)

        summary_response = self.client.get(
            "/api/v1/hydration/daily-summary",
            params={"user_id": "hydration-test-user", "date": "2026-04-10"},
        )
        self.assertEqual(summary_response.status_code, 200)
        summary = summary_response.json()
        self.assertEqual(summary["target_ml"], 3000)
        self.assertEqual(summary["consumed_ml"], 2300)
        self.assertEqual(summary["remaining_ml"], 700)

    def test_reminder_and_weekly_stats_endpoints(self) -> None:
        reminder_response = self.client.post(
            "/api/v1/hydration/reminder-settings",
            json={
                "user_id": "hydration-test-user",
                "enabled": True,
                "start_time": "08:30",
                "end_time": "21:30",
                "interval_minutes": 120,
            },
        )
        self.assertEqual(reminder_response.status_code, 200)
        self.assertEqual(reminder_response.json()["settings"]["interval_minutes"], 120)

        reminder_get = self.client.get(
            "/api/v1/hydration/reminder-settings",
            params={"user_id": "hydration-test-user"},
        )
        self.assertEqual(reminder_get.status_code, 200)
        self.assertTrue(reminder_get.json()["settings"]["enabled"])

        for payload in (
            {"user_id": "hydration-test-user", "amount": 2.8, "unit": "liter", "logged_at": "2026-04-15T08:00:00+03:00"},
            {"user_id": "hydration-test-user", "amount": 2.8, "unit": "liter", "logged_at": "2026-04-16T08:00:00+03:00"},
            {"user_id": "hydration-test-user", "amount": 1.2, "unit": "liter", "logged_at": "2026-04-17T08:00:00+03:00"},
        ):
            response = self.client.post("/api/v1/hydration/log", json=payload)
            self.assertEqual(response.status_code, 200)

        weekly_response = self.client.get(
            "/api/v1/hydration/weekly-stats",
            params={"user_id": "hydration-test-user", "end_date": "2026-04-17"},
        )
        self.assertEqual(weekly_response.status_code, 200)
        weekly = weekly_response.json()
        self.assertEqual(weekly["goal_reached_days"], 2)
        self.assertEqual(weekly["best_streak"], 2)
        self.assertEqual(len(weekly["days"]), 7)
