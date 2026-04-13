import asyncio
import shutil
import unittest
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi.testclient import TestClient

from app.api.routes import step_social as step_social_route
from app.api.routes import steps as steps_route
from app.db.hydration_store import JsonHydrationStore
from app.db.step_engagement_store import JsonStepEngagementStore
from app.db.step_social_event_store import JsonStepSocialEventStore
from app.db.step_social_store import JsonStepSocialStore
from app.db.step_store import JsonStepStore
from app.db.user_profile_store import JsonUserProfileStore, StoredUserProfile
from app.main import app
from app.schemas.hydration import UserHydrationProfilePayload
from app.schemas.nutrition import DailyCoachResponse
from app.schemas.step_social import SocialChallengePayload, SocialDuelCreateRequest, SocialGroupCreateRequest, SocialGroupJoinRequest
from app.schemas.steps import StepActivityContext, StepDailyTask, StepEngagementSnapshotPayload, StepRecordPayload, StepStreakSnapshot
from app.schemas.user_profile import ProgressResponse
from app.services.decision_engine import DecisionEngine
from app.services.hydration_service import HydrationService
from app.services.expo_push_service import ExpoPushMessage
from app.services.step_engagement_service import StepEngagementService
from app.services.step_social_runtime_service import StepSocialService
from app.services.step_service import StepService


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _create_user_profile(user_profile_store: JsonUserProfileStore, user_id: str = "step-test-user") -> None:
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


def _build_step_service(root: Path) -> StepService:
    return StepService(step_store=JsonStepStore(root / "steps.json"))


def _build_step_engagement_service(root: Path) -> StepEngagementService:
    return StepEngagementService(engagement_store=JsonStepEngagementStore(root / "step_engagement.json"))


class DummyPushService:
    def __init__(self) -> None:
        self.messages: list[ExpoPushMessage] = []

    def send_messages(self, messages) -> bool:
        self.messages.extend(messages)
        return True


def _build_step_social_service(root: Path) -> StepSocialService:
    return StepSocialService(
        social_store=JsonStepSocialStore(root / "step_social.json"),
        step_store=JsonStepStore(root / "steps.json"),
        event_store=JsonStepSocialEventStore(root / "step_social_events.json"),
        push_service=DummyPushService(),
    )


class StepServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = Path(__file__).resolve().parent / ".tmp"
        self.temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_dir = self.temp_root / f"step-service-{uuid4().hex}"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.service = _build_step_service(self.temp_dir)

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_sync_range_and_activity_context(self) -> None:
        asyncio.run(
            self.service.sync_records(
                "step-test-user",
                [
                    StepRecordPayload(date="2026-03-30", step_count=4000, source="manual"),
                    StepRecordPayload(date="2026-03-31", step_count=8200, source="ios_pedometer"),
                    StepRecordPayload(date="2026-04-01", step_count=12600, source="android_health_connect"),
                ],
            )
        )

        daily = asyncio.run(self.service.get_daily("step-test-user", "2026-04-01"))
        self.assertIsNotNone(daily.record)
        self.assertEqual(daily.record.step_count, 12600)

        range_response = asyncio.run(self.service.get_range("step-test-user", "2026-03-30", "2026-04-01"))
        self.assertEqual(len(range_response.records), 3)

        context = asyncio.run(
            self.service.build_activity_context(
                user_id="step-test-user",
                analysis_date="2026-04-01",
                base_calorie_target_kcal=2400,
                weight_kg=80,
            )
        )
        self.assertTrue(context.available)
        self.assertEqual(context.activity_level, "good")
        self.assertEqual(context.adjusted_calorie_target_kcal, 2700.0)
        self.assertEqual(context.hydration_target_ml, 3400)
        self.assertEqual(context.trend_direction, "up")


class StepApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = Path(__file__).resolve().parent / ".tmp"
        self.temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_dir = self.temp_root / f"step-api-{uuid4().hex}"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.service = _build_step_service(self.temp_dir)
        self.engagement_service = _build_step_engagement_service(self.temp_dir)
        self.social_service = _build_step_social_service(self.temp_dir)
        self.original_service = steps_route.step_service
        self.original_engagement_service = steps_route.step_engagement_service
        self.original_steps_social_service = steps_route.step_social_service
        self.original_social_service = step_social_route.step_social_service
        steps_route.step_service = self.service
        steps_route.step_engagement_service = self.engagement_service
        steps_route.step_social_service = self.social_service
        step_social_route.step_social_service = self.social_service
        self.client = TestClient(app)

    def tearDown(self) -> None:
        steps_route.step_service = self.original_service
        steps_route.step_engagement_service = self.original_engagement_service
        steps_route.step_social_service = self.original_steps_social_service
        step_social_route.step_social_service = self.original_social_service
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_sync_daily_and_range_endpoints(self) -> None:
        sync_response = self.client.post(
            "/api/v1/steps/sync",
            json={
                "user_id": "step-test-user",
                "records": [
                    {
                        "date": "2026-04-01",
                        "step_count": 9200,
                        "source": "ios_pedometer",
                    },
                    {
                        "date": "2026-03-31",
                        "step_count": 6100,
                        "source": "manual",
                    },
                ],
            },
        )
        self.assertEqual(sync_response.status_code, 200)
        self.assertEqual(sync_response.json()["upserted_count"], 2)

        daily_response = self.client.get(
            "/api/v1/steps/daily",
            params={"user_id": "step-test-user", "date": "2026-04-01"},
        )
        self.assertEqual(daily_response.status_code, 200)
        self.assertEqual(daily_response.json()["record"]["step_count"], 9200)

        range_response = self.client.get(
            "/api/v1/steps/range",
            params={
                "user_id": "step-test-user",
                "start_date": "2026-03-31",
                "end_date": "2026-04-01",
            },
        )
        self.assertEqual(range_response.status_code, 200)
        self.assertEqual(len(range_response.json()["records"]), 2)

    def test_leaderboard_and_engagement_sync_endpoints(self) -> None:
        asyncio.run(
            self.service.sync_records(
                "step-test-user",
                [StepRecordPayload(date="2026-04-01", step_count=9100, source="manual")],
            )
        )
        asyncio.run(
            self.service.sync_records(
                "step-rival-user",
                [StepRecordPayload(date="2026-04-01", step_count=11000, source="manual")],
            )
        )

        leaderboard_response = self.client.get(
            "/api/v1/steps/leaderboard/daily",
            params={"user_id": "step-test-user", "date": "2026-04-01", "limit": 5},
        )
        self.assertEqual(leaderboard_response.status_code, 200)
        self.assertEqual(leaderboard_response.json()["current_user"]["rank"], 2)
        self.assertEqual(leaderboard_response.json()["entries"][0]["step_count"], 11000)

        engagement_response = self.client.post(
            "/api/v1/steps/engagement/sync",
            json={
                "user_id": "step-test-user",
                "snapshot": {
                    "date": "2026-04-01",
                    "daily_task": {
                        "type": "walk_session",
                        "title": "Bir Walk Session tamamla",
                        "detail": "Gunluk gorev",
                        "target_value": 1,
                        "progress_value": 1,
                        "completed": True,
                    },
                    "achievements": [
                        {
                            "key": "first_session",
                            "title": "Ilk Session",
                            "detail": "Ilk walk session tamamlandi",
                            "earned": True,
                            "earned_at": "2026-04-01T18:30:00+00:00",
                        }
                    ],
                    "streak": {
                        "current_days": 3,
                        "longest_days": 3,
                        "completed_today": True,
                        "protection_level": "safe",
                        "protection_message": "Seri korunuyor.",
                    },
                    "prime_tone": "challenge",
                    "prime_message": "Bugun tabloya tekrar gir.",
                    "fomo_messages": ["Seri korunuyor."],
                    "leaderboard_rank": 2,
                    "session_summary": {
                        "completed_today": 1,
                        "total_sessions_7d": 2,
                        "latest_session_at": "2026-04-01T18:30:00+00:00",
                    },
                },
            },
        )
        self.assertEqual(engagement_response.status_code, 200)
        self.assertEqual(engagement_response.json()["daily_task"]["type"], "walk_session")
        self.assertEqual(engagement_response.json()["prime_tone"], "challenge")

    def test_social_group_challenge_duel_overview_endpoints(self) -> None:
        self.client.post(
            "/api/v1/steps/sync",
            json={
                "user_id": "step-test-user",
                "records": [{"date": "2026-04-01", "step_count": 9600, "source": "manual"}],
            },
        )
        self.client.post(
            "/api/v1/steps/sync",
            json={
                "user_id": "friend-user",
                "records": [{"date": "2026-04-01", "step_count": 8300, "source": "manual"}],
            },
        )

        group_response = self.client.post(
            "/api/v1/social/groups",
            json={
                "user_id": "step-test-user",
                "display_name": "Emre",
                "group_name": "Prime Squad",
            },
        )
        self.assertEqual(group_response.status_code, 200)
        invite_code = group_response.json()["invite_code"]

        join_response = self.client.post(
            "/api/v1/social/groups/join",
            json={
                "user_id": "friend-user",
                "display_name": "Ahmet",
                "invite_token": f"primewalk://invite/{invite_code}",
            },
        )
        self.assertEqual(join_response.status_code, 200)
        self.assertEqual(len(join_response.json()["members"]), 2)

        challenge_response = self.client.post(
            "/api/v1/social/challenges/sync",
            json={
                "user_id": "step-test-user",
                "challenges": [
                    {
                        "challenge_id": "2026-04-01-daily",
                        "date": "2026-04-01",
                        "type": "daily_mission",
                        "title": "Bugunun gorevi",
                        "target_value": 1,
                        "progress_value": 1,
                        "completed": True,
                        "status": "completed",
                        "badge_key": "daily_closer",
                        "reward_label": "Gunluk kapatici",
                        "streak_guarded": True,
                    }
                ],
            },
        )
        self.assertEqual(challenge_response.status_code, 200)
        self.assertEqual(challenge_response.json()[0]["status"], "completed")

        duel_response = self.client.post(
            "/api/v1/social/duels",
            json={
                "challenger_user_id": "step-test-user",
                "opponent_user_id": "friend-user",
                "date": "2026-04-01",
            },
        )
        self.assertEqual(duel_response.status_code, 200)
        self.assertEqual(duel_response.json()["challenger_name"], "Emre")

        overview_response = self.client.get(
            "/api/v1/social/overview",
            params={"user_id": "step-test-user", "date": "2026-04-01"},
        )
        self.assertEqual(overview_response.status_code, 200)
        payload = overview_response.json()
        self.assertEqual(payload["group"]["name"], "Prime Squad")
        self.assertEqual(payload["group_leaderboard"]["current_user"]["rank"], 1)
        self.assertTrue(payload["invite_link"].startswith("primewalk://invite/"))
        self.assertGreaterEqual(len(payload["notifications"]), 1)
        self.assertGreaterEqual(len(payload["events"]), 1)

    def test_social_event_center_and_push_registration(self) -> None:
        self.client.post(
            "/api/v1/steps/sync",
            json={
                "user_id": "step-test-user",
                "records": [{"date": "2026-04-01", "step_count": 7500, "source": "manual"}],
            },
        )
        self.client.post(
            "/api/v1/steps/sync",
            json={
                "user_id": "friend-user",
                "records": [{"date": "2026-04-01", "step_count": 6400, "source": "manual"}],
            },
        )

        group_response = self.client.post(
            "/api/v1/social/groups",
            json={
                "user_id": "step-test-user",
                "display_name": "Emre",
                "group_name": "Prime Squad",
            },
        )
        invite_code = group_response.json()["invite_code"]
        self.client.post(
            "/api/v1/social/groups/join",
            json={
                "user_id": "friend-user",
                "display_name": "Ahmet",
                "invite_token": f"primewalk://invite/{invite_code}",
            },
        )

        push_response = self.client.post(
            "/api/v1/social/push/register",
            json={
                "user_id": "step-test-user",
                "expo_push_token": "ExponentPushToken[test-token]",
                "platform": "ios",
                "device_id": "device-step-user",
            },
        )
        self.assertEqual(push_response.status_code, 200)
        self.assertTrue(push_response.json()["registered"])

        self.client.get(
            "/api/v1/social/overview",
            params={"user_id": "step-test-user", "date": "2026-04-01"},
        )

        self.client.post(
            "/api/v1/steps/sync",
            json={
                "user_id": "friend-user",
                "records": [{"date": "2026-04-01", "step_count": 9100, "source": "manual"}],
            },
        )
        self.client.post(
            "/api/v1/steps/sync",
            json={
                "user_id": "friend-user",
                "records": [{"date": "2026-04-01", "step_count": 9100, "source": "manual"}],
            },
        )

        events_response = self.client.get(
            "/api/v1/social/events",
            params={"user_id": "step-test-user", "date": "2026-04-01"},
        )
        self.assertEqual(events_response.status_code, 200)
        events_payload = events_response.json()
        self.assertGreaterEqual(len(events_payload["events"]), 1)
        passed_events = [item for item in events_payload["events"] if item["type"] == "passed_by_friend"]
        self.assertEqual(len(passed_events), 1)

    def test_same_invite_is_idempotent_but_other_group_is_rejected(self) -> None:
        first_group = self.client.post(
            "/api/v1/social/groups",
            json={
                "user_id": "owner-user",
                "display_name": "Owner",
                "group_name": "Alpha",
            },
        )
        second_group = self.client.post(
            "/api/v1/social/groups",
            json={
                "user_id": "other-owner",
                "display_name": "Other",
                "group_name": "Beta",
            },
        )
        invite_code = first_group.json()["invite_code"]
        second_invite_code = second_group.json()["invite_code"]

        first_join = self.client.post(
            "/api/v1/social/groups/join",
            json={
                "user_id": "friend-user",
                "display_name": "Friend",
                "invite_token": f"primewalk://invite/{invite_code}",
            },
        )
        repeated_join = self.client.post(
            "/api/v1/social/groups/join",
            json={
                "user_id": "friend-user",
                "display_name": "Friend",
                "invite_token": f"primewalk://invite/{invite_code}",
            },
        )
        wrong_group_join = self.client.post(
            "/api/v1/social/groups/join",
            json={
                "user_id": "friend-user",
                "display_name": "Friend",
                "invite_token": f"primewalk://invite/{second_invite_code}",
            },
        )

        self.assertEqual(first_join.status_code, 200)
        self.assertEqual(repeated_join.status_code, 200)
        self.assertEqual(repeated_join.json()["group_id"], first_join.json()["group_id"])
        self.assertEqual(wrong_group_join.status_code, 400)


class StepHydrationIntegrationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_root = Path(__file__).resolve().parent / ".tmp"
        self.temp_root.mkdir(parents=True, exist_ok=True)
        self.temp_dir = self.temp_root / f"step-hydration-{uuid4().hex}"
        self.temp_dir.mkdir(parents=True, exist_ok=True)
        self.user_profile_store = JsonUserProfileStore(self.temp_dir / "user_profiles.json")
        _create_user_profile(self.user_profile_store)
        self.step_service = _build_step_service(self.temp_dir)
        self.hydration_service = HydrationService(
            hydration_store=JsonHydrationStore(self.temp_dir / "hydration.json"),
            user_profile_store=self.user_profile_store,
            step_service=self.step_service,
        )

    def tearDown(self) -> None:
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_high_steps_raise_hydration_target_when_adjustment_enabled(self) -> None:
        asyncio.run(
            self.hydration_service.save_profile(
                UserHydrationProfilePayload(
                    user_id="step-test-user",
                    weight_kg=80,
                    default_glass_ml=250,
                    target_mode="auto",
                    manual_target_ml=None,
                    activity_adjustment_enabled=True,
                )
            )
        )
        asyncio.run(
            self.step_service.sync_records(
                "step-test-user",
                [StepRecordPayload(date="2026-04-01", step_count=16000, source="android_health_connect")],
            )
        )

        summary = asyncio.run(self.hydration_service.get_daily_summary("step-test-user", "2026-04-01"))
        self.assertEqual(summary.base_target_ml, 2800)
        self.assertEqual(summary.activity_adjustment_ml, 900)
        self.assertEqual(summary.target_ml, 3700)


class StepDecisionIntegrationTests(unittest.TestCase):
    def test_decision_engine_uses_low_step_day_as_priority(self) -> None:
        decision_engine = DecisionEngine()
        coach = DailyCoachResponse(
            date="2026-04-01",
            protein_target_g=150,
            actual_protein_g=145,
            protein_gap_g=-5,
            protein_status="close",
            calorie_target_kcal=2300,
            actual_kcal=2250,
            calorie_difference_kcal=-50,
            calorie_balance="near_target",
            suggestions=[],
            coaching_message="",
            coaching_focus="maintain",
        )
        progress = ProgressResponse(
            user_id="step-test-user",
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
        step_activity = StepActivityContext(
            available=True,
            date="2026-04-01",
            step_count=1800,
            source="manual",
            activity_level="very_low",
            activity_label="çok düşük",
            progress_percent=18,
            adjusted_calorie_delta_kcal=-200,
            adjusted_calorie_target_kcal=2100,
            hydration_adjustment_ml=0,
            trend_direction="down",
            trend_summary="Son 3 günde hareket düşüyor.",
        )

        decision = decision_engine.build_decision(
            coach=coach,
            progress=progress,
            goal="maintenance",
            step_activity=step_activity,
        )

        self.assertEqual(decision.priority, "Simdi kisa bir yuruyus ekle.")
        self.assertIn("Bugun hareket dusuk.", decision.today_decision[0])
