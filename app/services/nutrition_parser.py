import re
from dataclasses import dataclass

from app.schemas.nutrition import (
    ClarificationQuestion,
    FoodReference,
    NutritionParseResponse,
    ParsedNutritionItem,
)
from app.services.nutrition_foods import FoodCatalog, normalize_food_text


SIZE_MODIFIERS = {
    "kucuk": 0.8,
    "orta": 1.0,
    "buyuk": 1.25,
    "small": 0.8,
    "medium": 1.0,
    "large": 1.25,
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
    "slice": "dilim",
    "slices": "dilim",
    "dilim": "dilim",
    "kase": "kase",
    "bowl": "kase",
    "tabak": "tabak",
    "plate": "tabak",
    "bardak": "bardak",
    "cup": "bardak",
    "glass": "bardak",
    "yemek kasigi": "yemek kasigi",
    "tablespoon": "yemek kasigi",
    "tbsp": "yemek kasigi",
    "tatli kasigi": "tatli kasigi",
    "dessert spoon": "tatli kasigi",
    "teaspoon": "tatli kasigi",
    "tsp": "tatli kasigi",
    "olcek": "olcek",
    "scoop": "olcek",
    "serving": "porsiyon",
    "porsiyon": "porsiyon",
    "portion": "porsiyon",
    "avuç": "avuc",
    "avuc": "avuc",
    "handful": "avuc",
}

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

LOW_CONFIDENCE_WORDS = {"biraz", "az", "some", "little", "bir miktar"}


@dataclass(slots=True)
class _ParsedSegment:
    item: ParsedNutritionItem
    question: ClarificationQuestion | None
    normalized_food: FoodReference | None


class NutritionParserService:
    def __init__(self, food_catalog: FoodCatalog) -> None:
        self.food_catalog = food_catalog

    def parse_text(self, text: str) -> NutritionParseResponse:
        segments = self._split_segments(text)
        parsed_segments = [self._parse_segment(segment, index) for index, segment in enumerate(segments)]

        items = [segment.item for segment in parsed_segments]
        normalized_foods = self._dedupe_foods(
            [
                food
                for food in [segment.normalized_food for segment in parsed_segments]
                if food is not None
            ]
        )
        clarification_questions = [
            question
            for question in [segment.question for segment in parsed_segments]
            if question is not None
        ]
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
        pattern = r"\b(?:\d+(?:[.,]\d+)?(?:/\d+)?|bir|iki|uc|üç|dort|dört|bes|beş|alti|altı|yedi|sekiz|dokuz|on|yarim|yarım|one|two|three|four|five|six|seven|eight|nine|ten|half)\b"
        matches = list(re.finditer(pattern, text, flags=re.IGNORECASE))
        if len(matches) <= 1:
            return [text.strip()]

        boundaries = [0]
        for match in matches[1:]:
            boundaries.append(match.start())
        boundaries.append(len(text))

        mapped_segments: list[str] = []
        for start, end in zip(boundaries, boundaries[1:], strict=False):
            piece = text[start:end].strip()
            if piece:
                mapped_segments.append(piece)
        return mapped_segments or [text.strip()]

    def _parse_segment(self, raw_segment: str, index: int) -> _ParsedSegment:
        raw_text = raw_segment.strip()
        normalized = normalize_food_text(raw_text)
        amount, unit, remainder = self._extract_amount_and_unit(normalized)
        modifiers = [modifier for modifier in SIZE_MODIFIERS if re.search(rf"\b{modifier}\b", remainder)]
        preparation_method = next(
            (label for key, label in PREPARATION_KEYWORDS.items() if re.search(rf"\b{key}\b", remainder)),
            None,
        )
        food_match = self.food_catalog.match_food(remainder or normalized)
        food_name = self._extract_food_name(remainder)

        estimated_weight_g: float | None = None
        confidence_score = 0.2
        confidence_level = "low"
        estimated = False
        needs_clarification = False
        clarification_reason: str | None = None
        question: ClarificationQuestion | None = None
        normalized_food: FoodReference | None = None

        if food_match is None:
            clarification_reason = "Yemek veritabanında eşleşen bir besin bulunamadı."
            needs_clarification = True
            question = ClarificationQuestion(
                item_index=index,
                raw_text=raw_text,
                question="Bu besin tam olarak nedir?",
                suggested_options=self.food_catalog.suggest_foods(remainder or normalized),
            )
        else:
            food = food_match.food
            normalized_food = FoodReference(
                canonical_id=food.canonical_id,
                display_name_tr=food.display_name_tr,
                default_unit=food.default_unit,
                standard_unit_weight_g=food.standard_unit_weight_g,
            )
            estimated_weight_g, estimated = self._estimate_weight(food, amount, unit, modifiers)
            confidence_score, confidence_level, needs_clarification, clarification_reason = self._score_item(
                raw_text=normalized,
                food_name=food_name,
                food=food,
                amount=amount,
                unit=unit,
                estimated_weight_g=estimated_weight_g,
                estimated=estimated,
            )
            if needs_clarification:
                question = ClarificationQuestion(
                    item_index=index,
                    raw_text=raw_text,
                    question=clarification_reason or "Porsiyon bilgisini netleştirir misin?",
                    suggested_options=self._clarification_options(food),
                )

        item = ParsedNutritionItem(
            raw_text=raw_text,
            food_name=food_name,
            amount=amount,
            unit=unit,
            preparation_method=preparation_method,
            modifiers=[self._display_modifier(modifier) for modifier in modifiers],
            canonical_food_id=normalized_food.canonical_id if normalized_food else None,
            canonical_display_name=normalized_food.display_name_tr if normalized_food else None,
            estimated_weight_g=round(estimated_weight_g, 2) if estimated_weight_g is not None else None,
            confidence_level=confidence_level,
            confidence_score=confidence_score,
            estimated=estimated,
            needs_clarification=needs_clarification,
            clarification_reason=clarification_reason,
        )
        return _ParsedSegment(item=item, question=question, normalized_food=normalized_food)

    def _extract_amount_and_unit(self, text: str) -> tuple[float | None, str | None, str]:
        pattern = re.compile(
            r"^(?P<amount>\d+(?:[.,]\d+)?(?:/\d+)?|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on|yarim|half|one|two|three|four|five|six|seven|eight|nine|ten)\s*(?P<unit>gram|g|gr|kilo|kg|adet|tane|dilim|kase|tabak|bardak|yemek kasigi|tatli kasigi|olcek|porsiyon|portion|serving|cup|glass|slice|slices|tablespoon|tbsp|teaspoon|tsp|avuc|avuç)?\b\s*(?P<rest>.*)$"
        )
        match = pattern.match(text)
        if not match:
            return None, None, text

        amount_text = match.group("amount")
        unit_text = match.group("unit")
        remainder = match.group("rest").strip()
        amount = self._parse_amount(amount_text)
        unit = UNIT_ALIASES.get(unit_text, unit_text) if unit_text else None
        return amount, unit, remainder

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
        cleaned = re.sub(r"\s+", " ", cleaned).strip()
        return cleaned or text or "tanımsız besin"

    def _estimate_weight(
        self,
        food,
        amount: float | None,
        unit: str | None,
        modifiers: list[str],
    ) -> tuple[float | None, bool]:
        if amount is None:
            return None, False

        resolved_unit = unit or food.default_unit
        estimated = unit is None
        if resolved_unit == "gram":
            return amount, estimated
        if resolved_unit == "kilo":
            return amount * 1000, False

        unit_weight = food.unit_weights.get(resolved_unit)
        if unit_weight is None:
            return None, False

        multiplier = 1.0
        for modifier in modifiers:
            multiplier *= SIZE_MODIFIERS.get(modifier, 1.0)
        return amount * unit_weight * multiplier, estimated or resolved_unit not in {"gram", "kilo", "adet"}

    def _score_item(
        self,
        raw_text: str,
        food_name: str,
        food,
        amount: float | None,
        unit: str | None,
        estimated_weight_g: float | None,
        estimated: bool,
    ) -> tuple[float, str, bool, str | None]:
        if any(word in raw_text for word in LOW_CONFIDENCE_WORDS):
            return 0.25, "low", True, "Porsiyon ifadesi belirsiz. Gram veya net bir ölçü girer misin?"
        if amount is None:
            return 0.3, "low", True, "Miktar eksik. Kaç gram, adet, kase veya tabak olduğunu belirtir misin?"
        if estimated_weight_g is None:
            return 0.35, "low", True, "Ölçü birimini anlayamadım. Gram, adet, kase veya tabak gibi net bir ölçü girer misin?"
        if unit in {"gram", "kilo"}:
            return 0.97, "high", False, None
        if unit == "adet" and food.default_unit == "adet":
            return 0.93, "high", False, None
        if unit in {"olcek", "dilim", "yemek kasigi", "tatli kasigi", "bardak"}:
            return 0.82, "medium", False, None
        if unit in {"kase", "tabak", "porsiyon", None}:
            return 0.72 if estimated else 0.78, "medium", False, None
        return 0.65, "medium", False, None

    def _clarification_options(self, food) -> list[str]:
        options = []
        for unit in ("gram", "adet", "kase", "tabak", "dilim", "bardak", "olcek", "porsiyon"):
            if unit == "gram" or unit in food.unit_weights:
                options.append(unit)
        return options[:4]

    def _overall_confidence(self, items: list[ParsedNutritionItem]) -> float:
        if not items:
            return 0.0
        return round(sum(item.confidence_score for item in items) / len(items), 2)

    def _confidence_level_from_score(self, score: float) -> str:
        if score >= 0.85:
            return "high"
        if score >= 0.55:
            return "medium"
        return "low"

    def _display_modifier(self, modifier: str) -> str:
        mapping = {"kucuk": "küçük", "orta": "orta", "buyuk": "büyük"}
        return mapping.get(modifier, modifier)

    def _dedupe_foods(self, foods: list[FoodReference]) -> list[FoodReference]:
        deduped: list[FoodReference] = []
        seen_ids: set[str] = set()
        for food in foods:
            if food.canonical_id in seen_ids:
                continue
            deduped.append(food)
            seen_ids.add(food.canonical_id)
        return deduped
