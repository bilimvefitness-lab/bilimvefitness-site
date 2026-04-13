from datetime import date, timedelta

from app.schemas.nutrition import (
    BehaviorScoreComponent,
    BehaviorStreak,
    BehaviorStreaks,
    ConfidenceSummary,
    DailyBehaviorScore,
    MealEntry,
    MealEntryItem,
)


class BehaviorEngine:
    def build_meal_confidence(self, items: list[MealEntryItem]) -> ConfidenceSummary:
        if not items:
            return ConfidenceSummary(
                score=0,
                level="low",
                explanation="Kayit bos; confidence olusmadi.",
            )

        raw_score = sum(float(item.confidence_score) * 100 for item in items) / len(items)
        low_confidence_count = sum(1 for item in items if item.confidence_level == "low" or item.confidence_score < 0.72)
        wide_range_count = sum(1 for item in items if self._has_wide_portion_range(item))
        estimated_count = sum(1 for item in items if self._is_estimated(item))
        clarified_count = sum(1 for item in items if item.portion_source == "clarification_choice")
        history_count = sum(1 for item in items if item.portion_source == "user_history")

        adjusted_score = raw_score
        adjusted_score -= estimated_count * 4
        adjusted_score -= wide_range_count * 6
        adjusted_score -= low_confidence_count * 8
        adjusted_score += clarified_count * 3
        adjusted_score += history_count * 2

        score = int(round(self._clamp(adjusted_score, 25, 99)))
        level = self._confidence_level(score)
        return ConfidenceSummary(
            score=score,
            level=level,
            explanation=self._meal_confidence_explanation(
                score=score,
                estimated_count=estimated_count,
                wide_range_count=wide_range_count,
                low_confidence_count=low_confidence_count,
                clarified_count=clarified_count,
            ),
        )

    def build_confidence_overview(self, meals: list[MealEntry]) -> ConfidenceSummary | None:
        scored_meals = [meal.confidence for meal in meals if meal.confidence is not None]
        if not scored_meals:
            return None

        score = int(round(sum(item.score for item in scored_meals) / len(scored_meals)))
        level = self._confidence_level(score)
        if score >= 85:
            explanation = "Gunluk kayit guveni yuksek; porsiyonlar net."
        elif score >= 65:
            explanation = "Gunluk kayit guveni orta; bazi porsiyonlar tahmini."
        else:
            explanation = "Gunluk kayit guveni dusuk; sonraki ogunde gramla giris daha iyi olur."

        return ConfidenceSummary(
            score=score,
            level=level,
            explanation=explanation,
        )

    def build_daily_score(
        self,
        *,
        actual_protein_g: float,
        protein_target_g: float,
        actual_kcal: float,
        calorie_target_kcal: float,
        meal_count: int,
    ) -> DailyBehaviorScore:
        protein_score = self._protein_score(actual_protein_g, protein_target_g)
        calorie_score = self._calorie_score(actual_kcal, calorie_target_kcal)
        logging_score = self._logging_score(meal_count)

        components = [
            BehaviorScoreComponent(
                key="protein",
                score=protein_score,
                explanation=self._protein_score_explanation(actual_protein_g, protein_target_g, protein_score),
            ),
            BehaviorScoreComponent(
                key="calories",
                score=calorie_score,
                explanation=self._calorie_score_explanation(actual_kcal, calorie_target_kcal, calorie_score),
            ),
            BehaviorScoreComponent(
                key="logging",
                score=logging_score,
                explanation=self._logging_score_explanation(meal_count, logging_score),
            ),
        ]
        total = int(round((protein_score * 0.4) + (calorie_score * 0.35) + (logging_score * 0.25)))
        status = self._score_status(total)
        priority_component = min(components, key=lambda item: item.score).key

        return DailyBehaviorScore(
            total=total,
            status=status,
            priority_component=priority_component,
            explanation=self._daily_score_explanation(total, components),
            components=components,
        )

    def build_streaks(
        self,
        *,
        analysis_date: str,
        daily_totals: dict[str, dict[str, float | int]],
        protein_target_g: float,
    ) -> BehaviorStreaks:
        logging_count = self._count_consecutive_days(
            analysis_date=analysis_date,
            predicate=lambda current: int(current.get("meal_count", 0)) > 0,
            daily_totals=daily_totals,
        )
        protein_count = self._count_consecutive_days(
            analysis_date=analysis_date,
            predicate=lambda current: int(current.get("meal_count", 0)) > 0
            and float(current.get("protein_g", 0.0)) >= protein_target_g * 0.9,
            daily_totals=daily_totals,
        )

        return BehaviorStreaks(
            logging=BehaviorStreak(
                count=logging_count,
                active=logging_count > 0,
                label=self._streak_label(logging_count),
                explanation=self._logging_streak_explanation(logging_count),
            ),
            protein_target=BehaviorStreak(
                count=protein_count,
                active=protein_count > 0,
                label=self._streak_label(protein_count),
                explanation=self._protein_streak_explanation(protein_count),
            ),
        )

    def _protein_score(self, actual: float, target: float) -> int:
        if target <= 0:
            return 100
        return int(round(self._clamp(min(actual / target, 1.0) * 100, 0, 100)))

    def _calorie_score(self, actual: float, target: float) -> int:
        if target <= 0:
            return 100
        difference_ratio = abs(actual - target) / target
        score = 100 - round(difference_ratio * 220)
        return int(self._clamp(score, 0, 100))

    def _logging_score(self, meal_count: int) -> int:
        if meal_count <= 0:
            return 0
        if meal_count == 1:
            return 45
        if meal_count == 2:
            return 75
        return 100

    def _daily_score_explanation(self, total: int, components: list[BehaviorScoreComponent]) -> str:
        best_component = max(components, key=lambda item: item.score).key
        weakest_component = min(components, key=lambda item: item.score).key
        if total >= 80:
            return f"Skor guclu; en iyi alan {self._component_label(best_component)}."
        if total >= 60:
            return f"Skor orta; once {self._component_label(weakest_component)} duzelmeli."
        return f"Skor kirilgan; oncelik {self._component_label(weakest_component)}."

    def _protein_score_explanation(self, actual: float, target: float, score: int) -> str:
        if target <= 0:
            return "Protein hedefi tanimsiz."
        if score >= 95:
            return f"Protein hedefi kapandi: {actual:.0f}/{target:.0f} g."
        if score >= 80:
            return f"Protein hedefe yakin: {actual:.0f}/{target:.0f} g."
        if score >= 60:
            return f"Protein acigi buyuyor: {actual:.0f}/{target:.0f} g."
        return f"Protein ana acikta: {actual:.0f}/{target:.0f} g."

    def _calorie_score_explanation(self, actual: float, target: float, score: int) -> str:
        if target <= 0:
            return "Kalori hedefi tanimsiz."
        if score >= 90:
            return f"Kalori hedefe yakin: {actual:.0f}/{target:.0f} kcal."
        if actual > target:
            return f"Kalori tasiyor: {actual:.0f}/{target:.0f} kcal."
        return f"Kalori hedefin altinda: {actual:.0f}/{target:.0f} kcal."

    def _logging_score_explanation(self, meal_count: int, score: int) -> str:
        if score >= 100:
            return "Gun icinde kayit duzeni tam."
        if score >= 75:
            return "Kayit iyi gidiyor ama bir ogun daha netlik saglar."
        if score > 0:
            return "Kayit parcali; gunun resmi eksik kaliyor."
        return "Bugun henuz ogun logu yok."

    def _count_consecutive_days(
        self,
        *,
        analysis_date: str,
        predicate,
        daily_totals: dict[str, dict[str, float | int]],
    ) -> int:
        current_date = date.fromisoformat(analysis_date)
        streak = 0
        while True:
            payload = daily_totals.get(current_date.isoformat())
            if not payload or not predicate(payload):
                return streak
            streak += 1
            current_date -= timedelta(days=1)

    def _logging_streak_explanation(self, count: int) -> str:
        if count <= 0:
            return "Log serisi bugun aktif degil."
        if count == 1:
            return "Log serisi bugun yeniden basladi."
        return f"{count} gundur ust uste log aliyorsun."

    def _protein_streak_explanation(self, count: int) -> str:
        if count <= 0:
            return "Protein hedef serisi bugun aktif degil."
        if count == 1:
            return "Protein hedefi bugun tutuldu."
        return f"Protein hedefi {count} gundur ust uste tutuluyor."

    def _streak_label(self, count: int) -> str:
        return f"{count} gun"

    def _meal_confidence_explanation(
        self,
        *,
        score: int,
        estimated_count: int,
        wide_range_count: int,
        low_confidence_count: int,
        clarified_count: int,
    ) -> str:
        if score >= 85:
            return "Porsiyonlar net, kayit guveni yuksek."
        if clarified_count > 0 and low_confidence_count == 0:
            return "Secimle netlestirilen porsiyonlar kaydi toparliyor."
        if low_confidence_count > 0 or wide_range_count > 0:
            return "Bazi satirlar tahmini; sonraki giriste gram secmek daha iyi olur."
        if estimated_count > 0:
            return "Birkac porsiyon tahmini ama kayit kullanilabilir."
        return "Kayit orta guvende; porsiyon netligi artabilir."

    def _confidence_level(self, score: int) -> str:
        if score >= 85:
            return "high"
        if score >= 65:
            return "medium"
        return "low"

    def _score_status(self, score: int) -> str:
        if score >= 80:
            return "strong"
        if score >= 60:
            return "fair"
        return "fragile"

    def _component_label(self, key: str) -> str:
        if key == "protein":
            return "protein"
        if key == "calories":
            return "kalori dengesi"
        return "kayit tamligi"

    def _is_estimated(self, item: MealEntryItem) -> bool:
        if item.portion_source == "clarification_choice":
            return False
        if item.portion_source == "user_history":
            return False
        return self._has_wide_portion_range(item)

    def _has_wide_portion_range(self, item: MealEntryItem) -> bool:
        if item.estimated_weight_min_g is None or item.estimated_weight_max_g is None or item.estimated_weight_g <= 0:
            return False
        spread = item.estimated_weight_max_g - item.estimated_weight_min_g
        return (spread / item.estimated_weight_g) >= 0.25

    def _clamp(self, value: float, lower: float, upper: float) -> float:
        return max(lower, min(value, upper))
