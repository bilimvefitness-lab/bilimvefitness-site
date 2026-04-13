from dataclasses import dataclass
from datetime import datetime, timezone

from app.schemas.user_profile import (
    ActivityLevel,
    GoalCalculation,
    GoalType,
    MacroTargetExplanation,
    UserProfilePayload,
)


@dataclass(frozen=True, slots=True)
class GoalStrategy:
    calorie_adjustment_kcal: float
    protein_g_per_kg: float
    fat_g_per_kg: float


class GoalEngine:
    _activity_multipliers: dict[ActivityLevel, float] = {
        "sedentary": 1.2,
        "light": 1.375,
        "moderate": 1.55,
        "active": 1.725,
        "very_active": 1.9,
    }

    def calculate(self, profile: UserProfilePayload) -> GoalCalculation:
        bmr_kcal = self._calculate_bmr(
            weight_kg=profile.weight_kg,
            height_cm=profile.height_cm,
            age=profile.age,
            gender=profile.gender,
        )
        activity_multiplier = self._activity_multipliers[profile.activity_level]
        tdee_kcal = round(bmr_kcal * activity_multiplier, 2)
        strategy = self._goal_strategy(profile.goal, profile.activity_level, profile.training_frequency_per_week)
        calorie_target_kcal = self._goal_calories(
            tdee_kcal=tdee_kcal,
            adjustment_kcal=strategy.calorie_adjustment_kcal,
            gender=profile.gender,
        )

        protein_grams = round(profile.weight_kg * strategy.protein_g_per_kg, 1)
        fat_grams = round(profile.weight_kg * strategy.fat_g_per_kg, 1)
        protein_kcal = round(protein_grams * 4, 1)
        fat_kcal = round(fat_grams * 9, 1)
        carb_kcal = max(round(calorie_target_kcal - protein_kcal - fat_kcal, 1), 0.0)
        carb_grams = round(carb_kcal / 4, 1)

        explanations = self._build_explanations(
            profile=profile,
            bmr_kcal=bmr_kcal,
            activity_multiplier=activity_multiplier,
            tdee_kcal=tdee_kcal,
            strategy=strategy,
            calorie_target_kcal=calorie_target_kcal,
            protein_grams=protein_grams,
            fat_grams=fat_grams,
            carb_grams=carb_grams,
        )

        return GoalCalculation(
            bmr_kcal=bmr_kcal,
            activity_multiplier=activity_multiplier,
            tdee_kcal=tdee_kcal,
            calorie_adjustment_kcal=strategy.calorie_adjustment_kcal,
            calorie_target_kcal=calorie_target_kcal,
            protein=MacroTargetExplanation(
                grams=protein_grams,
                grams_per_kg=strategy.protein_g_per_kg,
                calories=protein_kcal,
                rationale=self._protein_rationale(profile.goal, strategy.protein_g_per_kg),
            ),
            fat=MacroTargetExplanation(
                grams=fat_grams,
                grams_per_kg=strategy.fat_g_per_kg,
                calories=fat_kcal,
                rationale=self._fat_rationale(profile.goal, strategy.fat_g_per_kg),
            ),
            carbs_g=carb_grams,
            carbs_kcal=carb_kcal,
            explanations=explanations,
            calculated_at=datetime.now(timezone.utc).isoformat(),
        )

    def _calculate_bmr(self, weight_kg: float, height_cm: float, age: int, gender: str) -> float:
        gender_offset = 5 if gender == "male" else -161
        return round((10 * weight_kg) + (6.25 * height_cm) - (5 * age) + gender_offset, 2)

    def _goal_strategy(
        self,
        goal: GoalType,
        activity_level: ActivityLevel,
        training_frequency_per_week: int,
    ) -> GoalStrategy:
        if goal == "fat_loss":
            adjustment = {
                "sedentary": -300,
                "light": -350,
                "moderate": -400,
                "active": -450,
                "very_active": -500,
            }[activity_level]
            protein_g_per_kg = 2.2
            fat_g_per_kg = 0.7
        elif goal == "muscle_gain":
            adjustment = {
                "sedentary": 200,
                "light": 250,
                "moderate": 300,
                "active": 350,
                "very_active": 400,
            }[activity_level]
            protein_g_per_kg = 1.8 if training_frequency_per_week < 4 else 1.9
            fat_g_per_kg = 0.8
        elif goal == "recomposition":
            adjustment = -100 if training_frequency_per_week >= 4 else -150
            protein_g_per_kg = 2.0
            fat_g_per_kg = 0.7
        else:
            adjustment = 0
            protein_g_per_kg = 1.6
            fat_g_per_kg = 0.8

        return GoalStrategy(
            calorie_adjustment_kcal=float(adjustment),
            protein_g_per_kg=protein_g_per_kg,
            fat_g_per_kg=fat_g_per_kg,
        )

    def _goal_calories(self, tdee_kcal: float, adjustment_kcal: float, gender: str) -> float:
        target = tdee_kcal + adjustment_kcal
        minimum_target = 1500 if gender == "male" else 1200
        return round(max(target, minimum_target), 1)

    def _build_explanations(
        self,
        profile: UserProfilePayload,
        bmr_kcal: float,
        activity_multiplier: float,
        tdee_kcal: float,
        strategy: GoalStrategy,
        calorie_target_kcal: float,
        protein_grams: float,
        fat_grams: float,
        carb_grams: float,
    ) -> list[str]:
        adjustment_text = f"{strategy.calorie_adjustment_kcal:+.0f} kcal"
        return [
            (
                "BMR used Mifflin-St Jeor: "
                f"(10 x {profile.weight_kg:.1f}) + (6.25 x {profile.height_cm:.1f}) - (5 x {profile.age}) "
                f"+ {'5' if profile.gender == 'male' else '-161'} = {bmr_kcal:.1f} kcal."
            ),
            (
                f"TDEE used activity multiplier {activity_multiplier:.3f} for {profile.activity_level} activity: "
                f"{bmr_kcal:.1f} x {activity_multiplier:.3f} = {tdee_kcal:.1f} kcal."
            ),
            (
                f"Goal calories used the {profile.goal} rule with adjustment {adjustment_text}, "
                f"resulting in {calorie_target_kcal:.1f} kcal."
            ),
            (
                f"Protein target is {strategy.protein_g_per_kg:.1f} g/kg, which gives {protein_grams:.1f} g per day."
            ),
            f"Fat target is {strategy.fat_g_per_kg:.1f} g/kg, which gives {fat_grams:.1f} g per day.",
            f"Carbs fill the remaining calories after protein and fat, resulting in {carb_grams:.1f} g per day.",
        ]

    @staticmethod
    def _protein_rationale(goal: GoalType, grams_per_kg: float) -> str:
        if goal == "fat_loss":
            return (
                f"High protein at {grams_per_kg:.1f} g/kg supports muscle retention while eating below maintenance."
            )
        if goal == "muscle_gain":
            return f"Protein at {grams_per_kg:.1f} g/kg supports recovery and growth during a calorie surplus."
        if goal == "recomposition":
            return f"Protein at {grams_per_kg:.1f} g/kg supports recomposition while staying near maintenance."
        return f"Protein at {grams_per_kg:.1f} g/kg covers maintenance and recovery needs."

    @staticmethod
    def _fat_rationale(goal: GoalType, grams_per_kg: float) -> str:
        if goal == "fat_loss":
            return f"Fat stays moderate at {grams_per_kg:.1f} g/kg to preserve hormones and leave room for carbs."
        if goal == "muscle_gain":
            return f"Fat at {grams_per_kg:.1f} g/kg supports hormones while preserving room for higher carbs."
        if goal == "recomposition":
            return f"Fat at {grams_per_kg:.1f} g/kg balances satiety and training support."
        return f"Fat at {grams_per_kg:.1f} g/kg keeps a stable maintenance baseline."
