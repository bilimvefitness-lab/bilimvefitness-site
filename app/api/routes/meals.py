from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.core.dependencies import (
    get_daily_action_service,
    get_meal_logging_service,
    get_quick_add_service,
)
from app.schemas.nutrition import (
    DailyActionResponse,
    DailyActionTrackRequest,
    DailyActionTrackResponse,
    DailyCoachResponse,
    DailySummaryResponse,
    FavoriteFoodRequest,
    FavoriteMealRequest,
    MealEntry,
    MealSaveRequest,
    PrimeCoachMode,
    QuickAddFood,
    QuickAddMeal,
    QuickAddResponse,
)


router = APIRouter(prefix="/meals", tags=["meals"])
meal_logging_service = get_meal_logging_service()
quick_add_service = get_quick_add_service()
daily_action_service = get_daily_action_service()


@router.post("/save", response_model=MealEntry)
async def save_meal(payload: MealSaveRequest) -> MealEntry:
    try:
        return await meal_logging_service.save_meal(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/daily-summary", response_model=DailySummaryResponse)
async def get_daily_summary(
    date: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
) -> DailySummaryResponse:
    resolved_date = date or datetime.now(timezone.utc).date().isoformat()
    return await meal_logging_service.get_daily_summary(resolved_date, user_id)


@router.get("/daily-coach", response_model=DailyCoachResponse)
async def get_daily_coach(
    protein_target_g: float = Query(..., gt=0),
    calorie_target_kcal: float = Query(..., gt=0),
    date: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
    mode: PrimeCoachMode = Query(default="balanced"),
) -> DailyCoachResponse:
    resolved_date = date or datetime.now(timezone.utc).date().isoformat()
    return await meal_logging_service.get_daily_coach(
        date=resolved_date,
        protein_target_g=protein_target_g,
        calorie_target_kcal=calorie_target_kcal,
        user_id=user_id,
        mode=mode,
    )


@router.get("/daily-actions", response_model=DailyActionResponse)
async def get_daily_actions(
    protein_target_g: float = Query(..., gt=0),
    calorie_target_kcal: float = Query(..., gt=0),
    date: str | None = Query(default=None),
    user_id: str | None = Query(default=None),
) -> DailyActionResponse:
    resolved_date = date or datetime.now(timezone.utc).date().isoformat()
    return await daily_action_service.build_daily_action(
        date=resolved_date,
        protein_target_g=protein_target_g,
        calorie_target_kcal=calorie_target_kcal,
        user_id=user_id,
    )


@router.post("/daily-actions/track", response_model=DailyActionTrackResponse)
async def track_daily_action(payload: DailyActionTrackRequest) -> DailyActionTrackResponse:
    try:
        return await daily_action_service.track_action(payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/quick-add", response_model=QuickAddResponse)
async def get_quick_adds(user_id: str = Query(..., min_length=1)) -> QuickAddResponse:
    return await quick_add_service.get_quick_adds(user_id)


@router.post("/quick-add/favorite-food", response_model=QuickAddFood)
async def save_favorite_food(payload: FavoriteFoodRequest) -> QuickAddFood:
    return await quick_add_service.save_favorite_food(payload)


@router.post("/quick-add/favorite-meal", response_model=QuickAddMeal)
async def save_favorite_meal(payload: FavoriteMealRequest) -> QuickAddMeal:
    return await quick_add_service.save_favorite_meal(payload)
