from datetime import datetime, timezone
from uuid import uuid4

from app.db.meal_store import MealStore, StoredMealEntry, StoredMealEntryItem
from app.schemas.sleep import SleepCoachContext
from app.services.adaptive_coach_engine import AdaptiveCoachEngine
from app.services.behavior_engine import BehaviorEngine
from app.services.portion_learning import PortionLearningService
from app.schemas.nutrition import (
    DailyCoachResponse,
    DailySummaryResponse,
    MacroTotals,
    MealEntry,
    MealEntryItem,
    MealSaveRequest,
    NutritionCalculatedItem,
    PrimeCoachMode,
)
from app.schemas.steps import StepActivityContext


class MealLoggingService:
    def __init__(
        self,
        meal_store: MealStore,
        portion_learning_service: PortionLearningService,
        adaptive_coach_engine: AdaptiveCoachEngine,
        behavior_engine: BehaviorEngine,
    ) -> None:
        self.meal_store = meal_store
        self.portion_learning_service = portion_learning_service
        self.adaptive_coach_engine = adaptive_coach_engine
        self.behavior_engine = behavior_engine

    async def save_meal(self, payload: MealSaveRequest) -> MealEntry:
        if any(item.needs_clarification or item.nutrition is None for item in payload.items):
            raise ValueError("Bazı besinler doğrulama gerektiriyor. Kaydetmeden önce netleştir.")

        timestamp = payload.consumed_at or datetime.now(timezone.utc).isoformat()
        date = payload.date or timestamp[:10]
        created_at = datetime.now(timezone.utc).isoformat()
        meal_id = str(uuid4())

        stored_record = StoredMealEntry(
            meal_id=meal_id,
            user_id=payload.user_id,
            meal_type=payload.meal_type,
            date=date,
            consumed_at=timestamp,
            notes=payload.notes,
            items=[
                StoredMealEntryItem(
                    raw_text=item.raw_text,
                    canonical_food_id=item.canonical_food_id or "",
                    canonical_display_name=item.canonical_display_name or "",
                    amount=item.amount,
                    unit=item.unit,
                    estimated_weight_g=item.estimated_weight_g or 0,
                    estimated_weight_min_g=item.estimated_weight_min_g,
                    estimated_weight_max_g=item.estimated_weight_max_g,
                    portion_source=item.portion_source,
                    user_history_samples=item.user_history_samples,
                    confidence_level=item.confidence_level,
                    confidence_score=item.confidence_score,
                    kcal=item.nutrition.kcal if item.nutrition else 0,
                    protein_g=item.nutrition.protein_g if item.nutrition else 0,
                    carbs_g=item.nutrition.carbs_g if item.nutrition else 0,
                    fat_g=item.nutrition.fat_g if item.nutrition else 0,
                    preparation_method=item.preparation_method,
                    modifiers=item.modifiers,
                )
                for item in payload.items
            ],
            total_kcal=payload.totals.kcal,
            total_protein_g=payload.totals.protein_g,
            total_carbs_g=payload.totals.carbs_g,
            total_fat_g=payload.totals.fat_g,
            created_at=created_at,
        )
        await self.meal_store.save_meal(stored_record)
        await self.portion_learning_service.learn_from_items(payload.user_id, payload.items)
        return self._to_meal_entry(stored_record)

    async def get_daily_summary(self, date: str, user_id: str | None = None) -> DailySummaryResponse:
        meals = [self._to_meal_entry(record) for record in await self.meal_store.get_meals_for_date(date, user_id)]
        return DailySummaryResponse(
            date=date,
            total_kcal=round(sum(meal.totals.kcal for meal in meals), 2),
            total_protein_g=round(sum(meal.totals.protein_g for meal in meals), 2),
            total_carbs_g=round(sum(meal.totals.carbs_g for meal in meals), 2),
            total_fat_g=round(sum(meal.totals.fat_g for meal in meals), 2),
            meal_count=len(meals),
            meals=meals,
            confidence_overview=self.behavior_engine.build_confidence_overview(meals),
        )

    async def get_daily_coach(
        self,
        date: str,
        protein_target_g: float,
        calorie_target_kcal: float,
        user_id: str | None = None,
        mode: PrimeCoachMode = "balanced",
        sleep_context: SleepCoachContext | None = None,
        step_activity: StepActivityContext | None = None,
    ) -> DailyCoachResponse:
        summary = await self.get_daily_summary(date, user_id)
        historical_meals = list(await self.meal_store.get_all_meals(user_id))
        daily_rollup = self._rollup_meals_by_date(historical_meals)
        history_window = self.adaptive_coach_engine.build_history_window(
            analysis_date=date,
            calorie_target_kcal=calorie_target_kcal,
            protein_target_g=protein_target_g,
            meals=[
                (item_date, totals["kcal"], totals["protein_g"], totals["meal_count"])
                for item_date, totals in daily_rollup.items()
            ],
        )
        meal_events = self.adaptive_coach_engine.build_meal_events(
            [
                (meal.date, meal.meal_type, meal.consumed_at, meal.total_kcal, meal.total_protein_g)
                for meal in historical_meals
            ],
        )
        behavior_score = self.behavior_engine.build_daily_score(
            actual_protein_g=round(summary.total_protein_g, 2),
            protein_target_g=protein_target_g,
            actual_kcal=round(summary.total_kcal, 2),
            calorie_target_kcal=calorie_target_kcal,
            meal_count=summary.meal_count,
        )
        streaks = self.behavior_engine.build_streaks(
            analysis_date=date,
            daily_totals=daily_rollup,
            protein_target_g=protein_target_g,
        )
        return self.adaptive_coach_engine.build_daily_coach(
            analysis_date=date,
            protein_target_g=protein_target_g,
            calorie_target_kcal=calorie_target_kcal,
            actual_protein_g=round(summary.total_protein_g, 2),
            actual_kcal=round(summary.total_kcal, 2),
            meal_count=summary.meal_count,
            historical_days=history_window,
            historical_meals=meal_events,
            mode=mode,
            behavior_score=behavior_score,
            streaks=streaks,
            confidence_overview=summary.confidence_overview,
            sleep_context=sleep_context,
            step_activity=step_activity,
        )

    def _to_meal_entry(self, record: StoredMealEntry) -> MealEntry:
        items = [
            MealEntryItem(
                raw_text=item.raw_text,
                canonical_food_id=item.canonical_food_id,
                canonical_display_name=item.canonical_display_name,
                amount=item.amount,
                unit=item.unit,
                estimated_weight_g=item.estimated_weight_g,
                estimated_weight_min_g=item.estimated_weight_min_g,
                estimated_weight_max_g=item.estimated_weight_max_g,
                portion_source=item.portion_source,
                user_history_samples=item.user_history_samples,
                confidence_level=item.confidence_level,
                confidence_score=item.confidence_score,
                nutrition=MacroTotals(
                    kcal=item.kcal,
                    protein_g=item.protein_g,
                    carbs_g=item.carbs_g,
                    fat_g=item.fat_g,
                ),
                preparation_method=item.preparation_method,
                modifiers=item.modifiers or [],
            )
            for item in record.items
        ]
        return MealEntry(
            meal_id=record.meal_id,
            user_id=record.user_id,
            meal_type=record.meal_type,
            date=record.date,
            consumed_at=record.consumed_at,
            notes=record.notes,
            items=items,
            totals=MacroTotals(
                kcal=record.total_kcal,
                protein_g=record.total_protein_g,
                carbs_g=record.total_carbs_g,
                fat_g=record.total_fat_g,
            ),
            confidence=self.behavior_engine.build_meal_confidence(items),
            created_at=record.created_at,
        )

    def _rollup_meals_by_date(self, meals: list[StoredMealEntry]) -> dict[str, dict[str, float | int]]:
        daily_totals: dict[str, dict[str, float | int]] = {}
        for meal in meals:
            current = daily_totals.setdefault(
                meal.date,
                {
                    "kcal": 0.0,
                    "protein_g": 0.0,
                    "meal_count": 0,
                },
            )
            current["kcal"] = float(current["kcal"]) + meal.total_kcal
            current["protein_g"] = float(current["protein_g"]) + meal.total_protein_g
            current["meal_count"] = int(current["meal_count"]) + 1
        return daily_totals

    def _build_coaching_message(
        self,
        protein_target_g: float,
        actual_protein_g: float,
        protein_status: str,
        calorie_target_kcal: float,
        actual_kcal: float,
        calorie_balance: str,
    ) -> str:
        if protein_status == "low":
            protein_phrase = f"Protein hedefinin gerisindesin: {actual_protein_g:.0f}/{protein_target_g:.0f} g."
        elif protein_status == "close":
            protein_phrase = f"Protein hedefe yakın: {actual_protein_g:.0f}/{protein_target_g:.0f} g."
        elif protein_status == "on_target":
            protein_phrase = f"Protein hedefin yerinde: {actual_protein_g:.0f}/{protein_target_g:.0f} g."
        else:
            protein_phrase = f"Protein hedefinin üstündesin: {actual_protein_g:.0f}/{protein_target_g:.0f} g."

        if calorie_balance == "surplus":
            calorie_phrase = f"Kaloride fazlan var: {actual_kcal:.0f}/{calorie_target_kcal:.0f} kcal."
        elif calorie_balance == "deficit":
            calorie_phrase = f"Kaloride açıktasın: {actual_kcal:.0f}/{calorie_target_kcal:.0f} kcal."
        else:
            calorie_phrase = f"Kalorin hedefe yakın: {actual_kcal:.0f}/{calorie_target_kcal:.0f} kcal."

        return f"{protein_phrase} {calorie_phrase}"
