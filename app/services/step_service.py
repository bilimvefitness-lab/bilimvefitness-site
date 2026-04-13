import logging
from datetime import date, datetime, timedelta, timezone

from app.db.step_store import StepStore, StoredStepRecord
from app.schemas.steps import (
    StepActivityBand,
    StepActivityContext,
    StepDailyResponse,
    StepLeaderboardEntry,
    StepLeaderboardResponse,
    StepRangeResponse,
    StepRecord,
    StepRecordPayload,
    StepSource,
    StepSyncResponse,
    StepTrendDirection,
    StepTrendPoint,
)


logger = logging.getLogger(__name__)

STEP_GOAL = 10_000

STEP_ACTIVITY_RULES: list[tuple[int, StepActivityBand, str, int, int]] = [
    (2_999, "very_low", "çok düşük", -200, 0),
    (6_999, "low", "düşük", -75, 150),
    (9_999, "moderate", "orta", 125, 350),
    (14_999, "good", "iyi", 300, 600),
    (10**9, "very_high", "çok yüksek", 450, 900),
]


class StepService:
    def __init__(self, step_store: StepStore) -> None:
        self.step_store = step_store

    async def sync_records(self, user_id: str, records: list[StepRecordPayload]) -> StepSyncResponse:
        timestamp = self._now_iso()
        saved_records: list[StepRecord] = []
        normalized_records = sorted(records, key=lambda item: item.date)
        for payload in normalized_records:
            existing = await self.step_store.get_record(user_id, payload.date)
            stored = StoredStepRecord(
                user_id=user_id,
                date=payload.date,
                step_count=int(payload.step_count),
                source=payload.source,
                last_synced_at=payload.last_synced_at or timestamp,
                created_at=existing.created_at if existing else timestamp,
                updated_at=timestamp,
            )
            persisted = await self.step_store.upsert_record(stored)
            saved_records.append(self._to_schema_record(persisted))

        logger.info("step sync completed user_id=%s count=%s", user_id, len(saved_records))
        return StepSyncResponse(
            user_id=user_id,
            upserted_count=len(saved_records),
            records=saved_records,
        )

    async def get_daily(self, user_id: str, record_date: str) -> StepDailyResponse:
        record = await self.step_store.get_record(user_id, record_date)
        return StepDailyResponse(
            user_id=user_id,
            date=record_date,
            record=self._to_schema_record(record) if record else None,
        )

    async def get_range(self, user_id: str, start_date: str, end_date: str) -> StepRangeResponse:
        if start_date > end_date:
            raise ValueError("Başlangıç tarihi bitiş tarihinden büyük olamaz.")

        records = await self.step_store.list_records(user_id, start_date, end_date)
        return StepRangeResponse(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date,
            records=[self._to_schema_record(item) for item in records],
        )

    async def get_daily_leaderboard(
        self,
        *,
        user_id: str,
        record_date: str,
        limit: int = 5,
    ) -> StepLeaderboardResponse:
        ranking = list(await self.step_store.list_daily_ranking(record_date))
        normalized_limit = max(int(limit or 5), 1)
        entries: list[StepLeaderboardEntry] = []
        current_user_entry: StepLeaderboardEntry | None = None

        for index, record in enumerate(ranking, start=1):
            entry = StepLeaderboardEntry(
                user_id=record.user_id,
                rank=index,
                step_count=record.step_count,
                is_current_user=record.user_id == user_id,
            )
            if index <= normalized_limit:
                entries.append(entry)
            if record.user_id == user_id:
                current_user_entry = entry

        return StepLeaderboardResponse(
            date=record_date,
            total_participants=len(ranking),
            entries=entries,
            current_user=current_user_entry,
        )

    async def build_activity_context(
        self,
        *,
        user_id: str,
        analysis_date: str,
        base_calorie_target_kcal: float | None = None,
        weight_kg: float | None = None,
    ) -> StepActivityContext:
        record = await self.step_store.get_record(user_id, analysis_date)
        last_three = await self._get_last_three_points(user_id=user_id, analysis_date=analysis_date)

        if record is None:
            return StepActivityContext(
                available=False,
                date=analysis_date,
                adjusted_calorie_target_kcal=base_calorie_target_kcal,
                hydration_target_ml=self._base_hydration_target(weight_kg),
                trend_direction="insufficient_data",
                trend_summary="Son 3 gün trendi için yeterli adım verisi yok.",
                coach_message_hint="Adım verisi yok. Otomatik senkronizasyonu aç veya manuel giriş yap.",
                last_3_days=last_three,
            )

        activity_level, activity_label, calorie_delta, hydration_delta = self._classify_steps(record.step_count)
        trend_direction, trend_summary = self._build_trend(last_three)
        hydration_target_ml = self._base_hydration_target(weight_kg)
        if hydration_target_ml is not None:
            hydration_target_ml += hydration_delta

        return StepActivityContext(
            available=True,
            date=analysis_date,
            step_count=record.step_count,
            step_goal=STEP_GOAL,
            progress_percent=round((record.step_count / STEP_GOAL) * 100, 1),
            source=self._normalize_source(record.source),
            activity_level=activity_level,
            activity_label=activity_label,
            adjusted_calorie_delta_kcal=calorie_delta,
            adjusted_calorie_target_kcal=(
                round(base_calorie_target_kcal + calorie_delta, 2)
                if base_calorie_target_kcal is not None
                else None
            ),
            hydration_adjustment_ml=hydration_delta,
            hydration_target_ml=hydration_target_ml,
            movement_alerts=self._movement_alerts(
                step_count=record.step_count,
                activity_level=activity_level,
                trend_direction=trend_direction,
            ),
            coach_message_hint=self._coach_hint(
                step_count=record.step_count,
                activity_level=activity_level,
                trend_direction=trend_direction,
            ),
            trend_direction=trend_direction,
            trend_summary=trend_summary,
            last_3_days=last_three,
        )

    async def _get_last_three_points(self, *, user_id: str, analysis_date: str) -> list[StepTrendPoint]:
        target_date = date.fromisoformat(analysis_date)
        start_date = (target_date - timedelta(days=2)).isoformat()
        records = await self.step_store.list_records(user_id, start_date, analysis_date)
        record_map = {item.date: item for item in records}

        points: list[StepTrendPoint] = []
        for offset in range(2, -1, -1):
            current_date = (target_date - timedelta(days=offset)).isoformat()
            current = record_map.get(current_date)
            if current is None:
                points.append(StepTrendPoint(date=current_date))
                continue

            activity_level, _, _, _ = self._classify_steps(current.step_count)
            points.append(
                StepTrendPoint(
                    date=current_date,
                    step_count=current.step_count,
                    source=self._normalize_source(current.source),
                    available=True,
                    activity_level=activity_level,
                )
            )
        return points

    def _build_trend(self, points: list[StepTrendPoint]) -> tuple[StepTrendDirection, str]:
        available_points = [item for item in points if item.available]
        if len(available_points) < 3:
            return "insufficient_data", "Son 3 gün trendi için yeterli adım verisi yok."

        delta = available_points[-1].step_count - available_points[0].step_count
        if delta >= 1_500:
            return "up", "Son 3 günde hareket artıyor."
        if delta <= -1_500:
            return "down", "Son 3 günde hareket düşüyor."
        return "steady", "Son 3 günde hareket dengeli."

    def _movement_alerts(
        self,
        *,
        step_count: int,
        activity_level: StepActivityBand,
        trend_direction: StepTrendDirection,
    ) -> list[str]:
        alerts: list[str] = []
        if activity_level in {"very_low", "low"}:
            alerts.append(f"Bugün hareket düşük ({step_count} adım). 10-15 dakikalık yürüyüş ekle.")
        if activity_level in {"good", "very_high"}:
            alerts.append("Bugün hareket yüksek. Su ve enerji takibini sıkı tut.")
        if trend_direction == "down":
            alerts.append("Son 3 günde hareket düşüyor. Uzun oturma bloklarını böl.")
        if trend_direction == "up":
            alerts.append("Son 3 günde hareket artıyor. Bu ritmi koru.")
        return alerts[:3]

    def _coach_hint(
        self,
        *,
        step_count: int,
        activity_level: StepActivityBand,
        trend_direction: StepTrendDirection,
    ) -> str:
        if activity_level in {"very_low", "low"} and trend_direction == "down":
            return f"Bugün adım düşük ({step_count}) ve son 3 günde ritim geriliyor. Kısa yürüyüşlerle açıl."
        if activity_level in {"very_low", "low"}:
            return f"Bugün adım düşük ({step_count}). Gün içine kısa yürüyüşler serpiştir."
        if activity_level in {"good", "very_high"}:
            return f"Bugün adım yüksek ({step_count}). Suyu ve enerjiyi geciktirme."
        if trend_direction == "up":
            return "Son 3 gündür hareket artıyor. Aynı ritmi koru."
        return "Bugünkü hareket düzeyi dengeli. Ritim bozulmasın."

    def _classify_steps(self, step_count: int) -> tuple[StepActivityBand, str, int, int]:
        for limit, activity_level, activity_label, calorie_delta, hydration_delta in STEP_ACTIVITY_RULES:
            if step_count <= limit:
                return activity_level, activity_label, calorie_delta, hydration_delta
        return "very_high", "çok yüksek", 450, 900

    def _base_hydration_target(self, weight_kg: float | None) -> int | None:
        if weight_kg is None:
            return None
        return int(round(float(weight_kg) * 35))

    def _to_schema_record(self, record: StoredStepRecord | None) -> StepRecord | None:
        if record is None:
            return None
        return StepRecord(
            user_id=record.user_id,
            date=record.date,
            step_count=record.step_count,
            source=self._normalize_source(record.source),
            last_synced_at=record.last_synced_at,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

    @staticmethod
    def _normalize_source(value: str) -> StepSource:
        if value in {"ios_pedometer", "android_health_connect", "manual"}:
            return value
        return "unknown"

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()
