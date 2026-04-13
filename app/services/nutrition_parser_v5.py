import re
from dataclasses import dataclass

from app.schemas.nutrition import (
    ClarificationChoice,
    ClarificationQuestion,
    FoodReference,
    NutritionParseResponse,
    ParserDebugCandidate,
    ParserDebugInfo,
    ParsedNutritionItem,
)
from app.services.nutrition_food_catalog_v2 import FoodCatalog, FoodDefinition, FoodMatch, normalize_food_text
from app.services.portion_learning import LearnedPortionOverride, PortionLearningService


SIZE_MODIFIERS = {
    "kucuk": 0.8,
    "orta": 1.0,
    "buyuk": 1.25,
    "ince": 2 / 3,
    "kalin": 4 / 3,
    "small": 0.8,
    "medium": 1.0,
    "large": 1.25,
    "thin": 2 / 3,
    "thick": 4 / 3,
}

PREPARATION_KEYWORDS = {
    "haslanmis": "haşlanmış",
    "boiled": "haşlanmış",
    "izgara": "ızgara",
    "grilled": "ızgara",
    "firin": "fırın",
    "baked": "fırın",
    "kizarmis": "kızarmış",
    "fried": "kızarmış",
    "raw": "çiğ",
    "cig": "çiğ",
    "cooked": "pişmiş",
    "roasted": "kavrulmuş",
    "kavrulmus": "kavrulmuş",
}

UNIT_ALIASES = {
    "g": "gram",
    "gram": "gram",
    "grams": "gram",
    "gr": "gram",
    "grm": "gram",
    "kg": "kilo",
    "kilo": "kilo",
    "adet": "adet",
    "tane": "adet",
    "piece": "adet",
    "pieces": "adet",
    "dilim": "dilim",
    "slice": "dilim",
    "slices": "dilim",
    "kase": "kase",
    "bowl": "kase",
    "tabak": "tabak",
    "plate": "tabak",
    "bardak": "bardak",
    "cup": "bardak",
    "glass": "bardak",
    "yemek kasigi": "yemek kasigi",
    "corba kasigi": "yemek kasigi",
    "tablespoon": "yemek kasigi",
    "tbsp": "yemek kasigi",
    "tatli kasigi": "tatli kasigi",
    "dessert spoon": "tatli kasigi",
    "teaspoon": "tatli kasigi",
    "tsp": "tatli kasigi",
    "olcek": "olcek",
    "scoop": "olcek",
    "porsiyon": "porsiyon",
    "serving": "porsiyon",
    "portion": "porsiyon",
    "avuc": "avuc",
    "handful": "avuc",
}

MULTI_WORD_UNITS = [
    ("yemek", "kasigi"),
    ("corba", "kasigi"),
    ("tatli", "kasigi"),
]

NUMBER_WORDS = {
    "bir": 1,
    "iki": 2,
    "uc": 3,
    "dort": 4,
    "bes": 5,
    "alti": 6,
    "yedi": 7,
    "sekiz": 8,
    "dokuz": 9,
    "on": 10,
    "yarim": 0.5,
    "half": 0.5,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
}

LOW_CONFIDENCE_WORDS = {"biraz", "az", "bir miktar", "some", "little"}
HIGH_AMBIGUITY_UNITS = {"tabak", "porsiyon", "avuc"}
MEDIUM_AMBIGUITY_UNITS = {"kase", "bardak"}
MEASURE_ONLY_WORDS = {"adet", "gram", "kilo", "dilim", "kase", "tabak", "bardak", "porsiyon", "olcek"}


@dataclass(slots=True)
class PortionEstimate:
    weight_g: float | None
    min_weight_g: float | None
    max_weight_g: float | None
    estimated: bool
    resolved_unit: str | None
    range_ratio: float
    portion_source: str
    user_history_samples: int | None


@dataclass(slots=True)
class _ParsedSegment:
    item: ParsedNutritionItem
    question: ClarificationQuestion | None
    normalized_food: FoodReference | None


class NutritionParserServiceV5:
    def __init__(self, food_catalog: FoodCatalog, portion_learning_service: PortionLearningService) -> None:
        self.food_catalog = food_catalog
        self.portion_learning_service = portion_learning_service

    async def parse_text(self, text: str, user_id: str | None = None) -> NutritionParseResponse:
        segments = self._split_segments(text)
        parsed_segments = [await self._parse_segment(segment, index, user_id) for index, segment in enumerate(segments)]

        items = [segment.item for segment in parsed_segments]
        normalized_foods = self._dedupe_foods(
            [segment.normalized_food for segment in parsed_segments if segment.normalized_food is not None]
        )
        clarification_questions = [segment.question for segment in parsed_segments if segment.question is not None]
        confidence_score = self._overall_confidence(items)
        confidence_level = self._confidence_level_from_score(confidence_score)

        return NutritionParseResponse(
            input_text=text,
            parsed_items=items,
            normalized_foods=normalized_foods,
            confidence_level=confidence_level,
            confidence_score=confidence_score,
            needs_clarification=any(item.needs_clarification for item in items),
            clarification_questions=clarification_questions,
        )

    def _split_segments(self, text: str) -> list[str]:
        normalized = re.sub(r"[\n;]+", ",", text)
        primary_parts = [part.strip() for part in normalized.split(",") if part.strip()]
        segments: list[str] = []
        for part in primary_parts:
            segments.extend(self._split_dense_part(part))
        return segments or [text.strip()]

    def _split_dense_part(self, text: str) -> list[str]:
        pattern = (
            r"(?<!\S)(?:\d+(?:[.,]\d+)?(?:/\d+)?|"
            r"bir|iki|uc|üç|dort|dört|bes|beş|alti|altı|yedi|sekiz|dokuz|on|yarim|yarım|"
            r"one|two|three|four|five|six|seven|eight|nine|ten|half)(?!\S)"
        )
        matches = list(re.finditer(pattern, text, flags=re.IGNORECASE))
        if len(matches) <= 1:
            return [text.strip()]

        boundaries = [0]
        for match in matches[1:]:
            boundaries.append(match.start())
        boundaries.append(len(text))

        segments: list[str] = []
        for start, end in zip(boundaries, boundaries[1:], strict=False):
            piece = text[start:end].strip(" ,")
            if piece:
                segments.append(piece)
        return segments or [text.strip()]

    async def _parse_segment(self, raw_segment: str, index: int, user_id: str | None) -> _ParsedSegment:
        raw_text = raw_segment.strip()
        normalized = normalize_food_text(raw_text)
        amount, unit, modifiers, remainder = self._extract_amount_and_unit(normalized)
        inline_modifiers = [modifier for modifier in SIZE_MODIFIERS if re.search(rf"\b{modifier}\b", remainder)]
        all_modifiers = self._dedupe_values([*modifiers, *inline_modifiers])
        preparation_method = next(
            (label for key, label in PREPARATION_KEYWORDS.items() if re.search(rf"\b{key}\b", remainder)),
            None,
        )
        food_query = remainder or normalized
        graph_context = self.food_catalog.detect_food_graph_context(food_query)
        if preparation_method is None and graph_context.cooking_method:
            preparation_method = PREPARATION_KEYWORDS.get(graph_context.cooking_method, graph_context.cooking_method)
        food_name = self._extract_food_name(food_query)
        candidate_matches = self.food_catalog.closest_food_matches(food_query, limit=5)
        food_match = self.food_catalog.match_food(food_query)

        if food_match is None:
            food_choices = self._food_match_choices(
                query=food_query,
                amount=amount,
                unit=unit,
                modifiers=all_modifiers,
            )
            question = ClarificationQuestion(
                item_index=index,
                raw_text=raw_text,
                question="Bu besini veritabaninda net eslestiremedim. Daha acik yazar misin?",
                suggested_options=self.food_catalog.suggest_foods(food_query),
                choices=food_choices,
            )
            item = ParsedNutritionItem(
                raw_text=raw_text,
                food_name=food_name,
                amount=amount,
                unit=unit,
                preparation_method=preparation_method,
                modifiers=[self._display_modifier(modifier) for modifier in all_modifiers],
                confidence_level="low",
                confidence_score=0.18,
                estimated=False,
                needs_clarification=True,
                clarification_reason=question.question,
                debug=self._build_debug_info(
                    normalized_query=food_query,
                    selected_match=None,
                    candidate_matches=candidate_matches,
                    confidence_score=0.18,
                ),
            )
            return _ParsedSegment(item=item, question=question, normalized_food=None)

        normalized_food = FoodReference(
            canonical_id=food_match.food.canonical_id,
            display_name_tr=food_match.food.display_name_tr,
            default_unit=food_match.food.default_unit,
            standard_unit_weight_g=food_match.food.standard_unit_weight_g,
            base_food=food_match.food.base_food,
            cooking_method=food_match.food.cooking_method,
            category=food_match.food.category,
            related_foods=list(food_match.food.related_foods or []),
            brand=food_match.food.brand,
            product_name=food_match.food.product_name,
            is_branded_product=food_match.food.is_branded_product,
        )

        learned_override = await self.portion_learning_service.get_override(
            user_id=user_id,
            canonical_food_id=food_match.food.canonical_id,
            unit=unit or food_match.food.default_unit,
            modifiers=[self._display_modifier(modifier) for modifier in all_modifiers],
        )
        portion = self._estimate_portion(food_match.food, amount, unit, all_modifiers, learned_override)
        confidence_score, confidence_level, needs_clarification, clarification_reason = self._score_item(
            normalized_text=normalized,
            amount=amount,
            unit=portion.resolved_unit,
            modifiers=all_modifiers,
            estimated_weight_g=portion.weight_g,
            range_ratio=portion.range_ratio,
            estimated=portion.estimated,
            food_match=food_match,
            history_samples=portion.user_history_samples,
        )

        question = None
        if needs_clarification and clarification_reason:
            ambiguous_food_query = normalize_food_text(food_query).strip() in {"misir", "corn"}
            food_choices = (
                self._food_match_choices(
                    query=food_query,
                    amount=amount,
                    unit=portion.resolved_unit,
                    modifiers=all_modifiers,
                    exclude_canonical_id=None if ambiguous_food_query else food_match.food.canonical_id,
                )
                if ambiguous_food_query or (food_match.score < 0.64 and not food_match.is_exact)
                else []
            )
            portion_choices = self._clarification_choices(food_match.food, portion.resolved_unit, all_modifiers)
            clarification_choices = food_choices or portion_choices
            question = ClarificationQuestion(
                item_index=index,
                raw_text=raw_text,
                question=clarification_reason,
                suggested_options=(
                    [choice.canonical_display_name or choice.label for choice in clarification_choices]
                    if clarification_choices
                    else self._clarification_options(food_match.food, portion.resolved_unit, all_modifiers)
                ),
                choices=clarification_choices,
            )

        item = ParsedNutritionItem(
            raw_text=raw_text,
            food_name=food_name,
            amount=amount,
            unit=portion.resolved_unit,
            preparation_method=preparation_method,
            modifiers=[self._display_modifier(modifier) for modifier in all_modifiers],
            canonical_food_id=normalized_food.canonical_id,
            canonical_display_name=normalized_food.display_name_tr,
            base_food=food_match.food.base_food or graph_context.base_food,
            detected_cooking_method=food_match.food.cooking_method or graph_context.cooking_method,
            food_category=food_match.food.category,
            related_foods=list(food_match.food.related_foods or graph_context.related_foods),
            brand=normalized_food.brand,
            product_name=normalized_food.product_name,
            is_branded_product=normalized_food.is_branded_product,
            estimated_weight_g=round(portion.weight_g, 2) if portion.weight_g is not None else None,
            estimated_weight_min_g=round(portion.min_weight_g, 2) if portion.min_weight_g is not None else None,
            estimated_weight_max_g=round(portion.max_weight_g, 2) if portion.max_weight_g is not None else None,
            portion_source=portion.portion_source,
            user_history_samples=portion.user_history_samples,
            confidence_level=confidence_level,
            confidence_score=confidence_score,
            estimated=portion.estimated,
            needs_clarification=needs_clarification,
            clarification_reason=clarification_reason,
            debug=self._build_debug_info(
                normalized_query=food_query,
                selected_match=food_match,
                candidate_matches=candidate_matches,
                confidence_score=confidence_score,
            ),
        )
        return _ParsedSegment(item=item, question=question, normalized_food=normalized_food)

    def _extract_amount_and_unit(self, text: str) -> tuple[float | None, str | None, list[str], str]:
        tokens = text.split()
        if not tokens:
            return None, None, [], text

        amount = self._parse_amount(tokens[0])
        if amount is None:
            return None, None, [], text

        index = 1
        modifiers: list[str] = []
        while index < len(tokens) and tokens[index] in SIZE_MODIFIERS:
            modifiers.append(tokens[index])
            index += 1

        unit, consumed = self._consume_unit(tokens[index:])
        if unit is not None:
            index += consumed

        while index < len(tokens) and tokens[index] in SIZE_MODIFIERS:
            modifiers.append(tokens[index])
            index += 1

        remainder = " ".join(tokens[index:]).strip()
        return amount, unit, modifiers, remainder

    def _consume_unit(self, tokens: list[str]) -> tuple[str | None, int]:
        if not tokens:
            return None, 0

        if len(tokens) >= 2 and (tokens[0], tokens[1]) in MULTI_WORD_UNITS:
            unit_text = f"{tokens[0]} {tokens[1]}"
            return UNIT_ALIASES.get(unit_text, unit_text), 2

        unit_text = tokens[0]
        normalized = UNIT_ALIASES.get(unit_text)
        if normalized is None:
            return None, 0
        return normalized, 1

    def _parse_amount(self, amount_text: str) -> float | None:
        raw_text = amount_text.strip().casefold()
        normalized = normalize_food_text(raw_text)
        if normalized in NUMBER_WORDS:
            return float(NUMBER_WORDS[normalized])
        if "/" in raw_text:
            numerator, denominator = raw_text.split("/", maxsplit=1)
            if numerator.isdigit() and denominator.isdigit() and int(denominator) != 0:
                return int(numerator) / int(denominator)
        try:
            return float(raw_text.replace(",", "."))
        except ValueError:
            return None

    def _extract_food_name(self, text: str) -> str:
        cleaned = text
        for key in PREPARATION_KEYWORDS:
            cleaned = re.sub(rf"\b{key}\b", " ", cleaned)
        for modifier in SIZE_MODIFIERS:
            cleaned = re.sub(rf"\b{modifier}\b", " ", cleaned)
        for measure_word in MEASURE_ONLY_WORDS:
            cleaned = re.sub(rf"\b{measure_word}\b", " ", cleaned)
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned or text or "tanimsiz besin"

    def _estimate_portion(
        self,
        food: FoodDefinition,
        amount: float | None,
        unit: str | None,
        modifiers: list[str],
        learned_override: LearnedPortionOverride | None,
    ) -> PortionEstimate:
        if amount is None:
            return PortionEstimate(None, None, None, False, unit, 0.0, "default", None)

        resolved_unit = unit or food.default_unit
        estimated = unit is None and food.default_unit != "adet"

        if resolved_unit == "gram":
            return PortionEstimate(amount, amount, amount, False, resolved_unit, 0.0, "direct", None)
        if resolved_unit == "kilo":
            weight = amount * 1000
            return PortionEstimate(weight, weight, weight, False, "gram", 0.0, "direct", None)

        if learned_override is not None:
            estimated_weight = amount * learned_override.average_weight_g
            min_weight = amount * learned_override.min_weight_g
            max_weight = amount * learned_override.max_weight_g
            range_ratio = max(0.0, (max_weight - min_weight) / (2 * max(estimated_weight, 1)))
            return PortionEstimate(
                weight_g=estimated_weight,
                min_weight_g=min_weight,
                max_weight_g=max_weight,
                estimated=True,
                resolved_unit=resolved_unit,
                range_ratio=range_ratio,
                portion_source="user_history",
                user_history_samples=learned_override.sample_count,
            )

        base_weight = food.unit_weights.get(resolved_unit, food.standard_unit_weight_g)
        size_multiplier = 1.0
        for modifier in modifiers:
            size_multiplier *= SIZE_MODIFIERS.get(modifier, 1.0)

        estimated_weight = amount * base_weight * size_multiplier
        range_ratio = self._range_ratio(resolved_unit, modifiers, estimated)
        min_weight = estimated_weight * (1 - range_ratio)
        max_weight = estimated_weight * (1 + range_ratio)
        is_estimated = estimated or resolved_unit in {
            "kase",
            "tabak",
            "bardak",
            "yemek kasigi",
            "tatli kasigi",
            "olcek",
            "porsiyon",
            "avuc",
            "dilim",
        }

        return PortionEstimate(
            weight_g=estimated_weight,
            min_weight_g=min_weight,
            max_weight_g=max_weight,
            estimated=is_estimated,
            resolved_unit=resolved_unit,
            range_ratio=range_ratio,
            portion_source="default",
            user_history_samples=None,
        )

    def _range_ratio(self, resolved_unit: str, modifiers: list[str], estimated: bool) -> float:
        if resolved_unit in {"gram", "kilo"}:
            return 0.0
        if resolved_unit == "adet":
            return 0.08
        if resolved_unit == "olcek":
            return 0.06
        if resolved_unit == "dilim":
            return 0.08 if any(modifier in {"ince", "kalin"} for modifier in modifiers) else 0.22
        if resolved_unit in {"yemek kasigi", "tatli kasigi"}:
            return 0.12
        if resolved_unit in {"kase", "bardak"}:
            return 0.12 if any(modifier in {"kucuk", "orta", "buyuk"} for modifier in modifiers) else 0.22
        if resolved_unit == "avuc":
            return 0.18 if any(modifier in {"kucuk", "orta", "buyuk"} for modifier in modifiers) else 0.32
        if resolved_unit in {"tabak", "porsiyon"}:
            return 0.18 if any(modifier in {"kucuk", "orta", "buyuk"} for modifier in modifiers) else 0.4
        return 0.15 if estimated else 0.1

    def _score_item(
        self,
        normalized_text: str,
        amount: float | None,
        unit: str | None,
        modifiers: list[str],
        estimated_weight_g: float | None,
        range_ratio: float,
        estimated: bool,
        food_match: FoodMatch,
        history_samples: int | None,
    ) -> tuple[float, str, bool, str | None]:
        if any(re.search(rf"\b{re.escape(word)}\b", normalized_text) for word in LOW_CONFIDENCE_WORDS):
            return 0.22, "low", True, "Porsiyon cok belirsiz gorunuyor. Net gram ya da olcu yazar misin?"

        if normalized_text.strip() in {"misir", "corn"}:
            return 0.34, "low", True, "Misirin turunu sec: patlamis misir, haslanmis misir veya koz misir."

        if amount is None:
            if food_match.is_exact and len(normalized_text.split()) >= 2 and not food_match.is_generic:
                return 0.9, "high", True, "Miktari eksik. Kac gram, adet, kase veya dilim oldugunu belirtir misin?"
            if food_match.is_exact and not food_match.is_generic:
                return 0.74, "medium", True, "Miktari eksik. Kac gram, adet, kase veya dilim oldugunu belirtir misin?"
            if food_match.score >= 0.7 and len(normalized_text.split()) >= 2:
                return 0.72, "medium", True, "Miktari eksik. Kac gram, adet, kase veya dilim oldugunu belirtir misin?"
            return 0.28, "low", True, "Miktari eksik. Kac gram, adet, kase veya dilim oldugunu belirtir misin?"

        if estimated_weight_g is None:
            return 0.24, "low", True, "Olcuyu guvenilir sekilde ceviremedim. Daha net bir olcu girer misin?"

        score = 0.18
        score += min(food_match.score, 1.0) * 0.32

        if food_match.is_exact:
            score += 0.15
        else:
            score += 0.07
        if food_match.is_generic:
            score -= 0.08
        if food_match.food.is_branded_product:
            score += 0.09

        if unit in {"gram", "kilo"}:
            score += 0.36
        elif unit == "adet":
            score += 0.24
        elif unit in {"dilim", "olcek", "yemek kasigi", "tatli kasigi"}:
            score += 0.14
        elif unit in MEDIUM_AMBIGUITY_UNITS:
            score += 0.08
        elif unit in HIGH_AMBIGUITY_UNITS:
            score += 0.03
        elif unit is None:
            score += 0.22 if food_match.food.default_unit == "adet" else 0.02

        if modifiers:
            score += 0.05
        if food_match.is_exact and unit in {"adet", "dilim", "olcek"}:
            score += 0.16
        if food_match.is_exact and unit in {"gram", "kilo"}:
            score += 0.08
        if unit in {"gram", "kilo"} and food_match.score >= 0.78:
            score += 0.04
        if unit in {"gram", "kilo"} and len(normalized_text.split()) >= 2 and food_match.score >= 0.64:
            score += 0.08
        if food_match.is_exact and unit is not None and unit == food_match.food.default_unit:
            score += 0.08
        if unit in HIGH_AMBIGUITY_UNITS and modifiers:
            score += 0.08
        if estimated:
            score -= 0.06

        if history_samples:
            score += min(0.12, 0.03 * history_samples)

        if range_ratio >= 0.35:
            score -= 0.24
        elif range_ratio >= 0.2:
            score -= 0.12
        elif range_ratio >= 0.1:
            score -= 0.05

        clarification_reason = None
        needs_clarification = False
        if unit in HIGH_AMBIGUITY_UNITS and not modifiers and not history_samples:
            needs_clarification = True
            clarification_reason = (
                "Bu porsiyon genis bir aralikta olabilir. Kucuk, orta, buyuk ya da gram olarak netlestirir misin?"
            )
        elif unit in MEDIUM_AMBIGUITY_UNITS and not modifiers and food_match.food.canonical_id in {
            "pasta_cooked",
            "yogurt_plain",
            "mixed_nuts",
            "mercimek_corbasi",
            "tarhana_corbasi",
            "ezogelin_corbasi",
        } and not history_samples:
            needs_clarification = True
            clarification_reason = "Bu porsiyon tahmini hesaplandi. Kase boyutunu ya da grami netlestirir misin?"
        elif (
            food_match.score < 0.64
            and not (food_match.is_exact and unit is not None)
            and not (unit in {"gram", "kilo"} and food_match.score >= 0.52)
        ):
            score -= 0.12
            needs_clarification = True
            clarification_reason = "Besin eslesmesi zayif. En yakin seceneklerden birini sec."
        elif food_match.score < 0.64 and unit in {"gram", "kilo"}:
            score -= 0.02
        elif food_match.score < 0.82 and not food_match.is_exact:
            score -= 0.04

        score = round(max(0.05, min(score, 0.99)), 2)
        if score >= 0.85:
            return score, "high", needs_clarification, clarification_reason
        if score >= 0.6:
            return score, "medium", needs_clarification, clarification_reason
        return score, "low", True, clarification_reason or "Bu kaydi guvenle hesaplamak icin biraz daha net bilgiye ihtiyacim var."

    def _build_debug_info(
        self,
        *,
        normalized_query: str,
        selected_match: FoodMatch | None,
        candidate_matches: list[FoodMatch],
        confidence_score: float,
    ) -> ParserDebugInfo:
        return ParserDebugInfo(
            detected_tokens=normalized_query.split(),
            matched_alias=selected_match.matched_alias if selected_match is not None else None,
            candidate_list=[
                ParserDebugCandidate(
                    canonical_food_id=match.food.canonical_id,
                    display_name_tr=match.food.display_name_tr,
                    matched_alias=match.matched_alias,
                    score=round(match.score, 4),
                )
                for match in candidate_matches[:5]
            ],
            final_selected_food=selected_match.food.canonical_id if selected_match is not None else None,
            confidence_score=confidence_score,
        )

    def _food_match_choices(
        self,
        *,
        query: str,
        amount: float | None,
        unit: str | None,
        modifiers: list[str],
        exclude_canonical_id: str | None = None,
    ) -> list[ClarificationChoice]:
        choices: list[ClarificationChoice] = []
        reference_amount = amount or 1.0
        for match in self.food_catalog.closest_food_matches(query, limit=3):
            if exclude_canonical_id and match.food.canonical_id == exclude_canonical_id:
                continue
            portion = self._estimate_portion(match.food, reference_amount, unit, modifiers, None)
            if portion.weight_g is None:
                continue
            rounded_weight = self._round_portion_weight(portion.weight_g)
            choices.append(
                ClarificationChoice(
                    label=f"{match.food.display_name_tr} ({rounded_weight} g)",
                    estimated_weight_g=rounded_weight,
                    unit=portion.resolved_unit,
                    modifiers=[self._display_modifier(modifier) for modifier in modifiers],
                    canonical_food_id=match.food.canonical_id,
                    canonical_display_name=match.food.display_name_tr,
                    brand=match.food.brand,
                    product_name=match.food.product_name,
                    is_branded_product=match.food.is_branded_product,
                )
            )
        return choices[:3]

    def _clarification_options(
        self,
        food: FoodDefinition,
        unit: str | None,
        modifiers: list[str],
    ) -> list[str]:
        if unit in HIGH_AMBIGUITY_UNITS or unit in MEDIUM_AMBIGUITY_UNITS:
            return ["kucuk", "orta", "buyuk", "gram"]
        if unit == "dilim" and not modifiers:
            return ["ince dilim", "orta dilim", "kalin dilim", "gram"]
        if unit is None and food.default_unit == "adet":
            return ["adet", "gram"]
        return ["gram", "adet", "kase", "tabak"]

    def _clarification_choices(
        self,
        food: FoodDefinition,
        unit: str | None,
        modifiers: list[str],
    ) -> list[ClarificationChoice]:
        if unit not in {"dilim", "kase", "tabak", "porsiyon", "bardak"}:
            return []

        base_weight = food.unit_weights.get(unit or food.default_unit, food.standard_unit_weight_g)
        choices: list[ClarificationChoice] = []

        if unit == "dilim":
            options = [
                ("ince", base_weight * SIZE_MODIFIERS["ince"], ["ince"]),
                ("orta", base_weight, ["orta"]),
                ("kalın", base_weight * SIZE_MODIFIERS["kalin"], ["kalın"]),
            ]
        elif unit in {"tabak", "porsiyon"}:
            options = [
                ("küçük", base_weight * (2 / 3), ["küçük"]),
                ("orta", base_weight, ["orta"]),
                ("büyük", base_weight * 1.39, ["büyük"]),
            ]
        else:
            options = [
                ("küçük", base_weight * SIZE_MODIFIERS["kucuk"], ["küçük"]),
                ("orta", base_weight, ["orta"]),
                ("büyük", base_weight * SIZE_MODIFIERS["buyuk"], ["büyük"]),
            ]

        for label, weight, choice_modifiers in options:
            rounded_weight = self._round_portion_weight(weight)
            choices.append(
                ClarificationChoice(
                    label=f"{label} ({rounded_weight} g)",
                    estimated_weight_g=rounded_weight,
                    unit=unit,
                    modifiers=choice_modifiers,
                )
            )
        return choices

    def _round_portion_weight(self, weight: float) -> float:
        if weight < 80:
            return round(weight / 5) * 5
        return round(weight / 10) * 10

    def _overall_confidence(self, items: list[ParsedNutritionItem]) -> float:
        if not items:
            return 0.0
        return round(sum(item.confidence_score for item in items) / len(items), 2)

    def _confidence_level_from_score(self, score: float) -> str:
        if score >= 0.85:
            return "high"
        if score >= 0.6:
            return "medium"
        return "low"

    def _display_modifier(self, modifier: str) -> str:
        labels = {
            "kucuk": "küçük",
            "orta": "orta",
            "buyuk": "büyük",
            "ince": "ince",
            "kalin": "kalın",
        }
        return labels.get(modifier, modifier)

    def _dedupe_foods(self, foods: list[FoodReference]) -> list[FoodReference]:
        deduped: list[FoodReference] = []
        seen_ids: set[str] = set()
        for food in foods:
            if food.canonical_id in seen_ids:
                continue
            deduped.append(food)
            seen_ids.add(food.canonical_id)
        return deduped

    def _dedupe_values(self, values: list[str]) -> list[str]:
        deduped: list[str] = []
        seen: set[str] = set()
        for value in values:
            if value in seen:
                continue
            deduped.append(value)
            seen.add(value)
        return deduped
