from fastapi import APIRouter, HTTPException, Query

from app.core.dependencies import (
    get_food_catalog,
    get_nutrition_calculation_service,
    get_nutrition_parser_service,
    get_nutrition_suggestion_service,
)
from app.schemas.nutrition import (
    FoodReference,
    NutritionSuggestResponse,
    NutritionCalculateRequest,
    NutritionCalculateResponse,
    NutritionParseRequest,
    NutritionParseResponse,
    ProductSearchResponse,
)


router = APIRouter(prefix="/nutrition", tags=["nutrition"])
nutrition_parser_service = get_nutrition_parser_service()
nutrition_calculation_service = get_nutrition_calculation_service()
nutrition_suggestion_service = get_nutrition_suggestion_service()
food_catalog = get_food_catalog()


@router.get("/suggest", response_model=NutritionSuggestResponse)
async def suggest_foods(
    q: str = Query(..., min_length=1),
    user_id: str | None = Query(default=None),
) -> NutritionSuggestResponse:
    return await nutrition_suggestion_service.suggest(query=q, user_id=user_id)


@router.get("/products/search", response_model=ProductSearchResponse)
async def search_products(
    q: str = Query(default=""),
    brand: str | None = Query(default=None),
) -> ProductSearchResponse:
    products = [
        FoodReference(
            canonical_id=item.canonical_id,
            display_name_tr=item.display_name_tr,
            default_unit=item.default_unit,
            standard_unit_weight_g=item.standard_unit_weight_g,
            brand=item.brand,
            product_name=item.product_name,
            is_branded_product=item.is_branded_product,
        )
        for item in food_catalog.search_products(query=q, brand=brand, limit=12)
    ]
    return ProductSearchResponse(query=q, brand=brand, products=products)


@router.post("/parse", response_model=NutritionParseResponse)
async def parse_nutrition_text(payload: NutritionParseRequest) -> NutritionParseResponse:
    return await nutrition_parser_service.parse_text(payload.text, payload.user_id)


@router.post("/calculate", response_model=NutritionCalculateResponse)
async def calculate_nutrition(payload: NutritionCalculateRequest) -> NutritionCalculateResponse:
    try:
        return nutrition_calculation_service.calculate(payload.items)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
