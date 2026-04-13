from datetime import date as date_cls
from datetime import datetime, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.db.hydration_store import (
    HydrationStore,
    StoredHydrationProfile,
    StoredHydrationReminderSettings,
    StoredWaterLogEntry,
)
from app.db.user_profile_store import JsonUserProfileStore
from app.schemas.hydration import (
    DailyHydrationSummary,
    DeleteWaterLogResponse,
    HydrationFeedback,
    HydrationLogListResponse,
    HydrationLogResponse,
    HydrationNextAction,
    HydrationReminderSettings,
    HydrationReminderSettingsPayload,
    HydrationReminderSettingsResponse,
    HydrationReminderIntervalMinutes,
    HydrationStreak,
    HydrationTargetDetails,
    TrainingIntensity,
    UserHydrationProfile,
    UserHydrationProfilePayload,
    UserHydrationProfileResponse,
    WaterLogEntry,
    WaterLogRequest,
    WeeklyHydrationDayStat,
    WeeklyHydrationStatsResponse,
)
from app.schemas.steps import StepActivityContext
from app.services.step_service import StepService


TRAINING_ADJUSTMENTS_ML: dict[str, int] = {
    "light": 400,
    "moderate": 700,
    "intense": 1000,
}
HYDRATION_STREAK_THRESHOLD_PERCENT = 90.0
try:
    HYDRATION_LOCAL_TZ = ZoneInfo("Europe/Istanbul")
except ZoneInfoNotFoundError:
    HYDRATION_LOCAL_TZ = timezone(timedelta(hours=3))


class HydrationService:
    def __init__(
        self,
        hydration_store: HydrationStore,
        user_profile_store: JsonUserProfileStore,
        step_service: StepService | None = None,
    ) -> None:
        self.hydration_store = hydration_store
        self.user_profile_store = user_profile_store
        self.step_service = step_service

    async def get_profile_response(self, user_id: str) -> UserHydrationProfileResponse:
        profile = await self._get_or_create_profile(user_id)
        if profile is None:
            raise LookupError("Su hedefi için önce profilini doldur.")
        return self._build_profile_response(profile)

    async def save_profile(self, payload: UserHydrationProfilePayload) -> UserHydrationProfileResponse:
        if payload.target_mode == "manual" and payload.manual_target_ml is None:
            raise ValueError("Manuel hedef için günlük su hedefi gir.")

        existing = await self.hydration_store.get_profile(payload.user_id)
        fallback_weight = await self._get_user_profile_weight(payload.user_id)
        resolved_weight = payload.weight_kg or (existing.weight_kg if existing else None) or fallback_weight
        if payload.target_mode == "auto" and resolved_weight is None:
            raise ValueError("Hidrasyon hedefi için kilo bilgisi gerekli.")

        timestamp = self._now_iso()
        profile = StoredHydrationProfile(
            user_id=payload.user_id,
            weight_kg=resolved_weight,
            default_glass_ml=payload.default_glass_ml,
            target_mode=payload.target_mode,
            manual_target_ml=payload.manual_target_ml if payload.target_mode == "manual" else None,
            activity_adjustment_enabled=payload.activity_adjustment_enabled,
            created_at=existing.created_at if existing else timestamp,
            updated_at=timestamp,
        )
        await self.hydration_store.save_profile(profile)
        return self._build_profile_response(profile)

    async def get_reminder_settings(self, user_id: str) -> HydrationReminderSettingsResponse:
        settings = await self.hydration_store.get_reminder_settings(user_id)
        if settings is None:
            settings = self._build_default_reminder_settings(user_id)
        return self._build_reminder_response(settings)

    async def save_reminder_settings(
        self,
        payload: HydrationReminderSettingsPayload,
    ) -> HydrationReminderSettingsResponse:
        self._validate_reminder_times(payload.start_time, payload.end_time)

        existing = await self.hydration_store.get_reminder_settings(payload.user_id)
        timestamp = self._now_iso()
        settings = StoredHydrationReminderSettings(
            user_id=payload.user_id,
            enabled=payload.enabled,
            start_time=payload.start_time,
            end_time=payload.end_time,
            interval_minutes=int(payload.interval_minutes),
            created_at=existing.created_at if existing else timestamp,
            updated_at=timestamp,
        )
        await self.hydration_store.save_reminder_settings(settings)
        return self._build_reminder_response(settings)

    async def get_daily_summary(
        self,
        user_id: str,
        date: str,
        exercise_day: bool = False,
        training_intensity: TrainingIntensity | None = None,
        reference_time: str | None = None,
    ) -> DailyHydrationSummary:
        profile = await self._get_or_create_profile(user_id)
        if profile is None:
            raise LookupError("Su hedefi için önce profilini doldur.")

        target = self._calculate_target(profile, exercise_day=exercise_day, training_intensity=training_intensity)
        if profile.activity_adjustment_enabled and self.step_service is not None:
            step_activity = await self.step_service.build_activity_context(
                user_id=user_id,
                analysis_date=date,
                weight_kg=profile.weight_kg,
            )
            target = self._apply_step_adjustment(target, step_activity)
        logs = [self._to_log_entry(item) for item in await self.hydration_store.get_logs_for_date(date, user_id)]
        consumed_ml = sum(item.amount_ml for item in logs)
        completion_percent = self._calculate_completion_percent(consumed_ml=consumed_ml, target_ml=target.target_ml)
        status = self._resolve_status(consumed_ml=consumed_ml, target_ml=target.target_ml)
        expected_progress_percent = self._calculate_expected_progress_percent(
            summary_date=date,
            reference_time=reference_time,
        )
        progress_gap = round(completion_percent - expected_progress_percent, 1)
        time_status = self._resolve_time_status(progress_gap)
        next_action = self._build_next_action(
            time_status=time_status,
            progress_gap=progress_gap,
            target_ml=target.target_ml,
            remaining_ml=max(target.target_ml - consumed_ml, 0),
        )
        feedback = self._build_feedback(
            consumed_ml=consumed_ml,
            target_ml=target.target_ml,
            completion_percent=completion_percent,
            status=status,
            reference_time=reference_time or (logs[0].logged_at if logs else None),
            expected_progress_percent=expected_progress_percent,
            time_status=time_status,
        )
        streak = await self._build_streak(
            user_id=user_id,
            analysis_date=date,
            profile=profile,
            exercise_day=exercise_day,
            training_intensity=training_intensity,
        )
        return DailyHydrationSummary(
            date=date,
            target_ml=target.target_ml,
            base_target_ml=target.base_target_ml,
            activity_adjustment_ml=target.activity_adjustment_ml,
            consumed_ml=consumed_ml,
            remaining_ml=max(target.target_ml - consumed_ml, 0),
            completion_percent=completion_percent,
            expected_progress_percent=expected_progress_percent,
            progress_gap=progress_gap,
            time_status=time_status,
            hydration_score=self._calculate_score(completion_percent=completion_percent),
            status=status,
            streak=streak,
            feedback=feedback,
            next_action=next_action,
            logs=logs,
        )

    async def get_weekly_stats(self, user_id: str, end_date: str) -> WeeklyHydrationStatsResponse:
        profile = await self._get_or_create_profile(user_id)
        if profile is None:
            raise LookupError("Su hedefi için önce profilini doldur.")

        range_end = date_cls.fromisoformat(end_date)
        range_start = range_end - timedelta(days=6)
        all_logs = list(await self.hydration_store.get_all_logs(user_id))
        totals_by_date: dict[str, int] = {}
        for entry in all_logs:
            iso_date = entry.logged_at[:10]
            totals_by_date[iso_date] = totals_by_date.get(iso_date, 0) + entry.amount_ml

        target = self._calculate_target(profile)
        days: list[WeeklyHydrationDayStat] = []
        total_ml = 0
        best_streak = 0
        current_streak = 0
        goal_reached_days = 0
        highest_day_ml = 0
        highest_day_date: str | None = None

        for day_offset in range(7):
            current_day = range_start + timedelta(days=day_offset)
            iso_date = current_day.isoformat()
            consumed_ml = int(totals_by_date.get(iso_date, 0))
            completion_percent = self._calculate_completion_percent(
                consumed_ml=consumed_ml,
                target_ml=target.target_ml,
            )
            reached_target = completion_percent >= HYDRATION_STREAK_THRESHOLD_PERCENT
            score = self._calculate_score(completion_percent=completion_percent)
            total_ml += consumed_ml

            if reached_target:
                goal_reached_days += 1
                current_streak += 1
                best_streak = max(best_streak, current_streak)
            else:
                current_streak = 0

            if consumed_ml > highest_day_ml:
                highest_day_ml = consumed_ml
                highest_day_date = iso_date

            days.append(
                WeeklyHydrationDayStat(
                    date=iso_date,
                    consumed_ml=consumed_ml,
                    target_ml=target.target_ml,
                    completion_percent=completion_percent,
                    reached_target=reached_target,
                    score=score,
                )
            )

        return WeeklyHydrationStatsResponse(
            start_date=range_start.isoformat(),
            end_date=range_end.isoformat(),
            days=days,
            average_daily_ml=round(total_ml / 7, 1),
            total_ml=total_ml,
            best_streak=best_streak,
            goal_reached_days=goal_reached_days,
            highest_day_ml=highest_day_ml,
            highest_day_date=highest_day_date,
        )

    async def log_water(self, payload: WaterLogRequest) -> HydrationLogResponse:
        profile = await self._get_or_create_profile(payload.user_id)
        if profile is None:
            raise LookupError("Su girişi için önce profilini doldur.")

        amount_ml = self._convert_to_ml(
            amount=payload.amount,
            unit=payload.unit,
            default_glass_ml=profile.default_glass_ml,
        )
        entry = StoredWaterLogEntry(
            id=str(uuid4()),
            user_id=payload.user_id,
            amount_ml=amount_ml,
            source_unit=payload.unit,
            source_value=payload.amount,
            logged_at=payload.logged_at or self._now_iso(),
            note=payload.note,
        )
        await self.hydration_store.save_log(entry)
        summary = await self.get_daily_summary(
            user_id=payload.user_id,
            date=entry.logged_at[:10],
            reference_time=entry.logged_at,
        )
        return HydrationLogResponse(
            log=self._to_log_entry(entry),
            summary=summary,
            feedback=summary.feedback,
        )

    async def delete_log(self, user_id: str, log_id: str) -> DeleteWaterLogResponse:
        deleted = await self.hydration_store.delete_log(user_id=user_id, log_id=log_id)
        return DeleteWaterLogResponse(log_id=log_id, deleted=deleted)

    async def get_logs(self, user_id: str, date: str) -> HydrationLogListResponse:
        logs = [self._to_log_entry(item) for item in await self.hydration_store.get_logs_for_date(date, user_id)]
        return HydrationLogListResponse(date=date, logs=logs)

    async def _get_or_create_profile(self, user_id: str) -> StoredHydrationProfile | None:
        existing = await self.hydration_store.get_profile(user_id)
        if existing is not None:
            return existing

        user_profile_weight = await self._get_user_profile_weight(user_id)
        if user_profile_weight is None:
            return None

        timestamp = self._now_iso()
        profile = StoredHydrationProfile(
            user_id=user_id,
            weight_kg=user_profile_weight,
            default_glass_ml=250,
            target_mode="auto",
            manual_target_ml=None,
            activity_adjustment_enabled=False,
            created_at=timestamp,
            updated_at=timestamp,
        )
        await self.hydration_store.save_profile(profile)
        return profile

    async def _get_user_profile_weight(self, user_id: str) -> float | None:
        user_profile = await self.user_profile_store.get_profile(user_id)
        if user_profile is None:
            return None
        return float(user_profile.weight_kg)

    async def _build_streak(
        self,
        *,
        user_id: str,
        analysis_date: str,
        profile: StoredHydrationProfile,
        exercise_day: bool = False,
        training_intensity: TrainingIntensity | None = None,
    ) -> HydrationStreak:
        logs = list(await self.hydration_store.get_all_logs(user_id))
        if not logs:
            return HydrationStreak(current_streak=0, best_streak=0)

        grouped_totals: dict[str, int] = {}
        for entry in logs:
            iso_date = entry.logged_at[:10]
            grouped_totals[iso_date] = grouped_totals.get(iso_date, 0) + entry.amount_ml

        base_target = self._calculate_target(
            profile,
            exercise_day=exercise_day,
            training_intensity=training_intensity,
        )
        qualifying_dates: list[date_cls] = []
        for iso_date, consumed_ml in grouped_totals.items():
            completion_percent = self._calculate_completion_percent(
                consumed_ml=consumed_ml,
                target_ml=base_target.target_ml,
            )
            if completion_percent >= HYDRATION_STREAK_THRESHOLD_PERCENT:
                qualifying_dates.append(date_cls.fromisoformat(iso_date))

        if not qualifying_dates:
            return HydrationStreak(current_streak=0, best_streak=0)

        qualifying_dates.sort()
        best_streak = 0
        running_streak = 0
        previous_day: date_cls | None = None
        for current_day in qualifying_dates:
            if previous_day is not None and current_day == previous_day + timedelta(days=1):
                running_streak += 1
            else:
                running_streak = 1
            best_streak = max(best_streak, running_streak)
            previous_day = current_day

        current_streak = 0
        pointer = date_cls.fromisoformat(analysis_date)
        qualifying_set = set(qualifying_dates)
        while pointer in qualifying_set:
            current_streak += 1
            pointer -= timedelta(days=1)

        return HydrationStreak(
            current_streak=current_streak,
            best_streak=best_streak,
        )

    def _build_profile_response(self, profile: StoredHydrationProfile) -> UserHydrationProfileResponse:
        target = self._calculate_target(profile)
        return UserHydrationProfileResponse(
            profile=UserHydrationProfile(
                user_id=profile.user_id,
                weight_kg=profile.weight_kg,
                default_glass_ml=profile.default_glass_ml,
                target_mode=profile.target_mode,
                manual_target_ml=profile.manual_target_ml,
                activity_adjustment_enabled=profile.activity_adjustment_enabled,
                created_at=profile.created_at,
                updated_at=profile.updated_at,
            ),
            target=target,
        )

    def _build_reminder_response(
        self,
        settings: StoredHydrationReminderSettings,
    ) -> HydrationReminderSettingsResponse:
        start_label = settings.start_time.replace(":", ".")
        end_label = settings.end_time.replace(":", ".")
        interval_label = self._interval_label(settings.interval_minutes)
        if settings.enabled:
            next_hint = f"Hatırlatmalar {start_label} - {end_label} arasında {interval_label} ritmiyle hazır."
        else:
            next_hint = "Hatırlatmalar kapalı. İstersen kısa bir ritim aç."
        return HydrationReminderSettingsResponse(
            settings=HydrationReminderSettings(
                user_id=settings.user_id,
                enabled=settings.enabled,
                start_time=settings.start_time,
                end_time=settings.end_time,
                interval_minutes=settings.interval_minutes,
                created_at=settings.created_at,
                updated_at=settings.updated_at,
            ),
            next_hint=next_hint,
        )

    def _build_default_reminder_settings(self, user_id: str) -> StoredHydrationReminderSettings:
        timestamp = self._now_iso()
        return StoredHydrationReminderSettings(
            user_id=user_id,
            enabled=False,
            start_time="08:00",
            end_time="22:00",
            interval_minutes=60,
            created_at=timestamp,
            updated_at=timestamp,
        )

    def _calculate_target(
        self,
        profile: StoredHydrationProfile,
        exercise_day: bool = False,
        training_intensity: TrainingIntensity | None = None,
    ) -> HydrationTargetDetails:
        if profile.target_mode == "manual":
            base_target_ml = int(profile.manual_target_ml or 0)
            reason = "Manuel hedef kullanılıyor."
        else:
            weight_kg = float(profile.weight_kg or 0)
            base_target_ml = int(round(weight_kg * 35))
            reason = f"Otomatik hedef kilo x 35 ml formülüyle hesaplandı ({weight_kg:.1f} kg)."

        adjustment_ml = 0
        if exercise_day and profile.activity_adjustment_enabled and training_intensity:
            adjustment_ml = TRAINING_ADJUSTMENTS_ML.get(training_intensity, 0)
            if adjustment_ml:
                reason += f" Egzersiz günü için +{adjustment_ml} ml eklendi."

        return HydrationTargetDetails(
            mode=profile.target_mode,
            base_target_ml=base_target_ml,
            activity_adjustment_ml=adjustment_ml,
            target_ml=base_target_ml + adjustment_ml,
            reason=reason,
        )

    @staticmethod
    def _apply_step_adjustment(
        target: HydrationTargetDetails,
        step_activity: StepActivityContext,
    ) -> HydrationTargetDetails:
        if not step_activity.available or step_activity.hydration_adjustment_ml <= target.activity_adjustment_ml:
            return target

        return HydrationTargetDetails(
            mode=target.mode,
            base_target_ml=target.base_target_ml,
            activity_adjustment_ml=step_activity.hydration_adjustment_ml,
            target_ml=target.base_target_ml + step_activity.hydration_adjustment_ml,
            reason=f"{target.reason} Adim verisine gore +{step_activity.hydration_adjustment_ml} ml eklendi.",
        )

    def _build_feedback(
        self,
        *,
        consumed_ml: int,
        target_ml: int,
        completion_percent: float,
        status: str,
        reference_time: str | None,
        expected_progress_percent: float,
        time_status: str,
    ) -> HydrationFeedback:
        hour = self._resolve_hour(reference_time)
        remaining_ml = max(target_ml - consumed_ml, 0)
        if status == "above_target":
            message = "Kontrol sende."
            next_hint = "Bugünü burada kapat."
        elif status == "complete":
            message = "Plan çalışıyor."
            next_hint = "Düzeni koru."
        elif time_status == "ahead":
            message = "Öndesin. Bu seviyeyi koru."
            next_hint = "Küçük yudumlarla sürdür."
        elif time_status == "on_track":
            message = "Ritmi yakaladın."
            if hour < 12:
                next_hint = "Öğlene kadar 1 bardak daha ekle."
            elif hour < 18:
                next_hint = "Akşama doğru 250 ml daha tamamla."
            else:
                next_hint = "Günü kapatmadan küçük bir ekleme yap."
        elif completion_percent >= max(expected_progress_percent - 8, 0):
            message = "Şimdi doğru gidiyorsun."
            next_hint = "Bir bardak daha ekle."
        else:
            message = "Geridesin. Hemen toparla."
            if hour < 12:
                next_hint = "Şimdi 1 bardak su ekle."
            elif hour < 18:
                next_hint = "Şimdi 400 ml iç."
            else:
                next_hint = "Geceye kalmadan 1 bardak daha iç."

        return HydrationFeedback(
            message=message,
            completion_percent=completion_percent,
            remaining_ml=remaining_ml,
            status=status,
            next_hint=next_hint,
        )

    @staticmethod
    def _calculate_completion_percent(*, consumed_ml: int, target_ml: int) -> float:
        if target_ml <= 0:
            return 0.0
        return round((consumed_ml / target_ml) * 100, 1)

    @staticmethod
    def _calculate_score(*, completion_percent: float) -> int:
        if completion_percent < 50:
            score = 30 + ((completion_percent / 50) * 20)
            return round(max(30, min(score, 50)))
        if completion_percent < 90:
            score = 60 + (((completion_percent - 50) / 40) * 25)
            return round(max(60, min(score, 85)))
        if completion_percent <= 110:
            score = 90 + (((completion_percent - 90) / 20) * 10)
            return round(max(90, min(score, 100)))
        penalty = min((completion_percent - 110) * 0.4, 8)
        return round(max(92, 100 - penalty))

    def _calculate_expected_progress_percent(
        self,
        *,
        summary_date: str,
        reference_time: str | None,
    ) -> float:
        reference_local = self._resolve_reference_datetime(reference_time)
        summary_day = date_cls.fromisoformat(summary_date)

        if summary_day < reference_local.date():
            return 100.0
        if summary_day > reference_local.date():
            return 0.0

        minutes = reference_local.hour * 60 + reference_local.minute
        morning_start = 8 * 60
        midday_start = 12 * 60
        evening_start = 17 * 60
        day_end = 22 * 60

        if minutes <= morning_start:
            return 0.0
        if minutes >= day_end:
            return 100.0
        if minutes < midday_start:
            return round(((minutes - morning_start) / (midday_start - morning_start)) * 30, 1)
        if minutes < evening_start:
            return round(30 + (((minutes - midday_start) / (evening_start - midday_start)) * 40), 1)
        return round(70 + (((minutes - evening_start) / (day_end - evening_start)) * 30), 1)

    @staticmethod
    def _resolve_time_status(progress_gap: float) -> str:
        if progress_gap >= 4:
            return "ahead"
        if progress_gap <= -4:
            return "behind_schedule"
        return "on_track"

    @staticmethod
    def _build_next_action(
        *,
        time_status: str,
        progress_gap: float,
        target_ml: int,
        remaining_ml: int,
    ) -> HydrationNextAction:
        if remaining_ml <= 0:
            return HydrationNextAction(suggested_ml=0, quick_action_label="Ritmi koru")

        if time_status == "behind_schedule":
            raw_ml = max(int(round((abs(progress_gap) / 100) * target_ml)), 250)
            suggested_ml = min(remaining_ml, HydrationService._round_to_50(raw_ml))
            return HydrationNextAction(
                suggested_ml=suggested_ml,
                quick_action_label=f"Şimdi {suggested_ml} ml iç",
            )

        if time_status == "ahead":
            suggested_ml = min(remaining_ml, 200)
            return HydrationNextAction(
                suggested_ml=suggested_ml,
                quick_action_label=f"{suggested_ml} ml ile ritmi koru",
            )

        suggested_ml = min(remaining_ml, 250)
        return HydrationNextAction(
            suggested_ml=suggested_ml,
            quick_action_label=f"Şimdi {suggested_ml} ml iç",
        )

    @staticmethod
    def _round_to_50(value: int) -> int:
        return int(round(value / 50) * 50)

    @staticmethod
    def _validate_reminder_times(start_time: str, end_time: str) -> None:
        start_minutes = HydrationService._time_to_minutes(start_time)
        end_minutes = HydrationService._time_to_minutes(end_time)
        if start_minutes >= end_minutes:
            raise ValueError("Hatırlatma bitiş saati başlangıçtan sonra olmalı.")

    @staticmethod
    def _time_to_minutes(value: str) -> int:
        hour_text, minute_text = value.split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            raise ValueError("Saat aralığı geçersiz.")
        return (hour * 60) + minute

    @staticmethod
    def _interval_label(interval_minutes: int | HydrationReminderIntervalMinutes) -> str:
        normalized = int(interval_minutes)
        if normalized == 90:
            return "1.5 saat"
        if normalized == 150:
            return "2.5 saat"
        if normalized >= 60:
            return f"{normalized / 60:g} saat"
        return f"{normalized} dk"

    @staticmethod
    def _convert_to_ml(amount: float, unit: str, default_glass_ml: int) -> int:
        normalized_unit = str(unit).lower()
        if normalized_unit == "glass":
            return int(round(amount * default_glass_ml))
        if normalized_unit == "liter":
            return int(round(amount * 1000))
        return int(round(amount))

    @staticmethod
    def _resolve_status(consumed_ml: int, target_ml: int) -> str:
        if target_ml <= 0:
            return "low"
        if consumed_ml > target_ml:
            return "above_target"
        if consumed_ml == target_ml:
            return "complete"
        if consumed_ml >= int(target_ml * 0.5):
            return "on_track"
        return "low"

    @staticmethod
    def _to_log_entry(entry: StoredWaterLogEntry) -> WaterLogEntry:
        return WaterLogEntry(
            id=entry.id,
            user_id=entry.user_id,
            amount_ml=entry.amount_ml,
            source_unit=entry.source_unit,
            source_value=entry.source_value,
            logged_at=entry.logged_at,
            note=entry.note,
        )

    @staticmethod
    def _now_iso() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _resolve_hour(reference_time: str | None) -> int:
        if not reference_time:
            return datetime.now(HYDRATION_LOCAL_TZ).hour
        try:
            parsed = datetime.fromisoformat(reference_time.replace("Z", "+00:00"))
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed.astimezone(HYDRATION_LOCAL_TZ).hour
        except ValueError:
            return datetime.now(HYDRATION_LOCAL_TZ).hour

    @staticmethod
    def _resolve_reference_datetime(reference_time: str | None) -> datetime:
        if reference_time:
            try:
                parsed = datetime.fromisoformat(reference_time.replace("Z", "+00:00"))
                if parsed.tzinfo is None:
                    parsed = parsed.replace(tzinfo=timezone.utc)
                return parsed.astimezone(HYDRATION_LOCAL_TZ)
            except ValueError:
                pass
        return datetime.now(HYDRATION_LOCAL_TZ)
