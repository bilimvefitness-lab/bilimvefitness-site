from app.schemas.nutrition import (
    ClarificationQuestion,
    MacroTotals,
    NutritionCalculateResponse,
    NutritionCalculatedItem,
    ParsedNutritionItem,
)
from app.services.nutrition_foods import FoodCatalog


class NutritionCalculationService:
    def __init__(self, food_catalog: FoodCatalog) -> None:
        self.food_catalog = food_catalog

    def calculate(self, items: list[ParsedNutritionItem]) -> NutritionCalculateResponse:
        calculated_items: list[NutritionCalculatedItem] = []
        clarification_questions: list[ClarificationQuestion] = []
        total_kcal = 0.0
        total_protein = 0.0
        total_carbs = 0.0
        total_fat = 0.0
        excluded_item_count = 0

        for index, item in enumerate(items):
            nutrition = None
            calculation_basis: str | None = None
            needs_clarification = False
            clarification_reason = None
            confidence_score = item.confidence_score
            confidence_level = item.confidence_level

            if not item.canonical_food_id or item.estimated_weight_g is None:
                excluded_item_count += 1
                needs_clarification = True
                clarification_reason = "Hesaplama için net miktar gerekli."
                clarification_questions.append(
                    ClarificationQuestion(
                        item_index=index,
                        raw_text=item.raw_text,
                        question=clarification_reason,
                        suggested_options=["gram", "adet", "kase", "tabak"],
                    )
                )
            else:
                food = self.food_catalog.get_food(item.canonical_food_id)
                if food is None:
                    excluded_item_count += 1
                    needs_clarification = True
                    clarification_reason = "Besin eşleşmesi bulunamadı."
                else:
                    weight_multiplier = item.estimated_weight_g / 100.0
                    nutrition = MacroTotals(
                        kcal=round(food.kcal_per_100g * weight_multiplier, 2),
                        protein_g=round(food.protein_per_100g * weight_multiplier, 2),
                        carbs_g=round(food.carbs_per_100g * weight_multiplier, 2),
                        fat_g=round(food.fat_per_100g * weight_multiplier, 2),
                    )
                    calculation_basis = f"{round(item.estimated_weight_g, 2)} g üzerinden hesaplandı."
                    if item.confidence_level == "low":
                        confidence_score = max(item.confidence_score, 0.6)
                        confidence_level = "medium"
                    total_kcal += nutrition.kcal
                    total_protein += nutrition.protein_g
                    total_carbs += nutrition.carbs_g
                    total_fat += nutrition.fat_g

            calculated_items.append(
                NutritionCalculatedItem(
                    **item.model_dump(
                        exclude={
                            "confidence_level",
                            "confidence_score",
                            "needs_clarification",
                            "clarification_reason",
                        }
                    ),
                    confidence_level=confidence_level,
                    confidence_score=confidence_score,
                    nutrition=nutrition,
                    calculation_basis=calculation_basis,
                    needs_clarification=needs_clarification,
                    clarification_reason=clarification_reason,
                )
            )

        confidence_score = self._overall_confidence(calculated_items)
        confidence_level = self._confidence_level(confidence_score)

        return NutritionCalculateResponse(
            items=calculated_items,
            meal_totals=MacroTotals(
                kcal=round(total_kcal, 2),
                protein_g=round(total_protein, 2),
                carbs_g=round(total_carbs, 2),
                fat_g=round(total_fat, 2),
            ),
            confidence_level=confidence_level,
            confidence_score=confidence_score,
            needs_clarification=bool(clarification_questions),
            clarification_questions=clarification_questions,
            excluded_item_count=excluded_item_count,
        )

    def _overall_confidence(self, items: list[NutritionCalculatedItem]) -> float:
        if not items:
            return 0.0
        return round(sum(item.confidence_score for item in items) / len(items), 2)

    def _confidence_level(self, score: float) -> str:
        if score >= 0.85:
            return "high"
        if score >= 0.55:
            return "medium"
        return "low"
