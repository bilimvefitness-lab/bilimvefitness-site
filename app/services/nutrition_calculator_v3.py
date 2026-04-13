from app.schemas.nutrition import (
    ClarificationQuestion,
    MacroTotals,
    NutritionCalculateResponse,
    NutritionCalculatedItem,
    ParsedNutritionItem,
)
from app.services.nutrition_food_catalog_v2 import FoodCatalog


class NutritionCalculationServiceV3:
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
            calculation_basis = None
            needs_clarification = item.needs_clarification
            clarification_reason = item.clarification_reason
            confidence_score = item.confidence_score
            confidence_level = item.confidence_level

            if not item.canonical_food_id or item.estimated_weight_g is None:
                excluded_item_count += 1
                needs_clarification = True
                clarification_reason = clarification_reason or "Hesaplama için net miktar gerekli."
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
                    clarification_questions.append(
                        ClarificationQuestion(
                            item_index=index,
                            raw_text=item.raw_text,
                            question=clarification_reason,
                            suggested_options=[],
                        )
                    )
                else:
                    weight_multiplier = item.estimated_weight_g / 100.0
                    nutrition = MacroTotals(
                        kcal=round(food.kcal_per_100g * weight_multiplier, 2),
                        protein_g=round(food.protein_per_100g * weight_multiplier, 2),
                        carbs_g=round(food.carbs_per_100g * weight_multiplier, 2),
                        fat_g=round(food.fat_per_100g * weight_multiplier, 2),
                    )
                    calculation_basis = self._build_calculation_basis(item)

                    if item.needs_clarification and clarification_reason:
                        clarification_questions.append(
                            ClarificationQuestion(
                                item_index=index,
                                raw_text=item.raw_text,
                                question=clarification_reason,
                                suggested_options=["kucuk", "orta", "buyuk", "gram"],
                            )
                        )
                    elif item.estimated and item.confidence_level == "medium":
                        confidence_score = min(0.84, item.confidence_score)

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
                    needs_clarification=needs_clarification,
                    clarification_reason=clarification_reason,
                    nutrition=nutrition,
                    calculation_basis=calculation_basis,
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
            needs_clarification=any(item.needs_clarification for item in calculated_items),
            clarification_questions=self._dedupe_questions(clarification_questions),
            excluded_item_count=excluded_item_count,
        )

    def _build_calculation_basis(self, item: ParsedNutritionItem) -> str:
        range_text = ""
        if item.estimated_weight_min_g is not None and item.estimated_weight_max_g is not None:
            min_weight = round(item.estimated_weight_min_g, 2)
            max_weight = round(item.estimated_weight_max_g, 2)
            if min_weight != max_weight:
                range_text = f" Tahmini aralık: {min_weight}-{max_weight} g."

        if item.needs_clarification:
            return f"{round(item.estimated_weight_g or 0, 2)} g üzerinden tahmini hesaplandı.{range_text} Kaydetmeden önce doğrula."
        if item.estimated:
            return f"{round(item.estimated_weight_g or 0, 2)} g üzerinden tahmini hesaplandı.{range_text}"
        return f"{round(item.estimated_weight_g or 0, 2)} g üzerinden hesaplandı.{range_text}"

    def _overall_confidence(self, items: list[NutritionCalculatedItem]) -> float:
        if not items:
            return 0.0
        return round(sum(item.confidence_score for item in items) / len(items), 2)

    def _confidence_level(self, score: float) -> str:
        if score >= 0.85:
            return "high"
        if score >= 0.6:
            return "medium"
        return "low"

    def _dedupe_questions(self, questions: list[ClarificationQuestion]) -> list[ClarificationQuestion]:
        seen: set[tuple[int, str]] = set()
        deduped: list[ClarificationQuestion] = []
        for question in questions:
            key = (question.item_index, question.question)
            if key in seen:
                continue
            deduped.append(question)
            seen.add(key)
        return deduped
