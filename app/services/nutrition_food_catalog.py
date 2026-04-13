import re
import unicodedata
from dataclasses import dataclass


GENERIC_ALIASES = {
    "yumurta",
    "egg",
    "tavuk",
    "chicken",
    "ekmek",
    "bread",
    "peynir",
    "cheese",
    "pirinc",
    "rice",
    "yogurt",
    "milk",
}


@dataclass(slots=True)
class FoodDefinition:
    canonical_id: str
    display_name_tr: str
    aliases_tr: list[str]
    aliases_en: list[str]
    default_unit: str
    standard_unit_weight_g: float
    kcal_per_100g: float
    protein_per_100g: float
    carbs_per_100g: float
    fat_per_100g: float
    unit_weights: dict[str, float]


@dataclass(slots=True)
class FoodMatch:
    food: FoodDefinition
    matched_alias: str
    score: float
    is_exact: bool
    is_generic: bool


def normalize_food_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    ascii_text = "".join(char for char in normalized if not unicodedata.combining(char))

    literal_replacements = {
        "&": " and ",
        "/": " ",
        "-": " ",
    }
    for source, target in literal_replacements.items():
        ascii_text = ascii_text.replace(source, target)

    regex_replacements = {
        r"\bgr\b": "gram",
        r"\bkg\b": "kilo",
        r"\bml\b": "mililitre",
        r"\bölçek\b": "olcek",
        r"\bölcek\b": "olcek",
        r"\bkaşığı\b": "kasigi",
        r"\bkasığı\b": "kasigi",
        r"\bçorba kaşığı\b": "yemek kasigi",
        r"\bcorba kasigi\b": "yemek kasigi",
        r"\btatlı kaşığı\b": "tatli kasigi",
        r"\btepeleme\b": "buyuk",
        r"\bsilme\b": "kucuk",
        r"\bgöğsü\b": "gogsu",
        r"\bgogus\b": "gogus",
        r"\bgöğüs\b": "gogus",
        r"\byağsız\b": "yagsiz",
    }
    for pattern, replacement in regex_replacements.items():
        ascii_text = re.sub(pattern, replacement, ascii_text)

    ascii_text = re.sub(r"[^a-z0-9\s]+", " ", ascii_text)
    ascii_text = re.sub(r"\s+", " ", ascii_text).strip()
    return ascii_text


class FoodCatalog:
    def __init__(self) -> None:
        self._foods = FOOD_DATABASE
        self._by_id = {food.canonical_id: food for food in self._foods}
        self._aliases = self._build_aliases()

    def get_food(self, canonical_id: str) -> FoodDefinition | None:
        return self._by_id.get(canonical_id)

    def match_food(self, text: str) -> FoodMatch | None:
        normalized = normalize_food_text(text)
        if not normalized:
            return None

        best_match: FoodMatch | None = None
        for alias, food in self._aliases:
            score, is_exact = self._score_alias_match(normalized, alias)
            if score < 0.55:
                continue

            candidate = FoodMatch(
                food=food,
                matched_alias=alias,
                score=score,
                is_exact=is_exact,
                is_generic=alias in GENERIC_ALIASES,
            )
            if best_match is None:
                best_match = candidate
                continue
            if candidate.score > best_match.score:
                best_match = candidate
                continue
            if candidate.score == best_match.score and len(candidate.matched_alias) > len(best_match.matched_alias):
                best_match = candidate

        return best_match

    def suggest_foods(self, text: str, limit: int = 3) -> list[str]:
        normalized = normalize_food_text(text)
        query_tokens = set(normalized.split())
        if not query_tokens:
            return []

        ranked: list[tuple[float, str]] = []
        for food in self._foods:
            alias_tokens = set()
            for alias in [food.display_name_tr, *food.aliases_tr, *food.aliases_en]:
                alias_tokens.update(normalize_food_text(alias).split())
            overlap = len(query_tokens.intersection(alias_tokens))
            if overlap:
                ranked.append((overlap / max(len(query_tokens), 1), food.display_name_tr))

        ranked.sort(key=lambda item: (item[0], item[1]), reverse=True)
        return [label for _, label in ranked[:limit]]

    def _build_aliases(self) -> list[tuple[str, FoodDefinition]]:
        aliases: list[tuple[str, FoodDefinition]] = []
        for food in self._foods:
            for alias in [food.display_name_tr, *food.aliases_tr, *food.aliases_en]:
                normalized = normalize_food_text(alias)
                if normalized:
                    aliases.append((normalized, food))
        aliases.sort(key=lambda item: len(item[0]), reverse=True)
        return aliases

    def _score_alias_match(self, normalized_text: str, alias: str) -> tuple[float, bool]:
        if normalized_text == alias:
            return 1.0, True

        text_tokens = normalized_text.split()
        alias_tokens = alias.split()
        if not alias_tokens:
            return 0.0, False

        if alias in normalized_text:
            coverage = len(alias_tokens) / max(len(text_tokens), 1)
            return min(0.93, 0.76 + coverage * 0.18), False

        overlap = len(set(text_tokens).intersection(alias_tokens))
        if overlap == len(alias_tokens):
            coverage = overlap / max(len(text_tokens), 1)
            return min(0.82, 0.67 + coverage * 0.18), False

        return 0.0, False


FOOD_DATABASE = [
    FoodDefinition(
        "egg_generic",
        "Yumurta",
        ["yumurta", "tam yumurta", "butun yumurta"],
        ["egg", "whole egg"],
        "adet",
        50,
        143,
        12.6,
        0.7,
        9.5,
        {"adet": 50},
    ),
    FoodDefinition(
        "egg_boiled",
        "Haşlanmış Yumurta",
        ["haslanmis yumurta", "rafadan yumurta", "kati yumurta"],
        ["boiled egg"],
        "adet",
        50,
        155,
        13.0,
        1.1,
        10.6,
        {"adet": 50},
    ),
    FoodDefinition(
        "egg_fried",
        "Kızarmış Yumurta",
        ["kizarmis yumurta", "sahanda yumurta", "tavada yumurta"],
        ["fried egg"],
        "adet",
        50,
        196,
        13.6,
        1.0,
        15.0,
        {"adet": 50},
    ),
    FoodDefinition(
        "chicken_breast",
        "Tavuk Göğsü",
        ["tavuk gogsu", "tavuk gogus", "izgara tavuk", "izgara tavuk gogsu", "tavuk fileto", "tavuk"],
        ["chicken breast", "grilled chicken breast", "chicken breast", "chicken"],
        "gram",
        100,
        165,
        31.0,
        0.0,
        3.6,
        {"gram": 1, "porsiyon": 150, "tabak": 180},
    ),
    FoodDefinition(
        "beef_lean",
        "Yağsız Dana Eti",
        ["dana eti", "yagsiz dana eti", "az yagli dana", "kirmizi et", "dana biftek", "izgara dana"],
        ["lean beef", "beef", "beef steak", "steak"],
        "gram",
        100,
        217,
        26.0,
        0.0,
        12.0,
        {"gram": 1, "porsiyon": 150, "tabak": 180},
    ),
    FoodDefinition(
        "rice_cooked",
        "Haşlanmış Pirinç",
        ["haslanmis pirinc", "pirinc", "sade pirinc"],
        ["cooked rice", "rice"],
        "gram",
        100,
        130,
        2.7,
        28.0,
        0.3,
        {"gram": 1, "kase": 160, "tabak": 220, "porsiyon": 180, "yemek kasigi": 15},
    ),
    FoodDefinition(
        "rice_pilaf",
        "Pilav",
        ["pilav", "pirinc pilavi", "sehriyeli pilav"],
        ["pilaf", "rice pilaf"],
        "kase",
        160,
        172,
        3.2,
        31.0,
        3.5,
        {"gram": 1, "kase": 160, "tabak": 220, "porsiyon": 180, "yemek kasigi": 17},
    ),
    FoodDefinition(
        "bulgur_pilaf",
        "Bulgur Pilavı",
        ["bulgur pilavi", "bulgur", "sebzeli bulgur"],
        ["bulgur pilaf", "bulgur"],
        "kase",
        170,
        140,
        3.8,
        28.0,
        1.8,
        {"gram": 1, "kase": 170, "tabak": 230, "porsiyon": 190},
    ),
    FoodDefinition(
        "pasta_cooked",
        "Makarna",
        ["makarna", "haslanmis makarna", "sade makarna", "domates soslu makarna"],
        ["pasta", "cooked pasta", "macaroni"],
        "tabak",
        180,
        157,
        5.8,
        30.9,
        0.9,
        {"gram": 1, "tabak": 180, "kase": 140, "porsiyon": 180},
    ),
    FoodDefinition(
        "oats_dry",
        "Yulaf",
        ["yulaf", "yulaf ezmesi"],
        ["oats", "oatmeal", "rolled oats"],
        "gram",
        100,
        389,
        16.9,
        66.3,
        6.9,
        {"gram": 1, "yemek kasigi": 10, "bardak": 80, "kase": 70, "porsiyon": 60},
    ),
    FoodDefinition(
        "bread_white",
        "Beyaz Ekmek",
        ["ekmek", "beyaz ekmek", "somun ekmek"],
        ["bread", "white bread"],
        "dilim",
        30,
        265,
        8.9,
        49.0,
        3.2,
        {"dilim": 30, "adet": 30},
    ),
    FoodDefinition(
        "bread_whole_wheat",
        "Tam Buğday Ekmeği",
        ["tam bugday ekmegi", "tam tahilli ekmek", "esmer ekmek"],
        ["whole wheat bread", "brown bread"],
        "dilim",
        32,
        247,
        12.5,
        41.0,
        3.5,
        {"dilim": 32},
    ),
    FoodDefinition(
        "cheese_lor",
        "Lor Peyniri",
        ["lor", "lor peyniri"],
        ["curd cheese", "lor cheese"],
        "gram",
        100,
        98,
        18.0,
        3.0,
        1.5,
        {"gram": 1, "kase": 120, "porsiyon": 100},
    ),
    FoodDefinition(
        "cheese_white",
        "Beyaz Peynir",
        ["beyaz peynir", "feta", "tam yagli beyaz peynir"],
        ["white cheese", "feta cheese"],
        "dilim",
        30,
        260,
        14.0,
        4.0,
        20.0,
        {"gram": 1, "dilim": 30, "porsiyon": 60},
    ),
    FoodDefinition(
        "cheese_kasar",
        "Kaşar Peyniri",
        ["kasar", "kasar peyniri", "dilim kasar"],
        ["kasar cheese", "yellow cheese", "cheddar cheese"],
        "dilim",
        25,
        350,
        25.0,
        2.0,
        27.0,
        {"gram": 1, "dilim": 25},
    ),
    FoodDefinition(
        "yogurt_plain",
        "Yoğurt",
        ["yogurt", "sade yogurt", "ev yogurdu"],
        ["yogurt", "plain yogurt"],
        "kase",
        200,
        61,
        3.5,
        4.7,
        3.3,
        {"gram": 1, "kase": 200, "bardak": 200, "porsiyon": 180},
    ),
    FoodDefinition(
        "milk_semiskim",
        "Süt",
        ["sut", "yarim yagli sut", "light sut"],
        ["milk", "semi skim milk"],
        "bardak",
        200,
        50,
        3.4,
        4.8,
        1.9,
        {"gram": 1, "bardak": 200, "kase": 200},
    ),
    FoodDefinition(
        "banana",
        "Muz",
        ["muz"],
        ["banana"],
        "adet",
        120,
        89,
        1.1,
        22.8,
        0.3,
        {"adet": 120},
    ),
    FoodDefinition(
        "apple",
        "Elma",
        ["elma"],
        ["apple"],
        "adet",
        180,
        52,
        0.3,
        13.8,
        0.2,
        {"adet": 180},
    ),
    FoodDefinition(
        "olive_oil",
        "Zeytinyağı",
        ["zeytinyagi", "zeytin yagi"],
        ["olive oil"],
        "yemek kasigi",
        13.5,
        884,
        0.0,
        0.0,
        100.0,
        {"gram": 1, "yemek kasigi": 13.5, "tatli kasigi": 5},
    ),
    FoodDefinition(
        "mixed_nuts",
        "Karışık Kuruyemiş",
        ["karisik kuruyemis", "kuruyemis", "karisik cerez", "badem findik karisimi"],
        ["mixed nuts", "nuts", "trail mix"],
        "gram",
        100,
        607,
        20.0,
        21.0,
        54.0,
        {"gram": 1, "avuc": 30, "porsiyon": 30},
    ),
    FoodDefinition(
        "whey_protein",
        "Whey Protein",
        ["whey", "protein tozu", "whey protein"],
        ["whey", "whey protein", "protein powder"],
        "olcek",
        30,
        400,
        80.0,
        10.0,
        7.0,
        {"gram": 1, "olcek": 30, "porsiyon": 30},
    ),
    FoodDefinition(
        "ayran",
        "Ayran",
        ["ayran"],
        ["ayran", "yogurt drink"],
        "bardak",
        200,
        37,
        1.9,
        2.8,
        1.5,
        {"gram": 1, "bardak": 200},
    ),
]
