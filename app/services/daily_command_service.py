from datetime import date as date_cls
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.db.user_profile_store import JsonUserProfileStore, StoredGoalCalculation, StoredUserProfile
from app.schemas.dashboard import DailyCommandMetrics, DailyCommandResponse, DailyCommandSubStatus
from app.schemas.hydration import DailyHydrationSummary
from app.schemas.user_profile import GoalCalculation, UserProfilePayload
from app.services.goal_engine import GoalEngine
from app.services.hydration_service import HydrationService
from app.services.meal_logging import MealLoggingService


DEFAULT_PROTEIN_TARGET_G = 160.0
DEFAULT_CALORIE_TARGET_KCAL = 2200.0
try:
    DAILY_COMMAND_TZ = ZoneInfo("Europe/Istanbul")
except ZoneInfoNotFoundError:
    DAILY_COMMAND_TZ = timezone(timedelta(hours=3))


class DailyCommandService:
    def __init__(
        self,
        *,
        meal_logging_service: MealLoggingService,
        hydration_service: HydrationService,
        user_profile_store: JsonUserProfileStore,
        goal_engine: GoalEngine,
    ) -> None:
        self.meal_logging_service = meal_logging_service
        self.hydration_service = hydration_service
        self.user_profile_store = user_profile_store
        self.goal_engine = goal_engine

    async def build_daily_command(
        self,
        *,
        user_id: str,
        date: str,
        protein_target_g: float | None = None,
        calorie_target_kcal: float | None = None,
    ) -> DailyCommandResponse:
        profile = await self.user_profile_store.get_profile(user_id)
        goals = self._resolve_goals(profile)

        resolved_protein_target = round(
            float(protein_target_g or (goals.protein.grams if goals else DEFAULT_PROTEIN_TARGET_G)),
            2,
        )
        resolved_calorie_target = round(
            float(calorie_target_kcal or (goals.calorie_target_kcal if goals else DEFAULT_CALORIE_TARGET_KCAL)),
            2,
        )

        if resolved_protein_target <= 0 or resolved_calorie_target <= 0:
            raise LookupError("Komut merkezi için önce hedeflerini oluştur.")

        nutrition_summary = await self.meal_logging_service.get_daily_summary(date=date, user_id=user_id)
        hydration_summary = await self._safe_get_hydration_summary(user_id=user_id, date=date)
        hydration_glass_ml = await self._safe_get_hydration_glass_ml(user_id=user_id)

        protein_percent = self._ratio_percent(nutrition_summary.total_protein_g, resolved_protein_target)
        calorie_percent = self._ratio_percent(nutrition_summary.total_kcal, resolved_calorie_target)
        hydration_percent = float(hydration_summary.completion_percent if hydration_summary else 0.0)

        protein_gap_g = round(max(resolved_protein_target - float(nutrition_summary.total_protein_g), 0.0), 1)
        calorie_difference_kcal = round(float(nutrition_summary.total_kcal) - resolved_calorie_target, 1)

        protein_status = self._map_protein_status(protein_percent)
        calorie_status = self._map_calorie_status(calorie_percent)
        hydration_status = self._map_hydration_status(hydration_summary)

        primary_domain, priority = self._select_primary_domain(
            analysis_date=date,
            goal=profile.goal if profile else None,
            protein_percent=protein_percent,
            protein_gap_g=protein_gap_g,
            calorie_percent=calorie_percent,
            calorie_difference_kcal=calorie_difference_kcal,
            hydration_summary=hydration_summary,
        )

        hydration_command_ml = self._command_hydration_action_ml(hydration_summary)
        primary_action = self._build_primary_action(
            domain=primary_domain,
            protein_gap_g=protein_gap_g,
            calorie_difference_kcal=calorie_difference_kcal,
            hydration_summary=hydration_summary,
            hydration_command_ml=hydration_command_ml,
        )
        quick_fix = self._build_quick_fix(
            domain=primary_domain,
            protein_gap_g=protein_gap_g,
            calorie_difference_kcal=calorie_difference_kcal,
            hydration_summary=hydration_summary,
            default_glass_ml=hydration_glass_ml,
            hydration_command_ml=hydration_command_ml,
        )
        hydration_quick_add_ml = (
            hydration_command_ml
            if primary_domain == "hydration" and hydration_command_ml > 0
            else None
        )

        return DailyCommandResponse(
            date=date,
            overall_status=self._build_overall_status(
                primary_domain=primary_domain,
                priority=priority,
                protein_status=protein_status,
                calorie_status=calorie_status,
                hydration_status=hydration_status,
            ),
            primary_domain=primary_domain,
            primary_action=primary_action,
            quick_fix=quick_fix,
            priority=priority,
            sub_status=DailyCommandSubStatus(
                protein=protein_status,
                calories=calorie_status,
                hydration=hydration_status,
            ),
            metrics=DailyCommandMetrics(
                protein_percent=protein_percent,
                calorie_percent=calorie_percent,
                hydration_percent=hydration_percent,
            ),
            hydration_quick_add_ml=hydration_quick_add_ml,
        )

    async def _safe_get_hydration_summary(self, *, user_id: str, date: str) -> DailyHydrationSummary | None:
        try:
            return await self.hydration_service.get_daily_summary(user_id=user_id, date=date)
        except LookupError:
            return None

    async def _safe_get_hydration_glass_ml(self, *, user_id: str) -> int:
        try:
            return int((await self.hydration_service.get_profile_response(user_id)).profile.default_glass_ml)
        except LookupError:
            return 250

    def _resolve_goals(self, profile: StoredUserProfile | None) -> GoalCalculation | None:
        if profile is None:
            return None
        if profile.goals is not None:
            return self._to_goal_calculation(profile.goals)
        return self.goal_engine.calculate(
            UserProfilePayload(
                user_id=profile.user_id,
                weight_kg=profile.weight_kg,
                height_cm=profile.height_cm,
                age=profile.age,
                gender=profile.gender,
                activity_level=profile.activity_level,
                training_frequency_per_week=profile.training_frequency_per_week,
                goal=profile.goal,
            )
        )

    @staticmethod
    def _ratio_percent(actual: float, target: float) -> float:
        if target <= 0:
            return 0.0
        return round((float(actual) / float(target)) * 100, 1)

    @staticmethod
    def _map_protein_status(protein_percent: float) -> str:
        if protein_percent < 85:
            return "behind"
        if protein_percent > 110:
            return "ahead"
        return "on_track"

    @staticmethod
    def _map_calorie_status(calorie_percent: float) -> str:
        if calorie_percent < 85:
            return "low"
        if calorie_percent > 110:
            return "high"
        return "on_track"

    @staticmethod
    def _map_hydration_status(hydration_summary: DailyHydrationSummary | None) -> str:
        if hydration_summary is None:
            return "behind"
        if hydration_summary.time_status == "behind_schedule":
            return "behind"
        if hydration_summary.time_status == "ahead" or hydration_summary.status in {"complete", "above_target"}:
            return "ahead"
        return "on_track"

    def _select_primary_domain(
        self,
        *,
        analysis_date: str,
        goal: str | None,
        protein_percent: float,
        protein_gap_g: float,
        calorie_percent: float,
        calorie_difference_kcal: float,
        hydration_summary: DailyHydrationSummary | None,
    ) -> tuple[str, str]:
        hydration_gap = float(hydration_summary.progress_gap) if hydration_summary else 0.0
        hydration_severe = bool(
            hydration_summary
            and hydration_summary.time_status == "behind_schedule"
            and hydration_gap <= -15
        )
        hydration_moderate = bool(
            hydration_summary
            and hydration_summary.time_status == "behind_schedule"
        )
        protein_severe = protein_percent < 60 or protein_gap_g >= 35
        protein_moderate = protein_percent < 85 or protein_gap_g >= 20
        calorie_high_severe = calorie_percent > 120 or calorie_difference_kcal >= 400
        calorie_high_moderate = calorie_percent > 110 or calorie_difference_kcal >= 250
        calorie_low_relevant = self._is_calorie_low_relevant(
            analysis_date=analysis_date,
            goal=goal,
            calorie_percent=calorie_percent,
            calorie_difference_kcal=calorie_difference_kcal,
        )

        if hydration_severe:
            return "hydration", "high"
        if protein_severe:
            return "protein", "high"
        if calorie_high_severe:
            return "calories", "high"
        if hydration_moderate:
            return "hydration", "medium"
        if protein_moderate:
            return "protein", "medium"
        if calorie_high_moderate:
            return "calories", "medium"
        if calorie_low_relevant:
            return "calories", "medium"
        return "maintain", "low"

    def _build_primary_action(
        self,
        *,
        domain: str,
        protein_gap_g: float,
        calorie_difference_kcal: float,
        hydration_summary: DailyHydrationSummary | None,
        hydration_command_ml: int,
    ) -> str:
        if domain == "hydration":
            if hydration_command_ml > 0:
                return f"Şimdi {hydration_command_ml} ml su iç."
            return "Şimdi 1 bardak su iç."
        if domain == "protein":
            return f"Bir sonraki öğüne {self._protein_bucket(protein_gap_g):.0f} g protein ekle."
        if domain == "calories":
            if calorie_difference_kcal >= 0:
                return "Bugün ekstra atıştırma açma."
            return "Bugün açığı kapat, bir öğün daha ekle."
        return "Düzeni koru, planı bozma."

    def _build_quick_fix(
        self,
        *,
        domain: str,
        protein_gap_g: float,
        calorie_difference_kcal: float,
        hydration_summary: DailyHydrationSummary | None,
        default_glass_ml: int,
        hydration_command_ml: int,
    ) -> str | None:
        if domain == "hydration":
            if hydration_command_ml > 0:
                return self._hydration_quick_fix(
                    suggested_ml=hydration_command_ml,
                    default_glass_ml=default_glass_ml,
                )
            return None
        if domain == "protein":
            if protein_gap_g >= 35:
                return "1 ölçek whey ya da 150 g tavuk seç."
            if protein_gap_g >= 20:
                return "200 g yoğurt ya da 100 g lor ekle."
            return "Yumurta ya da yoğurtla açığı kapat."
        if domain == "calories":
            if calorie_difference_kcal >= 0:
                return "Yağlı ekleri kıs."
            return "Bir ana öğün daha ekle."
        return None

    @staticmethod
    def _build_overall_status(
        *,
        primary_domain: str,
        priority: str,
        protein_status: str,
        calorie_status: str,
        hydration_status: str,
    ) -> str:
        if primary_domain == "hydration":
            return "En kritik açık: su." if priority == "high" else "İlk iş: su ritmini toparla."
        if primary_domain == "protein":
            return "En kritik açık: protein." if priority == "high" else "İlk iş: proteini toparla."
        if primary_domain == "calories":
            if calorie_status == "high":
                return "Dikkat: kalori taşıyor."
            return "Enerji düşüyor, dengeyi kur."
        if (
            protein_status == "on_track"
            and calorie_status == "on_track"
            and hydration_status in {"on_track", "ahead"}
        ):
            return "Bugün çizgi iyi."
        return "Genel denge korunuyor."

    @staticmethod
    def _is_calorie_low_relevant(
        *,
        analysis_date: str,
        goal: str | None,
        calorie_percent: float,
        calorie_difference_kcal: float,
    ) -> bool:
        if goal == "fat_loss":
            return False
        if calorie_percent >= 70 or calorie_difference_kcal >= -300:
            return False
        try:
            target_date = date_cls.fromisoformat(analysis_date)
        except ValueError:
            return True
        current_local = datetime.now(DAILY_COMMAND_TZ)
        if target_date < current_local.date():
            return True
        if target_date > current_local.date():
            return False
        return current_local.hour >= 17

    @staticmethod
    def _hydration_quick_fix(*, suggested_ml: int, default_glass_ml: int) -> str:
        if suggested_ml <= 0:
            return "Ritmi koru."
        if default_glass_ml <= 0:
            return f"{suggested_ml} ml daha ekle."
        full_glasses = suggested_ml // default_glass_ml
        remainder_ml = suggested_ml % default_glass_ml
        if full_glasses > 0 and remainder_ml == 0:
            return f"{full_glasses} bardak daha ekle."
        if full_glasses > 0 and remainder_ml > 0:
            return f"{full_glasses} bardak + {remainder_ml} ml daha ekle."
        return f"{suggested_ml} ml hemen ekle."

    @staticmethod
    def _command_hydration_action_ml(hydration_summary: DailyHydrationSummary | None) -> int:
        if hydration_summary is None:
            return 0
        suggested_ml = int(hydration_summary.next_action.suggested_ml or 0)
        if suggested_ml <= 0:
            return 0
        if hydration_summary.time_status == "behind_schedule":
            return min(max(suggested_ml, 250), 500)
        if hydration_summary.time_status == "ahead":
            return min(suggested_ml, 200)
        return min(max(suggested_ml, 200), 400)

    @staticmethod
    def _protein_bucket(protein_gap_g: float) -> float:
        if protein_gap_g >= 35:
            return 40.0
        if protein_gap_g >= 20:
            return 30.0
        if protein_gap_g >= 10:
            return 20.0
        return 15.0

    @staticmethod
    def _to_goal_calculation(goals: StoredGoalCalculation) -> GoalCalculation:
        return GoalCalculation(
            bmr_kcal=goals.bmr_kcal,
            activity_multiplier=goals.activity_multiplier,
            tdee_kcal=goals.tdee_kcal,
            calorie_adjustment_kcal=goals.calorie_adjustment_kcal,
            calorie_target_kcal=goals.calorie_target_kcal,
            protein={
                "grams": goals.protein.grams,
                "grams_per_kg": goals.protein.grams_per_kg,
                "calories": goals.protein.calories,
                "rationale": goals.protein.rationale,
            },
            fat={
                "grams": goals.fat.grams,
                "grams_per_kg": goals.fat.grams_per_kg,
                "calories": goals.fat.calories,
                "rationale": goals.fat.rationale,
            },
            carbs_g=goals.carbs_g,
            carbs_kcal=goals.carbs_kcal,
            explanations=list(goals.explanations),
            calculated_at=goals.calculated_at,
        )
