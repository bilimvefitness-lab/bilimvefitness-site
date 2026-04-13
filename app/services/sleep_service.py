import logging
from datetime import date, datetime, timedelta, timezone

from app.db.sleep_store import SleepStore, StoredSleepSummary
from app.schemas.sleep import (
    SleepBedtimeTrend,
    SleepCoachContext,
    SleepConfidenceLevel,
    SleepConsistencyFlag,
    SleepDailyResponse,
    SleepDailySummary,
    SleepDailySummaryPayload,
    SleepRangeResponse,
    SleepRecoverySignal,
    SleepSourceType,
    SleepSyncResponse,
)


logger = logging.getLogger(__name__)


class SleepService:
    def __init__(self, sleep_store: SleepStore) -> None:
        self.sleep_store = sleep_store

    async def sync_daily_summaries(
        self,
        user_id: str,
        summaries: list[SleepDailySummaryPayload],
    ) -> SleepSyncResponse:
        timestamp = self._now_iso()
        saved_summaries: list[SleepDailySummary] = []

        for payload in sorted(summaries, key=lambda item: item.sleep_day):
            existing = await self.sleep_store.get_summary(user_id, payload.sleep_day)
            stored = StoredSleepSummary(
                user_id=user_id,
                sleep_day=payload.sleep_day,
                primary_source=payload.primary_source,
                bedtime=payload.bedtime,
                wake_time=payload.wake_time,
                total_sleep_minutes=int(payload.total_sleep_minutes),
                time_in_bed_minutes=payload.time_in_bed_minutes,
                awake_minutes=payload.awake_minutes,
                rem_minutes=payload.rem_minutes,
                core_minutes=payload.core_minutes,
                deep_minutes=payload.deep_minutes,
                awakenings_count=payload.awakenings_count,
                manual_quality_score=payload.manual_quality_score,
                trend_3d_average=payload.trend_3d_average,
                trend_7d_average=payload.trend_7d_average,
                bedtime_trend=payload.bedtime_trend,
                is_stage_data_available=payload.is_stage_data_available,
                is_manual=payload.is_manual,
                confidence_level=payload.confidence_level,
                last_synced_at=payload.last_synced_at or timestamp,
                created_at=existing.created_at if existing else timestamp,
                updated_at=timestamp,
            )
            persisted = await self.sleep_store.upsert_summary(stored)
            saved_summaries.append(self._to_schema_summary(persisted))

        logger.info("sleep sync completed user_id=%s count=%s", user_id, len(saved_summaries))
        return SleepSyncResponse(
            user_id=user_id,
            upserted_count=len(saved_summaries),
            summaries=saved_summaries,
        )

    async def get_daily(self, user_id: str, sleep_day: str) -> SleepDailyResponse:
        summary = await self.sleep_store.get_summary(user_id, sleep_day)
        return SleepDailyResponse(
            user_id=user_id,
            sleep_day=sleep_day,
            summary=self._to_schema_summary(summary) if summary else None,
        )

    async def get_range(self, user_id: str, start_day: str, end_day: str) -> SleepRangeResponse:
        if start_day > end_day:
            raise ValueError("Baslangic gunu bitis gununden buyuk olamaz.")

        summaries = await self.sleep_store.list_summaries(user_id, start_day, end_day)
        return SleepRangeResponse(
            user_id=user_id,
            start_day=start_day,
            end_day=end_day,
            summaries=[self._to_schema_summary(item) for item in summaries],
        )

    async def build_coach_context(self, *, user_id: str, sleep_day: str) -> SleepCoachContext:
        summary = await self.sleep_store.get_summary(user_id, sleep_day)
        if summary is None:
            return SleepCoachContext(
                available=False,
                sleep_day=sleep_day,
                insights=[],
            )

        history = await self._get_last_seven_summaries(user_id=user_id, sleep_day=sleep_day)
        trend_3d_average = summary.trend_3d_average
        if trend_3d_average is None:
            trend_3d_average = self._average_minutes(history[-3:])

        trend_7d_average = summary.trend_7d_average
        if trend_7d_average is None:
            trend_7d_average = self._average_minutes(history)

        bedtime_trend = self._normalize_bedtime_trend(summary.bedtime_trend) or self._derive_bedtime_trend(history)
        sleep_consistency_flag = self._derive_sleep_consistency(history, bedtime_trend)
        recovery_signal = self._recovery_signal(summary.total_sleep_minutes)
        stage_summary = self._build_stage_summary(summary)
        insights = self._build_insights(
            summary=summary,
            trend_3d_average=trend_3d_average,
            trend_7d_average=trend_7d_average,
            sleep_consistency_flag=sleep_consistency_flag,
            recovery_signal=recovery_signal,
            stage_summary=stage_summary,
        )

        return SleepCoachContext(
            available=True,
            sleep_day=sleep_day,
            total_sleep_minutes=summary.total_sleep_minutes,
            bedtime=summary.bedtime,
            wake_time=summary.wake_time,
            awakenings_count=summary.awakenings_count,
            manual_quality_score=summary.manual_quality_score,
            rem_minutes=summary.rem_minutes,
            deep_minutes=summary.deep_minutes,
            source_type=self._normalize_source(summary.primary_source),
            trend_3d_average=trend_3d_average,
            trend_7d_average=trend_7d_average,
            bedtime_trend=bedtime_trend,
            sleep_consistency_flag=sleep_consistency_flag,
            confidence_level=self._normalize_confidence(summary.confidence_level),
            is_stage_data_available=summary.is_stage_data_available,
            recovery_signal=recovery_signal,
            stage_summary=stage_summary,
            insights=insights,
        )

    async def _get_last_seven_summaries(self, *, user_id: str, sleep_day: str) -> list[StoredSleepSummary]:
        target_day = date.fromisoformat(sleep_day)
        start_day = (target_day - timedelta(days=6)).isoformat()
        return list(await self.sleep_store.list_summaries(user_id, start_day, sleep_day))

    def _average_minutes(self, summaries: list[StoredSleepSummary]) -> float | None:
        if not summaries:
            return None
        return round(sum(item.total_sleep_minutes for item in summaries) / len(summaries), 1)

    def _derive_bedtime_trend(self, summaries: list[StoredSleepSummary]) -> SleepBedtimeTrend:
        bedtime_minutes = [self._bedtime_minutes(item.bedtime) for item in summaries if self._bedtime_minutes(item.bedtime) is not None]
        if len(bedtime_minutes) < 3:
            return "insufficient_data"

        recent = bedtime_minutes[-3:]
        earlier = bedtime_minutes[:-3]
        if not earlier:
            delta = recent[-1] - recent[0]
            if delta >= 45:
                return "later"
            if delta <= -45:
                return "earlier"
            return "stable"

        recent_average = sum(recent) / len(recent)
        earlier_average = sum(earlier) / len(earlier)
        if recent_average >= earlier_average + 45:
            return "later"
        if recent_average <= earlier_average - 45:
            return "earlier"
        return "stable"

    def _derive_sleep_consistency(
        self,
        summaries: list[StoredSleepSummary],
        bedtime_trend: SleepBedtimeTrend,
    ) -> SleepConsistencyFlag:
        if len(summaries) < 3:
            return "insufficient_data"
        if bedtime_trend == "later":
            return "delayed"
        return "stable"

    def _recovery_signal(self, total_sleep_minutes: int) -> SleepRecoverySignal:
        if total_sleep_minutes < 360:
            return "low"
        if total_sleep_minutes < 420:
            return "moderate"
        if total_sleep_minutes <= 540:
            return "target"
        return "high"

    def _build_stage_summary(self, summary: StoredSleepSummary) -> str:
        if not summary.is_stage_data_available:
            return ""

        parts: list[str] = []
        if summary.rem_minutes is not None:
            parts.append(f"REM {summary.rem_minutes} dk")
        if summary.deep_minutes is not None:
            parts.append(f"deep {summary.deep_minutes} dk")
        if summary.awake_minutes is not None:
            parts.append(f"uyanik {summary.awake_minutes} dk")
        return ", ".join(parts)

    def _build_insights(
        self,
        *,
        summary: StoredSleepSummary,
        trend_3d_average: float | None,
        trend_7d_average: float | None,
        sleep_consistency_flag: SleepConsistencyFlag,
        recovery_signal: SleepRecoverySignal,
        stage_summary: str,
    ) -> list[str]:
        insights: list[str] = []

        if recovery_signal == "low":
            insights.append("Uyku suresi kisa gorunuyor. Bugun toparlanma beklentisini temkinli tut.")
        elif recovery_signal == "moderate":
            insights.append("Uyku suresi hedef araligin altinda gorunuyor. Bugun ritmi biraz daha sade tut.")
        elif recovery_signal == "target":
            insights.append("Uyku suresi hedef aralikta gorunuyor.")

        if (
            trend_3d_average is not None
            and trend_7d_average is not None
            and trend_3d_average + 20 < trend_7d_average
        ):
            insights.append("Son 3 gun ortalamasi son haftanin altina geliyor.")

        if sleep_consistency_flag == "delayed":
            insights.append("Yatis saati son gunlerde gecikiyor gibi gorunuyor.")

        if summary.is_stage_data_available and stage_summary:
            insights.append(f"Stage verisi mevcut: {stage_summary}.")

        return insights[:4]

    def _bedtime_minutes(self, value: str) -> int | None:
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
        minutes = parsed.hour * 60 + parsed.minute
        if parsed.hour < 12:
            minutes += 24 * 60
        return minutes

    def _to_schema_summary(self, summary: StoredSleepSummary | None) -> SleepDailySummary | None:
        if summary is None:
            return None
        return SleepDailySummary(
            user_id=summary.user_id,
            sleep_day=summary.sleep_day,
            primary_source=self._normalize_source(summary.primary_source),
            bedtime=summary.bedtime,
            wake_time=summary.wake_time,
            total_sleep_minutes=summary.total_sleep_minutes,
            time_in_bed_minutes=summary.time_in_bed_minutes,
            awake_minutes=summary.awake_minutes,
            rem_minutes=summary.rem_minutes,
            core_minutes=summary.core_minutes,
            deep_minutes=summary.deep_minutes,
            awakenings_count=summary.awakenings_count,
            manual_quality_score=summary.manual_quality_score,
            trend_3d_average=summary.trend_3d_average,
            trend_7d_average=summary.trend_7d_average,
            bedtime_trend=self._normalize_bedtime_trend(summary.bedtime_trend),
            is_stage_data_available=summary.is_stage_data_available,
            is_manual=summary.is_manual,
            confidence_level=self._normalize_confidence(summary.confidence_level),
            last_synced_at=summary.last_synced_at,
            created_at=summary.created_at,
            updated_at=summary.updated_at,
        )

    @staticmethod
    def _normalize_source(value: str) -> SleepSourceType:
        if value in {"apple_health", "health_connect", "manual"}:
            return value
        return "manual"

    @staticmethod
    def _normalize_confidence(value: str) -> SleepConfidenceLevel:
        if value in {"low", "standard", "high"}:
            return value
        return "low"

    @staticmethod
    def _normalize_bedtime_trend(value: str | None) -> SleepBedtimeTrend | None:
        if value in {"earlier", "stable", "later", "insufficient_data"}:
            return value
        return None

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()
