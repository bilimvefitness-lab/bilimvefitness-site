from datetime import datetime, timezone

from app.db.step_engagement_store import StepEngagementStore, StoredStepEngagementSnapshot
from app.schemas.steps import (
    StepEngagementRecord,
    StepEngagementSnapshotPayload,
)


class StepEngagementService:
    def __init__(self, engagement_store: StepEngagementStore) -> None:
        self.engagement_store = engagement_store

    async def sync_snapshot(
        self,
        user_id: str,
        snapshot: StepEngagementSnapshotPayload,
    ) -> StepEngagementRecord:
        timestamp = self._now_iso()
        existing = await self.engagement_store.get_snapshot(user_id, snapshot.date)
        stored = StoredStepEngagementSnapshot(
            user_id=user_id,
            date=snapshot.date,
            daily_task=snapshot.daily_task.model_dump(),
            achievements=[item.model_dump() for item in snapshot.achievements],
            streak=snapshot.streak.model_dump(),
            prime_tone=snapshot.prime_tone,
            prime_message=snapshot.prime_message,
            fomo_messages=list(snapshot.fomo_messages),
            leaderboard_rank=snapshot.leaderboard_rank,
            session_summary=snapshot.session_summary.model_dump() if snapshot.session_summary else None,
            created_at=existing.created_at if existing else timestamp,
            updated_at=timestamp,
        )
        persisted = await self.engagement_store.upsert_snapshot(stored)
        return self._to_schema_record(persisted)

    async def get_snapshot(self, user_id: str, date: str) -> StepEngagementRecord | None:
        snapshot = await self.engagement_store.get_snapshot(user_id, date)
        return self._to_schema_record(snapshot) if snapshot else None

    @staticmethod
    def _to_schema_record(snapshot: StoredStepEngagementSnapshot) -> StepEngagementRecord:
        return StepEngagementRecord(
            user_id=snapshot.user_id,
            date=snapshot.date,
            daily_task=snapshot.daily_task,
            achievements=snapshot.achievements,
            streak=snapshot.streak,
            prime_tone=snapshot.prime_tone,
            prime_message=snapshot.prime_message,
            fomo_messages=snapshot.fomo_messages,
            leaderboard_rank=snapshot.leaderboard_rank,
            session_summary=snapshot.session_summary,
            created_at=snapshot.created_at,
            updated_at=snapshot.updated_at,
        )

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()
