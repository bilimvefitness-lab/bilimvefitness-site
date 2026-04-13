import re
from dataclasses import dataclass

from app.schemas.nutrition import (
    ClarificationQuestion,
    FoodReference,
    NutritionParseResponse,
    ParsedNutritionItem,
)
from app.services.nutrition_food_catalog_v2 import FoodCatalog, FoodDefinition, FoodMatch, normalize_food_text


SIZE_MODIFIERS = {
    "kucuk": 0.8,
    "orta": 1.0,
    "buyuk": 1.25,
    "ince": 0.75,
    "kalin": 1.3,
    "small": 0.8,
    "medium": 1.0,
    "large": 1.25,
    "thin": 0.75,
    "thick": 1.3,
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
    "gr": "gram",
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
class _ParsedSegment:
    item: ParsedNutritionItem
    question: ClarificationQuestion | None
    normalized_food: FoodReference | None


class NutritionParserServiceV3:
    def __init__(self, food_catalog: FoodCatalog) -> None:
        self.food_catalog = food_catalog

    def parse_text(self, text: str) -> NutritionParseResponse:
        segments = self._split_segments(text)
        parsed_segments = [self._parse_segment(segment, index) for index, segment in enumerate(segments)]

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
            r"\b(?:\d+(?:[.,]\d+)?(?:/\d+)?|"
            r"bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on|yarim|"
            r"one|two|three|four|five|six|seven|eight|nine|ten|half)\b"
        )
        matches = list(re.finditer(pattern, normalize_food_text(text), flags=re.IGNORECASE))
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

    def _parse_segment(self, raw_segment: str, index: int) -> _ParsedSegment:
        raw_text = raw_segment.strip()
        normalized = normalize_food_text(raw_text)
        amount, unit, modifiers, remainder = self._extract_amount_and_unit(normalized)
        inline_modifiers = [modifier for modifier in SIZE_MODIFIERS if re.search(rf"\b{modifier}\b", remainder)]
        all_modifiers = self._dedupe_values([*modifiers, *inline_modifiers])
        preparation_method = next(
            (label for key, label in PREPARATION_KEYWORDS.items() if re.search(rf"\b{key}\b", remainder)),
            None,
        )
        food_name = self._extract_food_name(remainder or normalized)
        food_match = self.food_catalog.match_food(remainder or normalized)

        if food_match is None:
            question = ClarificationQuestion(
                item_index=index,
                raw_text=raw_text,
                question="Bu besini veritabaninda net eslestiremedim. Daha acik yazar misin?",
                suggested_options=self.food_catalog.suggest_foods(remainder or normalized),
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
            )
            return _ParsedSegment(item=item, question=question, normalized_food=None)

        normalized_food = FoodReference(
            canonical_id=food_match.food.canonical_id,
            display_name_tr=food_match.food.display_name_tr,
            default_unit=food_match.food.default_unit,
            standard_unit_weight_g=food_match.food.standard_unit_weight_g,
        )

        estimated_weight_g, estimated = self._estimate_weight(food_match.food, amount, unit, all_modifiers)
        confidence_score, confidence_level, needs_clarification, clarification_reason = self._score_item(
            normalized_text=normalized,
            amount=amount,
            unit=unit,
            modifiers=all_modifiers,
            estimated_weight_g=estimated_weight_g,
            estimated=estimated,
            food_match=food_match,
        )

        question = None
        if needs_clarification and clarification_reason:
            question = ClarificationQuestion(
                item_index=index,
                raw_text=raw_text,
                question=clarification_reason,
                suggested_options=self._clarification_options(food_match.food, unit, all_modifiers),
            )

        item = ParsedNutritionItem(
            raw_text=raw_text,
            food_name=food_name,
            amount=amount,
            unit=unit,
            preparation_method=preparation_method,
            modifiers=[self._display_modifier(modifier) for modifier in all_modifiers],
            canonical_food_id=normalized_food.canonical_id,
            canonical_display_name=normalized_food.display_name_tr,
            estimated_weight_g=round(estimated_weight_g, 2) if estimated_weight_g is not None else None,
            confidence_level=confidence_level,
            confidence_score=confidence_score,
            estimated=estimated,
            needs_clarification=needs_clarification,
            clarification_reason=clarification_reason,
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
        normalized = normalize_food_text(amount_text)
        if normalized in NUMBER_WORDS:
            return float(NUMBER_WORDS[normalized])
        if "/" in normalized:
            numerator, denominator = normalized.split("/", maxsplit=1)
            if numerator.isdigit() and denominator.isdigit() and int(denominator) != 0:
                return int(numerator) / int(denominator)
        try:
            return float(normalized.replace(",", "."))
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

    def _estimate_weight(
        self,
        food: FoodDefinition,
        amount: float | None,
        unit: str | None,
        modifiers: list[str],
    ) -> tuple[float | None, bool]:
        if amount is None:
            return None, False

        resolved_unit = unit or food.default_unit
        estimated = unit is None and food.default_unit != "adet"

        if resolved_unit == "gram":
            return amount, False
        if resolved_unit == "kilo":
            return amount * 1000, False

        base_weight = food.unit_weights.get(resolved_unit, food.standard_unit_weight_g)
        size_multiplier = 1.0
        for modifier in modifiers:
            size_multiplier *= SIZE_MODIFIERS.get(modifier, 1.0)

        return amount * base_weight * size_multiplier, estimated or resolved_unit in {
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

    def _score_item(
        self,
        normalized_text: str,
        amount: float | None,
        unit: str | None,
        modifiers: list[str],
        estimated_weight_g: float | None,
        estimated: bool,
        food_match: FoodMatch,
    ) -> tuple[float, str, bool, str | None]:
        if any(word in normalized_text for word in LOW_CONFIDENCE_WORDS):
            return 0.22, "low", True, "Porsiyon cok belirsiz gorunuyor. Net gram ya da olcu yazar misin?"

        if amount is None:
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
        if unit in HIGH_AMBIGUITY_UNITS and modifiers:
            score += 0.08
        if estimated:
            score -= 0.08

        clarification_reason = None
        needs_clarification = False
        if unit in HIGH_AMBIGUITY_UNITS and not modifiers:
            score -= 0.18
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
        }:
            score -= 0.1
            needs_clarification = True
            clarification_reason = "Bu porsiyon tahmini hesaplandi. Kase boyutunu ya da grami netlestirir misin?"
        elif food_match.score < 0.72 and not (food_match.is_exact and unit is not None):
            score -= 0.1
            needs_clarification = True
            clarification_reason = "Besin eslesmesi tam net degil. Gerekirse besini biraz daha acik tarif eder misin?"

        score = round(max(0.05, min(score, 0.99)), 2)
        if score >= 0.85:
            return score, "high", needs_clarification, clarification_reason
        if score >= 0.6:
            return score, "medium", needs_clarification, clarification_reason
        return score, "low", True, clarification_reason or "Bu kaydi guvenle hesaplamak icin biraz daha net bilgiye ihtiyacim var."

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
