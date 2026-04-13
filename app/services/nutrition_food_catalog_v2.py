import re
import unicodedata
from dataclasses import dataclass
from difflib import SequenceMatcher


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
    "et",
    "meat",
    "makarna",
    "pasta",
    "misir",
    "corn",
}

FOOD_TEXT_REPLACEMENTS: tuple[tuple[str, str], ...] = (
    (r"\bgrm\b", "gram"),
    (r"\bg\b", "gram"),
    (r"\bgr\b", "gram"),
    (r"\bkg\b", "kilo"),
    (r"\bkğ\b", "kilo"),
    (r"\bjasmin\b", "jasmine"),
    (r"\bjasmine\b", "jasmine"),
    (r"\bgogsu\b", "gogsu"),
    (r"\bgogus\b", "gogus"),
    (r"\bhindi fume\b", "hindi fume"),
    (r"\btavuk gogsu\b", "tavuk gogsu"),
)

EXACT_SYNONYM_CANONICAL_IDS = {
    "tavuk": "chicken_breast_cooked",
    "hindi fume": "turkey_fume_deli",
    "hindi fume sarkuteri": "turkey_fume_deli",
    "pilav": "rice_pilaf",
    "makarna": "pasta_cooked",
    "ton": "tuna_canned_water",
}

SOFT_SYNONYM_CANONICAL_IDS = {
    "jasmine pirinc": "rice_cooked",
    "jasmin pirinc": "rice_cooked",
    "jasmine rice": "rice_cooked",
}

COOKING_METHOD_ALIASES = {
    "patlamis": "popcorn",
    "patlamismis": "popcorn",
    "popcorn": "popcorn",
    "haslanmis": "boiled",
    "haslama": "boiled",
    "kizarmis": "fried",
    "kizartma": "fried",
    "firinlanmis": "baked",
    "firin": "baked",
    "izgara": "grilled",
    "koz": "roasted",
    "fume": "smoked",
}

FOOD_CONTEXT_KEYWORDS = {
    "corn_boiled": {"boiled", "sweet", "corn"},
    "corn_roasted": {"roasted", "corn"},
    "corn_popcorn": {"popcorn", "corn"},
    "fries": {"fried", "potato"},
    "chicken_breast_cooked": {"chicken", "breast"},
    "chicken_breast_grilled": {"grilled", "chicken", "breast"},
    "turkey_fume_deli": {"smoked", "turkey"},
    "yogurt_plain": {"yogurt"},
    "yogurt_strained": {"strained", "yogurt"},
    "rice_raw": {"raw", "rice", "pirinc"},
    "rice_cooked": {"boiled", "cooked", "rice", "pirinc"},
    "rice_pilaf": {"pilaf", "pilav", "rice", "pirinc"},
}

BASE_FOOD_ALIASES = {
    "corn": {"misir", "corn", "sut misir", "sweet corn"},
    "chicken": {"tavuk", "chicken", "tavuk gogsu", "chicken breast"},
    "turkey": {"hindi", "turkey", "hindi gogsu", "smoked turkey", "hindi fume"},
    "yogurt": {"yogurt", "yoğurt", "suzme yogurt", "strained yogurt"},
    "rice": {"pirinc", "rice", "pilav", "pirinc pilavi"},
    "pasta": {"makarna", "pasta", "macaroni"},
    "potato": {"patates", "potato", "patates kizartmasi"},
}

COOKING_METHOD_LABELS = {
    "boiled": "haşlanmış",
    "fried": "kızarmış",
    "baked": "fırın",
    "grilled": "ızgara",
    "roasted": "köz",
    "smoked": "füme",
    "popcorn": "patlamış",
    "cooked": "pişmiş",
    "raw": "çiğ",
}

AMBIGUOUS_QUERY_CANONICAL_IDS = {
    "misir": ["corn_popcorn", "corn_boiled", "corn_roasted"],
    "corn": ["corn_popcorn", "corn_boiled", "corn_roasted"],
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
    base_food: str | None = None
    cooking_method: str | None = None
    category: str | None = None
    related_foods: list[str] | None = None
    brand: str | None = None
    product_name: str | None = None
    is_branded_product: bool = False


@dataclass(slots=True)
class FoodMatch:
    food: FoodDefinition
    matched_alias: str
    score: float
    is_exact: bool
    is_generic: bool


@dataclass(slots=True)
class FoodGraphContext:
    normalized_query: str
    detected_tokens: list[str]
    base_food: str | None
    cooking_method: str | None
    related_foods: list[str]


def normalize_food_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    ascii_text = "".join(char for char in normalized if not unicodedata.combining(char))
    ascii_text = ascii_text.replace("ı", "i")

    literal_replacements = {
        "&": " and ",
        "/": " ",
        "-": " ",
        "'": " ",
    }
    for source, target in literal_replacements.items():
        ascii_text = ascii_text.replace(source, target)

    regex_replacements = {
        r"\bml\b": "mililitre",
        r"\bölçek\b": "olcek",
        r"\bölcek\b": "olcek",
        r"\bçorba kaşığı\b": "yemek kasigi",
        r"\bcorba kasigi\b": "yemek kasigi",
        r"\btatlı kaşığı\b": "tatli kasigi",
        r"\bkaşığı\b": "kasigi",
        r"\bgöğsü\b": "gogsu",
        r"\bgöğüs\b": "gogus",
        r"\bgogus\b": "gogus",
        r"\byağsız\b": "yagsiz",
        r"\baz yağlı\b": "az yagli",
        r"\btam buğday\b": "tam bugday",
        r"\bsüzme\b": "suzme",
    }
    for pattern, replacement in (*FOOD_TEXT_REPLACEMENTS, *regex_replacements.items()):
        ascii_text = re.sub(pattern, replacement, ascii_text)

    ascii_text = re.sub(r"[^a-z0-9.,\s]+", " ", ascii_text)
    ascii_text = re.sub(r"\s+", " ", ascii_text).strip()
    return ascii_text


def food(
    canonical_id: str,
    display_name_tr: str,
    aliases_tr: list[str],
    aliases_en: list[str],
    default_unit: str,
    standard_unit_weight_g: float,
    kcal_per_100g: float,
    protein_per_100g: float,
    carbs_per_100g: float,
    fat_per_100g: float,
    unit_weights: dict[str, float] | None = None,
    base_food: str | None = None,
    cooking_method: str | None = None,
    category: str | None = None,
    related_foods: list[str] | None = None,
    brand: str | None = None,
    product_name: str | None = None,
    is_branded_product: bool = False,
) -> FoodDefinition:
    weights = dict(unit_weights or {})
    if default_unit not in weights:
        if default_unit == "gram":
            weights[default_unit] = 1.0
        else:
            weights[default_unit] = standard_unit_weight_g
    return FoodDefinition(
        canonical_id=canonical_id,
        display_name_tr=display_name_tr,
        aliases_tr=aliases_tr,
        aliases_en=aliases_en,
        default_unit=default_unit,
        standard_unit_weight_g=standard_unit_weight_g,
        kcal_per_100g=kcal_per_100g,
        protein_per_100g=protein_per_100g,
        carbs_per_100g=carbs_per_100g,
        fat_per_100g=fat_per_100g,
        unit_weights=weights,
        base_food=base_food,
        cooking_method=cooking_method,
        category=category,
        related_foods=list(related_foods or []),
        brand=brand,
        product_name=product_name,
        is_branded_product=is_branded_product,
    )


PROTEIN_FOODS: list[FoodDefinition] = [
    food("egg_whole", "Yumurta", ["yumurta", "tam yumurta", "butun yumurta"], ["egg", "whole egg"], "adet", 50, 143, 12.6, 0.7, 9.5, {"adet": 50}),
    food("egg_boiled", "Haşlanmış Yumurta", ["haslanmis yumurta", "rafadan yumurta", "katı yumurta"], ["boiled egg"], "adet", 50, 155, 12.6, 1.1, 10.6, {"adet": 50}),
    food("egg_fried", "Kızarmış Yumurta", ["kizarmis yumurta", "sahanda yumurta", "tavada yumurta"], ["fried egg"], "adet", 50, 196, 13.6, 1.1, 15.0, {"adet": 50}),
    food("egg_white", "Yumurta Beyazı", ["yumurta beyazi", "sadece beyaz", "beyaz yumurta"], ["egg white"], "adet", 33, 52, 10.9, 0.7, 0.2, {"adet": 33}),
    food("egg_omelet", "Omlet", ["omlet", "omelet", "sade omlet"], ["omelet", "omelette"], "porsiyon", 120, 154, 10.8, 1.9, 11.8, {"porsiyon": 120, "tabak": 180}),
    food("sucuklu_yumurta", "Sucuklu Yumurta", ["sucuklu yumurta"], ["eggs with sausage"], "porsiyon", 180, 235, 13.0, 2.0, 19.0, {"porsiyon": 180, "tabak": 220}),
    food("chicken_breast_raw", "Tavuk Göğsü (Çiğ)", ["cig tavuk gogsu", "tavuk gogsu cig", "cig tavuk"], ["raw chicken breast"], "gram", 100, 120, 22.5, 0.0, 2.6, {"gram": 1, "porsiyon": 150}),
    food("chicken_breast_cooked", "Tavuk Göğsü", ["tavuk", "tavuk gogsu", "pisimis tavuk gogsu", "tavuk fileto"], ["chicken", "chicken breast", "cooked chicken breast"], "gram", 100, 165, 31.0, 0.0, 3.6, {"gram": 1, "porsiyon": 150, "tabak": 180}, base_food="chicken", cooking_method="cooked", category="protein"),
    food("chicken_breast_grilled", "Izgara Tavuk Göğsü", ["izgara tavuk gogsu", "izgara tavuk", "grill tavuk"], ["grilled chicken breast", "grilled chicken"], "gram", 100, 172, 32.0, 0.0, 3.8, {"gram": 1, "porsiyon": 150, "tabak": 180}, base_food="chicken", cooking_method="grilled", category="protein"),
    food("chicken_breast_fried", "Kızarmış Tavuk Göğsü", ["kizarmis tavuk gogsu", "pane tavuk", "kizartma tavuk"], ["fried chicken breast"], "gram", 100, 246, 28.0, 8.0, 9.0, {"gram": 1, "porsiyon": 150, "tabak": 180}, base_food="chicken", cooking_method="fried", category="protein"),
    food("chicken_thigh_cooked", "Tavuk But", ["tavuk but", "pisimis tavuk but", "but eti"], ["chicken thigh"], "gram", 100, 209, 26.0, 0.0, 10.9, {"gram": 1, "porsiyon": 150}),
    food("chicken_wing_grilled", "Izgara Tavuk Kanat", ["izgara tavuk kanat", "tavuk kanat"], ["grilled chicken wing", "chicken wing"], "gram", 100, 247, 23.0, 0.0, 17.0, {"gram": 1, "adet": 35, "porsiyon": 180}),
    food("turkey_breast_cooked", "Hindi Göğsü", ["hindi gogsu", "pisimis hindi gogsu", "hindi fileto"], ["turkey breast"], "gram", 100, 135, 29.0, 0.0, 1.6, {"gram": 1, "porsiyon": 150}),
    food("turkey_fume_deli", "Hindi Füme Şarküteri", ["hindi fume", "hindi fume sarkuteri", "hindi salam", "hindi füme", "hindi füme şarküteri", "hindi fume dilim"], ["smoked turkey", "turkey deli", "smoked turkey slices"], "dilim", 20, 108, 18.5, 2.2, 1.8, {"gram": 1, "dilim": 20, "porsiyon": 60}, base_food="turkey", cooking_method="smoked", category="protein"),
    food("beef_lean_raw", "Dana Eti (Çiğ)", ["dana eti cig", "cig dana eti", "yagsiz dana eti"], ["raw lean beef", "lean beef raw"], "gram", 100, 140, 21.0, 0.0, 6.0, {"gram": 1, "porsiyon": 150}),
    food("beef_lean_grilled", "Izgara Dana Eti", ["izgara dana", "dana biftek", "yagsiz dana", "kirmizi et"], ["grilled lean beef", "beef steak", "steak"], "gram", 100, 217, 26.0, 0.0, 12.0, {"gram": 1, "porsiyon": 150, "tabak": 180}),
    food("beef_mince_lean_cooked", "Yağsız Dana Kıyma", ["yagsiz dana kiyma", "dana kiyma", "pisimis kiyma"], ["lean ground beef", "cooked ground beef"], "gram", 100, 250, 26.0, 0.0, 17.0, {"gram": 1, "porsiyon": 120}),
    food("kofte_grilled", "Izgara Köfte", ["izgara kofte", "kofte"], ["grilled meatballs", "meatballs"], "adet", 35, 245, 22.0, 5.0, 16.0, {"adet": 35, "porsiyon": 175}),
    food("salmon_grilled", "Izgara Somon", ["izgara somon", "somon"], ["grilled salmon", "salmon"], "gram", 100, 208, 22.0, 0.0, 13.0, {"gram": 1, "porsiyon": 150}),
    food("tuna_canned_water", "Ton Balığı (Suda)", ["ton baligi suda", "light ton baligi", "suda ton"], ["tuna in water", "canned tuna"], "gram", 100, 116, 26.0, 0.0, 1.0, {"gram": 1, "kutu": 120, "porsiyon": 100}),
    food("tuna_canned_oil", "Ton Balığı (Yağda)", ["ton baligi yagda", "yagli ton baligi"], ["tuna in oil"], "gram", 100, 198, 29.0, 0.0, 8.0, {"gram": 1, "kutu": 120, "porsiyon": 100}),
    food("white_fish_grilled", "Izgara Beyaz Balık", ["izgara levrek", "izgara mezgit", "beyaz balik"], ["grilled white fish"], "gram", 100, 128, 26.0, 0.0, 2.7, {"gram": 1, "porsiyon": 150}),
    food("shrimp_cooked", "Karides", ["karides", "pisimis karides"], ["shrimp", "cooked shrimp"], "gram", 100, 99, 24.0, 0.2, 0.3, {"gram": 1, "porsiyon": 140}),
    food("liver_cooked", "Dana Ciğer", ["dana ciger", "ciger"], ["beef liver", "liver"], "gram", 100, 175, 26.0, 5.0, 5.0, {"gram": 1, "porsiyon": 120}),
    food("sucuk", "Sucuk", ["sucuk"], ["turkish sausage", "sucuk"], "gram", 100, 452, 24.0, 1.0, 39.0, {"gram": 1, "dilim": 18}),
]

DAIRY_AND_SUPPLEMENTS: list[FoodDefinition] = [
    food("yogurt_plain", "Yoğurt", ["yogurt", "sade yogurt", "ev yogurdu", "yoğurt", "normal yogurt"], ["yogurt", "plain yogurt"], "kase", 180, 62, 3.8, 4.7, 3.3, {"gram": 1, "kase": 180, "bardak": 200, "porsiyon": 180}, base_food="yogurt", cooking_method="plain", category="dairy"),
    food("yogurt_strained", "Süzme Yoğurt", ["suzme yogurt", "torba yogurt", "süzme yoğurt", "suzme yog"], ["strained yogurt", "greek yogurt"], "kase", 150, 97, 9.0, 4.0, 4.8, {"gram": 1, "kase": 150, "yemek kasigi": 25, "porsiyon": 150}, base_food="yogurt", cooking_method="strained", category="dairy"),
    food("yogurt_high_protein", "Protein Yoğurt", ["protein yogurt", "high protein yogurt", "fit yogurt"], ["high protein yogurt", "protein yogurt"], "kase", 200, 59, 10.0, 3.6, 0.2, {"gram": 1, "kase": 200, "bardak": 220}),
    food("ayran", "Ayran", ["ayran"], ["ayran", "yogurt drink"], "bardak", 200, 30, 1.8, 2.4, 1.2, {"gram": 1, "bardak": 200}),
    food("kefir", "Kefir", ["kefir"], ["kefir"], "bardak", 240, 57, 3.3, 4.5, 2.8, {"gram": 1, "bardak": 240}),
    food("milk_semiskim", "Yarım Yağlı Süt", ["yarim yagli sut", "light sut", "sut"], ["semi skim milk", "milk"], "bardak", 200, 50, 3.4, 4.8, 1.8, {"gram": 1, "bardak": 200}),
    food("milk_whole", "Tam Yağlı Süt", ["tam yagli sut"], ["whole milk"], "bardak", 200, 61, 3.2, 4.8, 3.3, {"gram": 1, "bardak": 200}),
    food("milk_lactosefree", "Laktozsuz Süt", ["laktozsuz sut"], ["lactose free milk"], "bardak", 200, 52, 3.3, 5.1, 1.8, {"gram": 1, "bardak": 200}),
    food("cheese_lor", "Lor Peyniri", ["lor", "lor peyniri"], ["lor cheese", "curd cheese"], "gram", 100, 98, 18.0, 3.0, 1.5, {"gram": 1, "kase": 120, "porsiyon": 100}),
    food("cheese_cottage", "Cottage Cheese", ["cottage cheese", "light lor"], ["cottage cheese"], "gram", 100, 98, 11.0, 3.4, 4.3, {"gram": 1, "kase": 120, "porsiyon": 100}),
    food("cheese_white", "Beyaz Peynir", ["beyaz peynir", "tam yagli beyaz peynir"], ["white cheese", "feta cheese"], "dilim", 30, 260, 14.0, 4.0, 20.0, {"gram": 1, "dilim": 30, "porsiyon": 60}),
    food("cheese_kasar", "Kaşar Peyniri", ["kasar", "kasar peyniri", "dilim kasar"], ["kasar cheese", "yellow cheese", "cheddar cheese"], "dilim", 25, 356, 25.0, 2.0, 27.0, {"gram": 1, "dilim": 25}),
    food("cheese_labneh", "Labne", ["labne"], ["labneh", "cream cheese"], "yemek kasigi", 20, 232, 6.5, 5.0, 21.0, {"gram": 1, "yemek kasigi": 20}),
    food("cheese_hellim", "Hellim Peyniri", ["hellim"], ["halloumi"], "gram", 100, 321, 22.0, 2.0, 25.0, {"gram": 1, "dilim": 40}),
    food("whey_concentrate", "Whey Protein", ["whey", "protein tozu", "whey protein"], ["whey", "whey protein", "protein powder"], "olcek", 32, 392, 78.0, 8.0, 6.0, {"gram": 1, "olcek": 32, "porsiyon": 32}),
    food("whey_isolate", "Whey Isolate", ["whey isolate", "izole whey", "izolat whey"], ["whey isolate"], "olcek", 30, 370, 86.0, 4.0, 3.0, {"gram": 1, "olcek": 30, "porsiyon": 30}),
    food("casein_protein", "Kazein Protein", ["kazein", "casein"], ["casein protein", "casein"], "olcek", 30, 360, 80.0, 8.0, 3.0, {"gram": 1, "olcek": 30}),
    food("protein_bar", "Protein Bar", ["protein bar", "bar"], ["protein bar"], "adet", 60, 370, 33.0, 35.0, 12.0, {"adet": 60}),
    food("skyr", "Skyr", ["skyr"], ["skyr"], "kase", 150, 64, 11.0, 3.8, 0.2, {"gram": 1, "kase": 150}),
]

CARB_AND_GRAIN_FOODS: list[FoodDefinition] = [
    food("rice_raw", "Pirinç (Çiğ)", ["pirinc cig", "cig pirinc"], ["raw rice"], "gram", 100, 360, 7.0, 79.0, 0.6, {"gram": 1, "yemek kasigi": 12}, base_food="rice", cooking_method="raw", category="carb", related_foods=["rice_cooked", "rice_pilaf", "basmati_rice_cooked"]),
    food("rice_cooked", "Beyaz Pirinç", ["haslanmis pirinc", "pirinc", "sade pirinc", "beyaz pirinc"], ["cooked rice", "rice", "white rice"], "gram", 100, 130, 2.7, 28.2, 0.3, {"gram": 1, "kase": 160, "tabak": 220, "porsiyon": 180, "yemek kasigi": 15}, base_food="rice", cooking_method="boiled", category="carb", related_foods=["rice_raw", "rice_pilaf", "basmati_rice_cooked"]),
    food("rice_pilaf", "Pirinç Pilavı", ["pilav", "pirinc pilavi", "sehriyeli pilav"], ["pilaf", "rice pilaf"], "kase", 170, 170, 3.2, 30.5, 4.0, {"gram": 1, "kase": 170, "tabak": 230, "porsiyon": 190}, base_food="rice", cooking_method="pilaf", category="carb", related_foods=["rice_raw", "rice_cooked", "basmati_rice_cooked"]),
    food("basmati_rice_cooked", "Basmati Pirinç", ["basmati pirinc", "basmati pilav"], ["basmati rice"], "gram", 100, 121, 3.5, 25.2, 0.4, {"gram": 1, "kase": 160, "tabak": 220}),
    food("bulgur_raw", "Bulgur (Çiğ)", ["bulgur cig", "cig bulgur"], ["raw bulgur"], "gram", 100, 342, 12.3, 75.9, 1.3, {"gram": 1, "yemek kasigi": 12}),
    food("bulgur_pilaf", "Bulgur Pilavı", ["bulgur pilavi", "bulgur"], ["bulgur pilaf", "bulgur"], "kase", 170, 135, 3.8, 28.0, 1.2, {"gram": 1, "kase": 170, "tabak": 230, "porsiyon": 190}),
    food("oats_dry", "Yulaf", ["yulaf", "yulaf ezmesi"], ["oats", "rolled oats"], "gram", 100, 389, 16.9, 66.3, 6.9, {"gram": 1, "yemek kasigi": 10, "bardak": 80, "kase": 70, "porsiyon": 60}),
    food("oatmeal_cooked", "Pişmiş Yulaf", ["pisimis yulaf", "lapa yulaf", "oatmeal"], ["cooked oats", "oatmeal"], "kase", 220, 71, 2.5, 12.0, 1.5, {"gram": 1, "kase": 220, "bardak": 240}),
    food("pasta_dry", "Makarna (Kuru)", ["makarna kuru", "kuru makarna"], ["dry pasta"], "gram", 100, 357, 12.5, 71.0, 1.5, {"gram": 1}),
    food("pasta_cooked", "Haşlanmış Makarna", ["makarna", "haslanmis makarna", "haslama makarna", "sade makarna"], ["pasta", "cooked pasta", "macaroni"], "tabak", 180, 157, 5.8, 30.9, 0.9, {"gram": 1, "tabak": 180, "kase": 140, "porsiyon": 180}, base_food="pasta", cooking_method="boiled", category="carb"),
    food("pasta_whole_wheat", "Tam Buğday Makarna", ["tam bugday makarna"], ["whole wheat pasta"], "tabak", 180, 149, 5.5, 29.0, 0.8, {"gram": 1, "tabak": 180, "kase": 140}),
    food("bread_white", "Beyaz Ekmek", ["ekmek", "beyaz ekmek", "somun ekmek"], ["bread", "white bread"], "dilim", 30, 265, 8.9, 49.0, 3.2, {"gram": 1, "dilim": 30}),
    food("bread_whole_wheat", "Tam Buğday Ekmeği", ["tam bugday ekmegi", "tam tahilli ekmek", "esmer ekmek"], ["whole wheat bread", "brown bread"], "dilim", 32, 247, 12.5, 41.0, 3.5, {"gram": 1, "dilim": 32}),
    food("bread_sourdough", "Ekşi Mayalı Ekmek", ["eksi mayali ekmek"], ["sourdough bread"], "dilim", 35, 252, 8.5, 48.0, 1.8, {"gram": 1, "dilim": 35}),
    food("bread_rye", "Çavdar Ekmeği", ["cavdar ekmegi"], ["rye bread"], "dilim", 34, 259, 8.5, 48.3, 3.3, {"gram": 1, "dilim": 34}),
    food("lavash", "Lavaş", ["lavash", "lavas"], ["lavash"], "adet", 60, 290, 9.0, 56.0, 4.5, {"adet": 60}),
    food("tortilla", "Tortilla", ["tortilla"], ["tortilla wrap"], "adet", 50, 310, 8.0, 52.0, 7.0, {"adet": 50}),
    food("bagel", "Bagel", ["bagel"], ["bagel"], "adet", 90, 270, 10.5, 53.0, 1.5, {"adet": 90}),
    food("simit", "Simit", ["simit"], ["turkish bagel", "simit"], "adet", 90, 320, 11.0, 58.0, 8.0, {"adet": 90}),
    food("rice_cake", "Pirinç Patlağı", ["pirinc patlagi", "rice cake"], ["rice cake"], "adet", 9, 387, 8.0, 81.0, 3.0, {"adet": 9}),
    food("potato_boiled", "Haşlanmış Patates", ["haslanmis patates"], ["boiled potato"], "gram", 100, 87, 1.9, 20.1, 0.1, {"gram": 1, "adet": 150}),
    food("potato_baked", "Fırın Patates", ["firin patates"], ["baked potato"], "gram", 100, 93, 2.5, 21.2, 0.1, {"gram": 1, "adet": 180}),
    food("potato_mashed", "Patates Püresi", ["patates puresi"], ["mashed potato"], "kase", 180, 105, 1.9, 15.7, 3.8, {"gram": 1, "kase": 180, "porsiyon": 180}),
    food("fries", "Patates Kızartması", ["patates kizartmasi", "kizarmis patates", "cips patates"], ["french fries", "fries", "fried potatoes"], "porsiyon", 130, 312, 3.4, 41.4, 15.0, {"gram": 1, "porsiyon": 130}),
    food("sweet_potato_baked", "Fırın Tatlı Patates", ["firin tatli patates", "tatli patates"], ["baked sweet potato", "sweet potato"], "gram", 100, 90, 2.0, 20.7, 0.2, {"gram": 1, "adet": 180}),
    food("corn_base", "Mısır", ["misir", "mısır", "corn"], ["corn"], "gram", 100, 96, 3.4, 21.0, 1.5, {"gram": 1, "adet": 100, "bardak": 150}, base_food="corn", category="carb", related_foods=["corn_popcorn", "corn_boiled", "corn_roasted"]),
    food("corn_boiled", "Haşlanmış Mısır", ["haslanmis misir", "haslama misir", "sut misir", "süt mısır"], ["boiled corn", "sweet corn"], "gram", 100, 96, 3.4, 21.0, 1.5, {"gram": 1, "adet": 100, "bardak": 150}, base_food="corn", cooking_method="boiled", category="carb", related_foods=["corn_base", "corn_popcorn", "corn_roasted"]),
    food("corn_roasted", "Köz Mısır", ["koz misir", "köz mısır", "izgara misir"], ["roasted corn", "grilled corn"], "gram", 100, 108, 3.2, 24.0, 1.6, {"gram": 1, "adet": 100, "bardak": 150}, base_food="corn", cooking_method="roasted", category="carb", related_foods=["corn_base", "corn_popcorn", "corn_boiled"]),
    food("corn_popcorn", "Patlamış Mısır", ["patlamis misir", "patlamış mısır", "popcorn", "misir patlagi"], ["popcorn", "popped corn"], "gram", 100, 387, 12.9, 77.9, 4.5, {"gram": 1, "kase": 20, "bardak": 8, "porsiyon": 30}, base_food="corn", cooking_method="popcorn", category="carb", related_foods=["corn_base", "corn_boiled", "corn_roasted"]),
    food("quinoa_cooked", "Kinoa", ["kinoa"], ["quinoa"], "kase", 185, 120, 4.4, 21.3, 1.9, {"gram": 1, "kase": 185}),
    food("couscous_cooked", "Kuskus", ["kuskus"], ["couscous"], "kase", 160, 112, 3.8, 23.2, 0.2, {"gram": 1, "kase": 160}),
    food("granola", "Granola", ["granola"], ["granola"], "gram", 100, 471, 10.0, 64.0, 20.0, {"gram": 1, "kase": 60}),
]

LEGUME_FOODS: list[FoodDefinition] = [
    food("lentils_cooked", "Haşlanmış Mercimek", ["haslanmis mercimek", "yesil mercimek"], ["cooked lentils", "lentils"], "kase", 180, 116, 9.0, 20.0, 0.4, {"gram": 1, "kase": 180}),
    food("chickpeas_cooked", "Haşlanmış Nohut", ["haslanmis nohut", "nohut"], ["cooked chickpeas", "chickpeas"], "kase", 180, 164, 8.9, 27.4, 2.6, {"gram": 1, "kase": 180}),
    food("beans_cooked", "Haşlanmış Fasulye", ["haslanmis fasulye", "barbunya fasulye"], ["cooked beans"], "kase", 180, 127, 8.7, 22.8, 0.5, {"gram": 1, "kase": 180}),
    food("kidney_beans_cooked", "Barbunya", ["barbunya", "barbunya fasulye"], ["kidney beans"], "kase", 180, 127, 8.7, 22.8, 0.5, {"gram": 1, "kase": 180}),
    food("peas_cooked", "Haşlanmış Bezelye", ["haslanmis bezelye", "bezelye"], ["cooked peas", "peas"], "kase", 160, 84, 5.4, 15.0, 0.4, {"gram": 1, "kase": 160}),
    food("black_beans_cooked", "Siyah Fasulye", ["siyah fasulye"], ["black beans"], "kase", 180, 132, 8.9, 23.7, 0.5, {"gram": 1, "kase": 180}),
    food("hummus", "Humus", ["humus"], ["hummus"], "yemek kasigi", 30, 166, 7.9, 14.3, 9.6, {"gram": 1, "yemek kasigi": 30, "kase": 120}),
    food("edamame", "Edamame", ["edamame"], ["edamame"], "kase", 150, 121, 11.9, 8.9, 5.2, {"gram": 1, "kase": 150}),
]

FRUIT_FOODS: list[FoodDefinition] = [
    food("banana", "Muz", ["muz"], ["banana"], "adet", 120, 89, 1.1, 22.8, 0.3, {"adet": 120}),
    food("apple", "Elma", ["elma"], ["apple"], "adet", 180, 52, 0.3, 13.8, 0.2, {"adet": 180}),
    food("pear", "Armut", ["armut"], ["pear"], "adet", 180, 57, 0.4, 15.2, 0.1, {"adet": 180}),
    food("orange", "Portakal", ["portakal"], ["orange"], "adet", 180, 47, 0.9, 11.8, 0.1, {"adet": 180}),
    food("mandarin", "Mandalina", ["mandalina"], ["mandarin", "tangerine"], "adet", 90, 53, 0.8, 13.3, 0.3, {"adet": 90}),
    food("strawberries", "Çilek", ["cilek"], ["strawberry", "strawberries"], "kase", 150, 32, 0.7, 7.7, 0.3, {"gram": 1, "kase": 150}),
    food("blueberries", "Yaban Mersini", ["yaban mersini"], ["blueberries", "blueberry"], "kase", 100, 57, 0.7, 14.5, 0.3, {"gram": 1, "kase": 100}),
    food("grapes", "Üzüm", ["uzum"], ["grapes"], "kase", 120, 69, 0.7, 18.1, 0.2, {"gram": 1, "kase": 120}),
    food("kiwi", "Kivi", ["kivi"], ["kiwi"], "adet", 75, 61, 1.1, 14.7, 0.5, {"adet": 75}),
    food("dates", "Hurma", ["hurma"], ["dates", "date"], "adet", 24, 282, 2.5, 75.0, 0.4, {"adet": 24}),
    food("raisins", "Kuru Üzüm", ["kuru uzum"], ["raisins"], "yemek kasigi", 10, 299, 3.1, 79.0, 0.5, {"gram": 1, "yemek kasigi": 10}),
    food("peach", "Şeftali", ["seftali"], ["peach"], "adet", 150, 39, 0.9, 9.5, 0.3, {"adet": 150}),
    food("pineapple", "Ananas", ["ananas"], ["pineapple"], "kase", 140, 50, 0.5, 13.1, 0.1, {"gram": 1, "kase": 140}),
    food("watermelon", "Karpuz", ["karpuz"], ["watermelon"], "dilim", 280, 30, 0.6, 7.6, 0.2, {"gram": 1, "dilim": 280}),
    food("melon", "Kavun", ["kavun"], ["melon"], "dilim", 200, 34, 0.8, 8.2, 0.2, {"gram": 1, "dilim": 200}),
    food("pomegranate", "Nar", ["nar"], ["pomegranate"], "adet", 280, 83, 1.7, 18.7, 1.2, {"adet": 280}),
    food("apricot", "Kayısı", ["kayisi"], ["apricot"], "adet", 35, 48, 1.4, 11.1, 0.4, {"adet": 35}),
    food("fig", "İncir", ["incir"], ["fig"], "adet", 50, 74, 0.8, 19.2, 0.3, {"adet": 50}),
]

VEGETABLE_FAT_FOODS: list[FoodDefinition] = [
    food("olive_oil", "Zeytinyağı", ["zeytinyagi", "zeytin yagi"], ["olive oil"], "yemek kasigi", 13.5, 884, 0.0, 0.0, 100.0, {"gram": 1, "yemek kasigi": 13.5, "tatli kasigi": 5}),
    food("butter", "Tereyağı", ["tereyagi", "tereyag"], ["butter"], "tatli kasigi", 5, 717, 0.9, 0.1, 81.1, {"gram": 1, "tatli kasigi": 5, "yemek kasigi": 14}),
    food("avocado", "Avokado", ["avokado"], ["avocado"], "adet", 150, 160, 2.0, 8.5, 14.7, {"adet": 150, "yarim": 75}),
    food("almonds", "Badem", ["badem"], ["almonds", "almond"], "avuc", 25, 579, 21.2, 21.6, 49.9, {"gram": 1, "avuc": 25}),
    food("walnuts", "Ceviz", ["ceviz"], ["walnuts", "walnut"], "avuc", 25, 654, 15.2, 13.7, 65.2, {"gram": 1, "avuc": 25}),
    food("hazelnuts", "Fındık", ["findik"], ["hazelnuts", "hazelnut"], "avuc", 25, 628, 15.0, 16.7, 60.8, {"gram": 1, "avuc": 25}),
    food("peanuts", "Yer Fıstığı", ["yer fistigi", "fistik"], ["peanuts", "peanut"], "avuc", 30, 567, 25.8, 16.1, 49.2, {"gram": 1, "avuc": 30}),
    food("peanut_butter", "Fıstık Ezmesi", ["fistik ezmesi"], ["peanut butter"], "yemek kasigi", 16, 588, 25.0, 20.0, 50.0, {"gram": 1, "yemek kasigi": 16}),
    food("mixed_nuts", "Karışık Kuruyemiş", ["karisik kuruyemis", "kuruyemis", "karisik cerez"], ["mixed nuts", "nuts", "trail mix"], "avuc", 30, 607, 20.0, 21.0, 54.0, {"gram": 1, "avuc": 30, "porsiyon": 30}),
    food("tahini", "Tahin", ["tahin"], ["tahini"], "yemek kasigi", 15, 595, 17.0, 21.0, 54.0, {"gram": 1, "yemek kasigi": 15}),
    food("cucumber", "Salatalık", ["salatalik"], ["cucumber"], "adet", 120, 15, 0.7, 3.6, 0.1, {"adet": 120}),
    food("tomato", "Domates", ["domates"], ["tomato"], "adet", 120, 18, 0.9, 3.9, 0.2, {"adet": 120}),
    food("lettuce", "Marul", ["marul", "yesil salata"], ["lettuce"], "kase", 60, 15, 1.4, 2.9, 0.2, {"gram": 1, "kase": 60}),
    food("broccoli", "Brokoli", ["brokoli"], ["broccoli"], "kase", 90, 35, 2.4, 7.2, 0.4, {"gram": 1, "kase": 90}),
    food("spinach_cooked", "Ispanak", ["ispanak", "pisimis ispanak"], ["spinach", "cooked spinach"], "kase", 180, 23, 2.9, 3.8, 0.4, {"gram": 1, "kase": 180}),
    food("onion", "Soğan", ["sogan"], ["onion"], "adet", 110, 40, 1.1, 9.3, 0.1, {"adet": 110}),
    food("bell_pepper", "Biber", ["biber", "kirmizi biber", "yesil biber"], ["bell pepper", "pepper"], "adet", 120, 31, 1.0, 6.0, 0.3, {"adet": 120}),
    food("mushroom", "Mantar", ["mantar"], ["mushroom"], "kase", 70, 22, 3.1, 3.3, 0.3, {"gram": 1, "kase": 70}),
    food("carrot", "Havuç", ["havuc"], ["carrot"], "adet", 60, 41, 0.9, 10.0, 0.2, {"adet": 60}),
    food("zucchini", "Kabak", ["kabak"], ["zucchini"], "adet", 180, 17, 1.2, 3.1, 0.3, {"adet": 180}),
    food("eggplant_grilled", "Izgara Patlıcan", ["izgara patlican", "patlican"], ["grilled eggplant", "eggplant"], "porsiyon", 120, 35, 0.8, 8.7, 0.2, {"gram": 1, "porsiyon": 120}),
    food("cauliflower", "Karnabahar", ["karnabahar"], ["cauliflower"], "kase", 100, 25, 1.9, 5.0, 0.3, {"gram": 1, "kase": 100}),
    food("green_beans", "Taze Fasulye", ["taze fasulye"], ["green beans"], "kase", 150, 31, 1.8, 7.0, 0.1, {"gram": 1, "kase": 150}),
]

COMMON_MEALS: list[FoodDefinition] = [
    food("cacik", "Cacık", ["cacik"], ["tzatziki", "cacik"], "kase", 200, 35, 2.3, 3.4, 1.4, {"gram": 1, "kase": 200}),
    food("menemen", "Menemen", ["menemen"], ["menemen", "turkish scrambled eggs"], "porsiyon", 200, 120, 6.5, 4.0, 8.2, {"gram": 1, "porsiyon": 200, "tabak": 240}),
    food("mercimek_corbasi", "Mercimek Çorbası", ["mercimek corbasi"], ["lentil soup"], "kase", 250, 68, 3.4, 10.5, 1.5, {"gram": 1, "kase": 250}),
    food("tarhana_corbasi", "Tarhana Çorbası", ["tarhana corbasi"], ["tarhana soup"], "kase", 250, 52, 1.6, 8.6, 1.2, {"gram": 1, "kase": 250}),
    food("ezogelin_corbasi", "Ezogelin Çorbası", ["ezogelin corbasi"], ["ezogelin soup"], "kase", 250, 59, 2.1, 10.2, 1.0, {"gram": 1, "kase": 250}),
    food("tavuklu_pilav", "Tavuklu Pilav", ["tavuklu pilav"], ["rice with chicken"], "porsiyon", 250, 173, 8.2, 24.0, 4.5, {"gram": 1, "porsiyon": 250}),
    food("tavuk_sote", "Tavuk Sote", ["tavuk sote"], ["chicken saute"], "porsiyon", 220, 140, 17.0, 4.0, 5.0, {"gram": 1, "porsiyon": 220}),
    food("kuru_fasulye", "Kuru Fasulye", ["kuru fasulye"], ["white bean stew"], "kase", 250, 134, 8.0, 21.0, 2.0, {"gram": 1, "kase": 250}),
    food("nohut_yemegi", "Nohut Yemeği", ["nohut yemegi"], ["chickpea stew"], "kase", 250, 145, 6.5, 20.0, 4.0, {"gram": 1, "kase": 250}),
    food("kisir", "Kısır", ["kisir"], ["kisir", "bulgur salad"], "kase", 170, 170, 4.2, 24.0, 6.8, {"gram": 1, "kase": 170}),
    food("lahmacun", "Lahmacun", ["lahmacun"], ["lahmacun", "turkish pizza"], "adet", 120, 263, 14.0, 30.0, 10.0, {"adet": 120}),
    food("pide_peynir", "Peynirli Pide", ["peynirli pide"], ["cheese pide"], "porsiyon", 160, 280, 12.0, 36.0, 10.0, {"gram": 1, "porsiyon": 160}),
    food("gozleme_peynir", "Peynirli Gözleme", ["peynirli gozleme"], ["cheese gozleme"], "adet", 180, 270, 10.0, 34.0, 11.0, {"adet": 180}),
    food("doner_tavuk", "Tavuk Döner", ["tavuk doner"], ["chicken doner"], "porsiyon", 130, 215, 24.0, 5.0, 11.0, {"gram": 1, "porsiyon": 130}),
    food("doner_et", "Et Döner", ["et doner", "doner"], ["beef doner", "doner"], "porsiyon", 130, 255, 21.0, 6.0, 17.0, {"gram": 1, "porsiyon": 130}),
    food("mercimek_kofte", "Mercimek Köftesi", ["mercimek koftesi"], ["lentil kofte"], "porsiyon", 140, 178, 6.0, 25.0, 6.0, {"gram": 1, "porsiyon": 140}),
    food("borek_peynir", "Peynirli Börek", ["peynirli borek"], ["cheese borek"], "dilim", 100, 330, 10.0, 28.0, 20.0, {"gram": 1, "dilim": 100}),
    food("pogaca_peynir", "Peynirli Poğaça", ["peynirli pogaca", "pogaca"], ["cheese pogaca"], "adet", 70, 365, 10.0, 34.0, 19.0, {"adet": 70}),
    food("protein_pancake", "Protein Pancake", ["protein pancake", "protein pankek"], ["protein pancake"], "porsiyon", 140, 210, 18.0, 19.0, 7.0, {"gram": 1, "porsiyon": 140}),
    food("sutlac", "Sütlaç", ["sutlac"], ["rice pudding"], "kase", 200, 123, 3.0, 22.0, 2.8, {"gram": 1, "kase": 200}),
    food("manti", "Mantı", ["manti"], ["manti", "turkish dumplings"], "porsiyon", 250, 194, 9.0, 24.0, 7.0, {"gram": 1, "porsiyon": 250}),
    food("kuru_kofte_ekmek", "Köfte Ekmek", ["kofte ekmek"], ["meatball sandwich"], "adet", 220, 248, 14.0, 23.0, 12.0, {"adet": 220}),
    food("tost_kasar", "Kaşarlı Tost", ["kasarli tost", "tost"], ["cheese toast", "toast"], "adet", 170, 278, 12.0, 29.0, 12.0, {"adet": 170}),
]


BRANDED_PRODUCT_FOODS: list[FoodDefinition] = [
    food(
        "product_optimum_gold_standard_whey",
        "Optimum Gold Standard Whey",
        ["optimum whey", "optimum gold whey", "optimum gold standard whey", "optimum nutrition whey"],
        ["optimum whey", "gold standard whey", "optimum nutrition whey"],
        "olcek",
        31,
        387,
        77.4,
        9.7,
        3.2,
        {"gram": 1, "olcek": 31, "porsiyon": 31},
        brand="Optimum Nutrition",
        product_name="Gold Standard Whey",
        is_branded_product=True,
    ),
    food(
        "product_optimum_gold_standard_isolate",
        "Optimum Gold Standard Isolate",
        ["optimum isolate", "optimum whey isolate", "optimum gold standard isolate"],
        ["optimum isolate", "optimum whey isolate", "gold standard isolate"],
        "olcek",
        30,
        373,
        83.3,
        3.3,
        1.7,
        {"gram": 1, "olcek": 30, "porsiyon": 30},
        brand="Optimum Nutrition",
        product_name="Gold Standard Isolate",
        is_branded_product=True,
    ),
    food(
        "product_hardline_whey_3matrix",
        "Hardline Whey 3Matrix",
        ["hardline whey", "hardline 3matrix", "hardline whey 3matrix"],
        ["hardline whey", "hardline whey 3matrix"],
        "olcek",
        30,
        393,
        76.7,
        10.0,
        6.0,
        {"gram": 1, "olcek": 30, "porsiyon": 30},
        brand="Hardline",
        product_name="Whey 3Matrix",
        is_branded_product=True,
    ),
    food(
        "product_hardline_isoclear",
        "Hardline Isoclear",
        ["hardline isoclear", "hardline clear whey", "isoclear whey"],
        ["hardline isoclear", "hardline clear whey"],
        "olcek",
        24,
        354,
        83.3,
        4.2,
        0.4,
        {"gram": 1, "olcek": 24, "porsiyon": 24},
        brand="Hardline",
        product_name="Isoclear",
        is_branded_product=True,
    ),
    food(
        "product_myprotein_impact_whey",
        "Myprotein Impact Whey",
        ["myprotein whey", "my protein whey", "impact whey", "myprotein impact whey"],
        ["myprotein whey", "myprotein impact whey", "impact whey protein"],
        "olcek",
        25,
        400,
        80.0,
        8.0,
        6.0,
        {"gram": 1, "olcek": 25, "porsiyon": 25},
        brand="Myprotein",
        product_name="Impact Whey",
        is_branded_product=True,
    ),
    food(
        "product_dymatize_iso100",
        "Dymatize ISO100",
        ["dymatize iso100", "dymatize whey", "iso100 whey"],
        ["dymatize iso100", "iso100 hydrolyzed whey"],
        "olcek",
        30,
        370,
        83.3,
        3.3,
        0.3,
        {"gram": 1, "olcek": 30, "porsiyon": 30},
        brand="Dymatize",
        product_name="ISO100",
        is_branded_product=True,
    ),
    food(
        "product_pinar_protein_sut_cikolatali",
        "Pınar Protein Süt Çikolatalı",
        ["pinar protein sut", "pinar protein sut cikolatali", "proteinli pinar sut"],
        ["pinar protein milk", "pinar protein chocolate milk"],
        "adet",
        500,
        62,
        7.0,
        6.4,
        1.8,
        {"gram": 1, "adet": 500, "bardak": 500},
        brand="Pınar",
        product_name="Protein Süt Çikolatalı",
        is_branded_product=True,
    ),
    food(
        "product_icim_fit_protein_sut",
        "İçim Fit Yüksek Proteinli Süt",
        ["icim protein sut", "icim fit protein sut", "icim vanilyali protein sut"],
        ["icim protein milk", "icim fit high protein milk"],
        "adet",
        500,
        60,
        6.4,
        7.0,
        1.4,
        {"gram": 1, "adet": 500, "bardak": 500},
        brand="İçim Fit",
        product_name="Yüksek Proteinli Süt",
        is_branded_product=True,
    ),
    food(
        "product_alpro_protein_pudding",
        "Alpro Protein Pudding",
        ["alpro protein pudding", "alpro pudding", "alpro cikolatali protein pudding"],
        ["alpro protein pudding", "alpro chocolate protein pudding"],
        "adet",
        200,
        76,
        10.0,
        9.5,
        2.5,
        {"gram": 1, "adet": 200},
        brand="Alpro",
        product_name="Protein Pudding",
        is_branded_product=True,
    ),
]


class FoodCatalog:
    def __init__(self) -> None:
        self._foods = FOOD_DATABASE
        self._by_id = {food.canonical_id: food for food in self._foods}
        self._aliases = self._build_aliases()
        self._graph = self._build_food_graph()
        self._base_food_aliases = self._build_base_food_aliases()
        self._products = [food for food in self._foods if food.is_branded_product]
        self._brand_tokens = self._build_brand_tokens()
        self._canonical_overrides = {
            phrase: self._by_id[canonical_id]
            for phrase, canonical_id in EXACT_SYNONYM_CANONICAL_IDS.items()
            if canonical_id in self._by_id
        }
        self._soft_canonical_overrides = {
            phrase: self._by_id[canonical_id]
            for phrase, canonical_id in SOFT_SYNONYM_CANONICAL_IDS.items()
            if canonical_id in self._by_id
        }

    def get_food(self, canonical_id: str) -> FoodDefinition | None:
        return self._by_id.get(canonical_id)

    def get_related_foods(self, canonical_id: str) -> list[FoodDefinition]:
        food = self.get_food(canonical_id)
        if food is None:
            return []
        related_ids = food.related_foods or []
        return [self._by_id[item_id] for item_id in related_ids if item_id in self._by_id]

    def detect_food_graph_context(self, text: str) -> FoodGraphContext:
        normalized = normalize_food_text(text)
        detected_tokens = normalized.split()
        cooking_method = self._detect_cooking_method(detected_tokens)
        base_food = self._detect_base_food(normalized, detected_tokens)
        related_foods = [food.canonical_id for food in self._graph.get(base_food, [])] if base_food else []
        return FoodGraphContext(
            normalized_query=normalized,
            detected_tokens=detected_tokens,
            base_food=base_food,
            cooking_method=cooking_method,
            related_foods=related_foods,
        )

    def match_food(self, text: str) -> FoodMatch | None:
        normalized = normalize_food_text(text)
        if not normalized:
            return None

        graph_context = self.detect_food_graph_context(text)
        graph_match = self._match_food_from_graph(graph_context)
        if graph_match is not None:
            return graph_match

        canonical_override = self._canonical_overrides.get(normalized)
        if canonical_override is not None:
            return FoodMatch(
                food=canonical_override,
                matched_alias=normalized,
                score=0.94,
                is_exact=True,
                is_generic=normalized in GENERIC_ALIASES,
            )

        soft_override = self._soft_canonical_overrides.get(normalized)
        if soft_override is not None:
            return FoodMatch(
                food=soft_override,
                matched_alias=normalized,
                score=0.7,
                is_exact=False,
                is_generic=False,
            )

        ranked = self._rank_food_matches(normalized, limit=1, min_score=0.5)
        return ranked[0] if ranked else None

    def closest_food_matches(self, text: str, limit: int = 3) -> list[FoodMatch]:
        normalized = normalize_food_text(text)
        if not normalized:
            return []
        graph_context = self.detect_food_graph_context(text)
        graph_matches = self._closest_food_matches_from_graph(graph_context, limit=limit)
        if graph_matches:
            return graph_matches
        return self._rank_food_matches(normalized, limit=limit, min_score=0.34)

    def _rank_food_matches(self, normalized: str, limit: int, min_score: float) -> list[FoodMatch]:
        text_tokens = normalized.split()
        token_set = set(text_tokens)
        contains_brand_hint = bool(token_set.intersection(self._brand_tokens))
        cooking_methods = {COOKING_METHOD_ALIASES[token] for token in text_tokens if token in COOKING_METHOD_ALIASES}
        explicit_phrase = len(text_tokens) >= 2
        ambiguous_ids = AMBIGUOUS_QUERY_CANONICAL_IDS.get(normalized, [])

        best_by_id: dict[str, FoodMatch] = {}

        for alias, food_definition in self._aliases:
            base_score, is_exact = self._score_alias_match(normalized, alias)
            if base_score < min_score:
                continue

            score = base_score
            score += self._modifier_context_bonus(
                query_tokens=token_set,
                cooking_methods=cooking_methods,
                food_definition=food_definition,
                alias=alias,
            )
            score -= self._modifier_mismatch_penalty(
                query_tokens=token_set,
                cooking_methods=cooking_methods,
                food_definition=food_definition,
                alias=alias,
            )

            if is_exact and explicit_phrase:
                score += 0.12
            elif alias in normalized and len(alias.split()) >= 2:
                score += 0.06

            if contains_brand_hint and alias in GENERIC_ALIASES and not food_definition.is_branded_product:
                score -= 0.22
            if food_definition.is_branded_product:
                score += 0.05
                if contains_brand_hint:
                    brand_tokens = set(normalize_food_text(food_definition.brand or "").split())
                    product_tokens = set(normalize_food_text(food_definition.product_name or "").split())
                    brand_overlap = len(token_set.intersection(brand_tokens))
                    product_overlap = len(token_set.intersection(product_tokens))
                    if brand_overlap:
                        score += min(0.18, 0.1 + brand_overlap * 0.04)
                    if product_overlap:
                        score += min(0.12, product_overlap * 0.03)

            is_generic = alias in GENERIC_ALIASES
            if is_exact and is_generic and not explicit_phrase:
                score -= 0.18
            if ambiguous_ids and food_definition.canonical_id in ambiguous_ids:
                preferred_index = ambiguous_ids.index(food_definition.canonical_id)
                score += max(0.0, 0.16 - preferred_index * 0.03)
                if food_definition.canonical_id == "corn_boiled":
                    score -= 0.06

            score = round(max(0.0, min(score, 0.99)), 4)
            if score < min_score:
                continue

            candidate = FoodMatch(
                food=food_definition,
                matched_alias=alias,
                score=score,
                is_exact=is_exact,
                is_generic=is_generic,
            )
            existing = best_by_id.get(food_definition.canonical_id)
            if existing is None or self._is_better_candidate(candidate, existing):
                best_by_id[food_definition.canonical_id] = candidate

        branded_hint_match = self._match_branded_product_from_query(normalized) if contains_brand_hint else None
        if branded_hint_match is not None:
            existing = best_by_id.get(branded_hint_match.food.canonical_id)
            if existing is None or self._is_better_candidate(branded_hint_match, existing):
                best_by_id[branded_hint_match.food.canonical_id] = branded_hint_match

        ranked = list(best_by_id.values())

        ranked.sort(
            key=lambda item: (
                item.score,
                item.is_exact,
                len(item.matched_alias),
                not item.food.is_branded_product,
                item.food.display_name_tr,
            ),
            reverse=True,
        )
        return ranked[:limit]

    def _is_better_candidate(self, candidate: FoodMatch, existing: FoodMatch) -> bool:
        if candidate.score != existing.score:
            return candidate.score > existing.score
        if candidate.is_exact != existing.is_exact:
            return candidate.is_exact and not existing.is_exact
        if candidate.food.is_branded_product != existing.food.is_branded_product:
            return candidate.food.is_branded_product and not existing.food.is_branded_product
        return len(candidate.matched_alias) > len(existing.matched_alias)

    def _match_branded_product_from_query(self, normalized_query: str) -> FoodMatch | None:
        candidates = self.search_products(query=normalized_query, limit=3)
        best_match: FoodMatch | None = None
        for product in candidates:
            candidate_texts = [
                normalize_food_text(product.display_name_tr),
                normalize_food_text(product.brand or ""),
                normalize_food_text(product.product_name or ""),
                *(normalize_food_text(alias) for alias in product.aliases_tr),
                *(normalize_food_text(alias) for alias in product.aliases_en),
            ]
            score = max((self._search_score(normalized_query, text) for text in candidate_texts if text), default=0.0)
            if score < 0.6:
                continue

            candidate = FoodMatch(
                food=product,
                matched_alias=normalize_food_text(product.display_name_tr),
                score=min(0.99, score + 0.12),
                is_exact=normalized_query == normalize_food_text(product.display_name_tr),
                is_generic=False,
            )
            if best_match is None or candidate.score > best_match.score:
                best_match = candidate
        return best_match

    def search_products(
        self,
        query: str = "",
        brand: str | None = None,
        limit: int = 10,
    ) -> list[FoodDefinition]:
        normalized_query = normalize_food_text(query)
        normalized_brand = normalize_food_text(brand or "")
        ranked: list[tuple[float, FoodDefinition]] = []

        for product in self._products:
            if normalized_brand:
                brand_text = normalize_food_text(product.brand or "")
                if normalized_brand not in brand_text:
                    continue

            if not normalized_query:
                score = 0.6
            else:
                candidate_texts = [
                    normalize_food_text(product.display_name_tr),
                    normalize_food_text(product.brand or ""),
                    *(normalize_food_text(alias) for alias in product.aliases_tr),
                    *(normalize_food_text(alias) for alias in product.aliases_en),
                ]
                score = max((self._search_score(normalized_query, text) for text in candidate_texts if text), default=0.0)
                if score < 0.45:
                    continue

            ranked.append((score, product))

        ranked.sort(key=lambda item: (item[0], item[1].brand or "", item[1].display_name_tr), reverse=True)
        return [product for _, product in ranked[:limit]]

    def suggest_foods(self, text: str, limit: int = 3) -> list[str]:
        return [match.food.display_name_tr for match in self.closest_food_matches(text, limit=limit)]

    def _build_food_graph(self) -> dict[str, list[FoodDefinition]]:
        graph: dict[str, list[FoodDefinition]] = {}
        for food_definition in self._foods:
            if not food_definition.base_food:
                continue
            graph.setdefault(food_definition.base_food, []).append(food_definition)
        return graph

    def _build_base_food_aliases(self) -> list[tuple[str, str]]:
        aliases: list[tuple[str, str]] = []
        for base_food, alias_values in BASE_FOOD_ALIASES.items():
            for alias in alias_values:
                normalized = normalize_food_text(alias)
                if normalized:
                    aliases.append((normalized, base_food))
        aliases.sort(key=lambda item: len(item[0]), reverse=True)
        return aliases

    def _detect_cooking_method(self, detected_tokens: list[str]) -> str | None:
        for token in detected_tokens:
            if token in COOKING_METHOD_ALIASES:
                return COOKING_METHOD_ALIASES[token]
        return None

    def _detect_base_food(self, normalized: str, detected_tokens: list[str]) -> str | None:
        for alias, base_food in self._base_food_aliases:
            if normalized == alias or alias in normalized:
                return base_food

        best_base_food: str | None = None
        best_score = 0.0
        for alias, base_food in self._base_food_aliases:
            ratio = SequenceMatcher(None, normalized, alias).ratio()
            if ratio > best_score and ratio >= 0.76:
                best_score = ratio
                best_base_food = base_food

        if best_base_food is not None:
            return best_base_food

        for token in detected_tokens:
            for alias, base_food in self._base_food_aliases:
                if SequenceMatcher(None, token, alias).ratio() >= 0.82:
                    return base_food
        return None

    def _match_food_from_graph(self, graph_context: FoodGraphContext) -> FoodMatch | None:
        if not graph_context.base_food:
            return None

        candidates = self._graph.get(graph_context.base_food, [])
        if not candidates:
            return None

        best_match: FoodMatch | None = None
        query_tokens = set(graph_context.detected_tokens)
        for food_definition in candidates:
            candidate_texts = [
                normalize_food_text(food_definition.display_name_tr),
                *(normalize_food_text(alias) for alias in food_definition.aliases_tr),
                *(normalize_food_text(alias) for alias in food_definition.aliases_en),
            ]
            score = max(
                (self._search_score(graph_context.normalized_query, text) for text in candidate_texts if text),
                default=0.0,
            )
            if food_definition.base_food == graph_context.base_food:
                score += 0.16
            if graph_context.cooking_method and food_definition.cooking_method == graph_context.cooking_method:
                score += 0.24
            elif graph_context.cooking_method and food_definition.cooking_method not in {None, graph_context.cooking_method}:
                score -= 0.28
            elif not graph_context.cooking_method:
                if food_definition.cooking_method == "pilaf" and not query_tokens.intersection({"pilav", "pilaf"}):
                    score -= 0.2
                if food_definition.cooking_method in {"boiled", "cooked"} and query_tokens.intersection(
                    {"pirinc", "rice", "jasmine", "jasmin", "basmati"}
                ):
                    score += 0.14
                if food_definition.cooking_method == "raw" and not query_tokens.intersection({"cig", "raw"}):
                    score -= 0.18
            if food_definition.cooking_method is None and graph_context.normalized_query == graph_context.base_food:
                score += 0.18
            is_exact = graph_context.normalized_query in candidate_texts
            if is_exact:
                score += 0.08
            score = max(0.0, min(score, 0.99))
            if score < 0.56:
                continue

            candidate = FoodMatch(
                food=food_definition,
                matched_alias=normalize_food_text(food_definition.display_name_tr),
                score=round(score, 4),
                is_exact=is_exact,
                is_generic=normalize_food_text(food_definition.display_name_tr) == graph_context.base_food,
            )
            if best_match is None or self._is_better_candidate(candidate, best_match):
                best_match = candidate
        return best_match

    def _closest_food_matches_from_graph(self, graph_context: FoodGraphContext, limit: int) -> list[FoodMatch]:
        if not graph_context.base_food:
            return []
        candidates: list[FoodMatch] = []
        query_tokens = set(graph_context.detected_tokens)
        for food_definition in self._graph.get(graph_context.base_food, []):
            candidate = self._match_food_from_graph(
                FoodGraphContext(
                    normalized_query=graph_context.normalized_query,
                    detected_tokens=graph_context.detected_tokens,
                    base_food=graph_context.base_food,
                    cooking_method=graph_context.cooking_method,
                    related_foods=graph_context.related_foods,
                )
            )
            if candidate is not None and candidate.food.canonical_id == food_definition.canonical_id:
                candidates.append(candidate)
            else:
                candidate_texts = [
                    normalize_food_text(food_definition.display_name_tr),
                    *(normalize_food_text(alias) for alias in food_definition.aliases_tr),
                    *(normalize_food_text(alias) for alias in food_definition.aliases_en),
                ]
                score = max(
                    (self._search_score(graph_context.normalized_query, text) for text in candidate_texts if text),
                    default=0.0,
                )
                if food_definition.base_food == graph_context.base_food:
                    score += 0.12
                if graph_context.cooking_method and food_definition.cooking_method == graph_context.cooking_method:
                    score += 0.18
                elif graph_context.cooking_method and food_definition.cooking_method not in {None, graph_context.cooking_method}:
                    score -= 0.22
                elif not graph_context.cooking_method:
                    if food_definition.cooking_method == "pilaf" and not query_tokens.intersection({"pilav", "pilaf"}):
                        score -= 0.18
                    if food_definition.cooking_method in {"boiled", "cooked"} and query_tokens.intersection(
                        {"pirinc", "rice", "jasmine", "jasmin", "basmati"}
                    ):
                        score += 0.12
                    if food_definition.cooking_method == "raw" and not query_tokens.intersection({"cig", "raw"}):
                        score -= 0.16
                score = max(0.0, min(score, 0.99))
                if score < 0.34:
                    continue
                candidates.append(
                    FoodMatch(
                        food=food_definition,
                        matched_alias=normalize_food_text(food_definition.display_name_tr),
                        score=round(score, 4),
                        is_exact=graph_context.normalized_query in candidate_texts,
                        is_generic=normalize_food_text(food_definition.display_name_tr) == graph_context.base_food,
                    )
                )
        deduped: dict[str, FoodMatch] = {}
        for candidate in candidates:
            existing = deduped.get(candidate.food.canonical_id)
            if existing is None or self._is_better_candidate(candidate, existing):
                deduped[candidate.food.canonical_id] = candidate
        ranked = list(deduped.values())
        ranked.sort(
            key=lambda item: (item.score, item.is_exact, len(item.matched_alias), item.food.display_name_tr),
            reverse=True,
        )
        return ranked[:limit]

    def _build_aliases(self) -> list[tuple[str, FoodDefinition]]:
        aliases: list[tuple[str, FoodDefinition]] = []
        for food_definition in self._foods:
            for alias in [food_definition.display_name_tr, *food_definition.aliases_tr, *food_definition.aliases_en]:
                normalized = normalize_food_text(alias)
                if normalized:
                    aliases.append((normalized, food_definition))
        aliases.sort(key=lambda item: len(item[0]), reverse=True)
        return aliases

    def _build_brand_tokens(self) -> set[str]:
        tokens: set[str] = set()
        for product in self._products:
            for piece in [product.brand or "", *product.aliases_tr, *product.aliases_en]:
                normalized = normalize_food_text(piece)
                for token in normalized.split():
                    if len(token) >= 3:
                        tokens.add(token)
        return tokens

    def _search_score(self, query: str, candidate: str) -> float:
        if not query or not candidate:
            return 0.0
        if query == candidate:
            return 0.99
        if candidate.startswith(query):
            return 0.92
        if query in candidate:
            return 0.78

        query_tokens = set(query.split())
        candidate_tokens = set(candidate.split())
        overlap = len(query_tokens.intersection(candidate_tokens))
        if overlap:
            return 0.58 + min(0.22, overlap * 0.12)
        ratio = SequenceMatcher(None, query, candidate).ratio()
        if ratio >= 0.78:
            return min(0.74, ratio * 0.82)
        return 0.0

    def _modifier_context_bonus(
        self,
        *,
        query_tokens: set[str],
        cooking_methods: set[str],
        food_definition: FoodDefinition,
        alias: str,
    ) -> float:
        bonus = 0.0
        food_context = FOOD_CONTEXT_KEYWORDS.get(food_definition.canonical_id, set())
        alias_tokens = set(alias.split())

        if cooking_methods and food_context.intersection(cooking_methods):
            bonus += 0.18
        if query_tokens.intersection(food_context):
            bonus += min(0.12, len(query_tokens.intersection(food_context)) * 0.04)
        if cooking_methods and alias_tokens.intersection(cooking_methods):
            bonus += 0.08
        return bonus

    def _modifier_mismatch_penalty(
        self,
        *,
        query_tokens: set[str],
        cooking_methods: set[str],
        food_definition: FoodDefinition,
        alias: str,
    ) -> float:
        penalty = 0.0
        food_context = FOOD_CONTEXT_KEYWORDS.get(food_definition.canonical_id, set())
        alias_tokens = set(alias.split())

        if "popcorn" in cooking_methods and "popcorn" not in food_context and "popcorn" not in alias_tokens:
            penalty += 0.42
        if "boiled" in cooking_methods and "boiled" not in food_context and "boiled" not in alias_tokens:
            penalty += 0.24
        if "fried" in cooking_methods and "fried" not in food_context and "fried" not in alias_tokens:
            penalty += 0.2
        if "roasted" in cooking_methods and "roasted" not in food_context and "roasted" not in alias_tokens:
            penalty += 0.2
        if "grilled" in cooking_methods and "grilled" not in food_context and "grilled" not in alias_tokens:
            penalty += 0.16
        if "smoked" in cooking_methods and "smoked" not in food_context and "smoked" not in alias_tokens:
            penalty += 0.22
        if query_tokens == {"misir"} and food_definition.canonical_id == "corn_boiled":
            penalty += 0.1

        method_tokens = set(COOKING_METHOD_ALIASES.keys()) | set(COOKING_METHOD_ALIASES.values())
        query_core_tokens = {token for token in query_tokens if token not in method_tokens}
        alias_core_tokens = {token for token in alias_tokens if token not in method_tokens}
        if query_core_tokens and alias_core_tokens and not query_core_tokens.intersection(alias_core_tokens):
            penalty += 0.26
        return penalty

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

        if overlap:
            fuzzy_bonus = self._token_fuzzy_overlap(text_tokens, alias_tokens)
            score = 0.54 + min(0.18, overlap * 0.08) + fuzzy_bonus
            return min(0.86, score), False

        ratio = SequenceMatcher(None, normalized_text, alias).ratio()
        if ratio >= 0.8:
            return min(0.83, 0.48 + ratio * 0.35), False
        fuzzy_overlap = self._token_fuzzy_overlap(text_tokens, alias_tokens)
        if ratio >= 0.72 and fuzzy_overlap >= 0.08:
            return min(0.78, 0.42 + ratio * 0.32), False
        if fuzzy_overlap >= 0.1:
            return min(0.72, 0.42 + fuzzy_overlap * 2.1), False
        if fuzzy_overlap >= 0.06 and len(text_tokens) >= 2:
            return min(0.62, 0.36 + fuzzy_overlap * 2.2), False

        return 0.0, False

    def _token_fuzzy_overlap(self, query_tokens: list[str], alias_tokens: list[str]) -> float:
        if not query_tokens or not alias_tokens:
            return 0.0

        total = 0.0
        for query_token in query_tokens:
            best_ratio = max((SequenceMatcher(None, query_token, alias_token).ratio() for alias_token in alias_tokens), default=0.0)
            if best_ratio >= 0.86:
                total += 0.1
            elif best_ratio >= 0.78:
                total += 0.06
            elif best_ratio >= 0.72:
                total += 0.03
        return min(0.18, total)


FOOD_DATABASE = [
    *BRANDED_PRODUCT_FOODS,
    *PROTEIN_FOODS,
    *DAIRY_AND_SUPPLEMENTS,
    *CARB_AND_GRAIN_FOODS,
    *LEGUME_FOODS,
    *FRUIT_FOODS,
    *VEGETABLE_FAT_FOODS,
    *COMMON_MEALS,
]
