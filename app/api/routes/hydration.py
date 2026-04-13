from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException, Query

from app.core.dependencies import get_hydration_service
from app.schemas.hydration import (
    DailyHydrationSummary,
    DeleteWaterLogResponse,
    HydrationLogListResponse,
    HydrationLogResponse,
    HydrationReminderSettingsPayload,
    HydrationReminderSettingsResponse,
    TrainingIntensity,
    UserHydrationProfilePayload,
    UserHydrationProfileResponse,
    WaterLogRequest,
    WeeklyHydrationStatsResponse,
)


router = APIRouter(prefix="/hydration", tags=["hydration"])
hydration_service = get_hydration_service()
try:
    HYDRATION_ROUTE_TZ = ZoneInfo("Europe/Istanbul")
except ZoneInfoNotFoundError:
    HYDRATION_ROUTE_TZ = timezone(timedelta(hours=3))


def _default_hydration_date() -> str:
    return datetime.now(HYDRATION_ROUTE_TZ).date().isoformat()


@router.get("/profile", response_model=UserHydrationProfileResponse)
async def get_hydration_profile(user_id: str = Query(..., min_length=1)) -> UserHydrationProfileResponse:
    try:
        return await hydration_service.get_profile_response(user_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.post("/profile", response_model=UserHydrationProfileResponse)
async def upsert_hydration_profile(payload: UserHydrationProfilePayload) -> UserHydrationProfileResponse:
    try:
        return await hydration_service.save_profile(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/reminder-settings", response_model=HydrationReminderSettingsResponse)
async def get_hydration_reminder_settings(
    user_id: str = Query(..., min_length=1),
) -> HydrationReminderSettingsResponse:
    return await hydration_service.get_reminder_settings(user_id)


@router.post("/reminder-settings", response_model=HydrationReminderSettingsResponse)
async def upsert_hydration_reminder_settings(
    payload: HydrationReminderSettingsPayload,
) -> HydrationReminderSettingsResponse:
    try:
        return await hydration_service.save_reminder_settings(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/daily-summary", response_model=DailyHydrationSummary)
async def get_hydration_daily_summary(
    user_id: str = Query(..., min_length=1),
    date: str | None = Query(default=None),
    exercise_day: bool = Query(default=False),
    training_intensity: TrainingIntensity | None = Query(default=None),
) -> DailyHydrationSummary:
    resolved_date = date or _default_hydration_date()
    try:
        return await hydration_service.get_daily_summary(
            user_id=user_id,
            date=resolved_date,
            exercise_day=exercise_day,
            training_intensity=training_intensity,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.get("/logs", response_model=HydrationLogListResponse)
async def get_hydration_logs(
    user_id: str = Query(..., min_length=1),
    date: str | None = Query(default=None),
) -> HydrationLogListResponse:
    resolved_date = date or _default_hydration_date()
    return await hydration_service.get_logs(user_id=user_id, date=resolved_date)


@router.get("/weekly-stats", response_model=WeeklyHydrationStatsResponse)
async def get_hydration_weekly_stats(
    user_id: str = Query(..., min_length=1),
    end_date: str | None = Query(default=None),
) -> WeeklyHydrationStatsResponse:
    resolved_end_date = end_date or _default_hydration_date()
    try:
        return await hydration_service.get_weekly_stats(user_id=user_id, end_date=resolved_end_date)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/log", response_model=HydrationLogResponse)
async def create_hydration_log(payload: WaterLogRequest) -> HydrationLogResponse:
    try:
        return await hydration_service.log_water(payload)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@router.delete("/log/{log_id}", response_model=DeleteWaterLogResponse)
async def delete_hydration_log(
    log_id: str,
    user_id: str = Query(..., min_length=1),
) -> DeleteWaterLogResponse:
    return await hydration_service.delete_log(user_id=user_id, log_id=log_id)
