from collections import Counter
from dataclasses import dataclass
from difflib import SequenceMatcher

from app.db.meal_store import MealStore, StoredMealEntry
from app.schemas.nutrition import FoodSuggestion, NutritionSuggestResponse
from app.services.nutrition_food_catalog_v2 import FoodCatalog, normalize_food_text


@dataclass(slots=True)
class _SuggestionCandidate:
    canonical_id: str
    display_name_tr: str
    insert_text: str
    matched_text: str
    score: float
    source: str
    usage_count: int = 0
    last_used_at: str | None = None
    brand: str | None = None
    product_name: str | None = None
    is_branded_product: bool = False


class NutritionSuggestionService:
    def __init__(self, food_catalog: FoodCatalog, meal_store: MealStore) -> None:
        self.food_catalog = food_catalog
        self.meal_store = meal_store

    async def suggest(
        self,
        query: str,
        user_id: str | None = None,
        limit: int = 8,
    ) -> NutritionSuggestResponse:
        segment = query.strip()
        normalized = normalize_food_text(segment)
        history = await self._history_index(user_id)

        candidates = self._database_candidates(normalized)
        self._apply_history_boosts(candidates, history)

        if history and normalized:
            self._inject_history_matches(candidates, normalized, history)

        ranked = sorted(
            candidates.values(),
            key=lambda item: (item.score, item.usage_count, item.last_used_at or "", item.display_name_tr),
            reverse=True,
        )

        suggestions = [
            FoodSuggestion(
                canonical_id=item.canonical_id,
                display_name_tr=item.display_name_tr,
                insert_text=item.insert_text,
                source=item.source,  # type: ignore[arg-type]
                matched_text=item.matched_text,
                brand=item.brand,
                product_name=item.product_name,
                is_branded_product=item.is_branded_product,
                score=round(max(0.0, min(item.score, 0.99)), 2),
                usage_count=item.usage_count,
                last_used_at=item.last_used_at,
            )
            for item in ranked[:limit]
        ]

        return NutritionSuggestResponse(
            query=query,
            segment=segment,
            suggestions=suggestions,
        )

    async def _history_index(self, user_id: str | None) -> dict[str, dict]:
        if not user_id:
            return {}

        meals = await self.meal_store.get_all_meals(user_id)
        usage_counter: Counter[str] = Counter()
        last_used: dict[str, str] = {}
        labels: dict[str, str] = {}

        for meal in meals:
            for item in meal.items:
                canonical_id = item.canonical_food_id
                usage_counter[canonical_id] += 1
                labels[canonical_id] = item.canonical_display_name
                if canonical_id not in last_used:
                    last_used[canonical_id] = meal.consumed_at

        return {
            canonical_id: {
                "usage_count": usage_counter[canonical_id],
                "last_used_at": last_used.get(canonical_id),
                "display_name_tr": labels.get(canonical_id, canonical_id),
            }
            for canonical_id in usage_counter
        }

    def _database_candidates(self, normalized_query: str) -> dict[str, _SuggestionCandidate]:
        candidates: dict[str, _SuggestionCandidate] = {}

        for alias, food_definition in self.food_catalog._aliases:  # noqa: SLF001
            score = self._suggestion_score(normalized_query, alias)
            if score <= 0:
                continue

            current = candidates.get(food_definition.canonical_id)
            candidate = _SuggestionCandidate(
                canonical_id=food_definition.canonical_id,
                display_name_tr=food_definition.display_name_tr,
                insert_text=(
                    f"{food_definition.brand} {food_definition.product_name or food_definition.display_name_tr}".lower()
                    if food_definition.is_branded_product and food_definition.brand
                    else food_definition.display_name_tr.lower()
                ),
                matched_text=alias,
                score=score,
                source="database",
                brand=food_definition.brand,
                product_name=food_definition.product_name,
                is_branded_product=food_definition.is_branded_product,
            )
            if current is None or candidate.score > current.score:
                candidates[food_definition.canonical_id] = candidate

        return candidates

    def _apply_history_boosts(self, candidates: dict[str, _SuggestionCandidate], history: dict[str, dict]) -> None:
        for canonical_id, candidate in candidates.items():
            history_entry = history.get(canonical_id)
            if not history_entry:
                continue

            usage_count = int(history_entry["usage_count"])
            candidate.usage_count = usage_count
            candidate.last_used_at = history_entry["last_used_at"]
            if usage_count >= 3:
                candidate.score += min(0.18, usage_count * 0.02)
                candidate.source = "frequent"
            else:
                candidate.score += 0.08
                candidate.source = "recent"

    def _inject_history_matches(
        self,
        candidates: dict[str, _SuggestionCandidate],
        normalized_query: str,
        history: dict[str, dict],
    ) -> None:
        for canonical_id, history_entry in history.items():
            label = normalize_food_text(history_entry["display_name_tr"])
            score = self._suggestion_score(normalized_query, label)
            if score <= 0:
                continue

            source = "frequent" if history_entry["usage_count"] >= 3 else "recent"
            candidate = _SuggestionCandidate(
                canonical_id=canonical_id,
                display_name_tr=history_entry["display_name_tr"],
                insert_text=history_entry["display_name_tr"].lower(),
                matched_text=label,
                score=score + (0.15 if source == "frequent" else 0.08),
                source=source,
                usage_count=int(history_entry["usage_count"]),
                last_used_at=history_entry["last_used_at"],
            )
            current = candidates.get(canonical_id)
            if current is None or candidate.score > current.score:
                candidates[canonical_id] = candidate

    def _suggestion_score(self, normalized_query: str, alias: str) -> float:
        if not normalized_query:
            return 0.0
        if normalized_query == alias:
            return 0.99
        if alias.startswith(normalized_query):
            return min(0.96, 0.72 + min(len(normalized_query), 8) * 0.03)
        if normalized_query in alias:
            return 0.68

        query_tokens = normalized_query.split()
        alias_tokens = alias.split()
        overlap = len(set(query_tokens).intersection(alias_tokens))
        if overlap:
            return 0.58 + min(0.18, overlap * 0.08)

        ratio = SequenceMatcher(None, normalized_query, alias).ratio()
        if ratio >= 0.74:
            return ratio * 0.72
        if len(normalized_query) <= 3 and len(alias) >= 2 and len(normalized_query) >= 2:
            if alias[:2] == normalized_query[:2]:
                return 0.44 + ratio * 0.18
        if len(normalized_query) <= 3 and alias and alias[0] == normalized_query[0] and ratio >= 0.35:
            return 0.32 + ratio * 0.28
        if len(normalized_query) >= 3:
            for token in alias_tokens:
                token_ratio = SequenceMatcher(None, normalized_query, token).ratio()
                if token_ratio >= 0.72:
                    return token_ratio * 0.68
        return 0.0
