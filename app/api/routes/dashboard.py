from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, HTTPException, Query

from app.core.dependencies import get_daily_command_service
from app.schemas.dashboard import DailyCommandResponse


router = APIRouter(prefix="/dashboard", tags=["dashboard"])
daily_command_service = get_daily_command_service()
try:
    DASHBOARD_ROUTE_TZ = ZoneInfo("Europe/Istanbul")
except ZoneInfoNotFoundError:
    DASHBOARD_ROUTE_TZ = timezone(timedelta(hours=3))


def _default_dashboard_date() -> str:
    return datetime.now(DASHBOARD_ROUTE_TZ).date().isoformat()


@router.get("/daily-command", response_model=DailyCommandResponse)
async def get_daily_command(
    user_id: str = Query(..., min_length=1),
    date: str | None = Query(default=None),
    protein_target_g: float | None = Query(default=None, gt=0),
    calorie_target_kcal: float | None = Query(default=None, gt=0),
) -> DailyCommandResponse:
    try:
        return await daily_command_service.build_daily_command(
            user_id=user_id,
            date=date or _default_dashboard_date(),
            protein_target_g=protein_target_g,
            calorie_target_kcal=calorie_target_kcal,
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
