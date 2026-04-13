from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.core.dependencies import get_sleep_service
from app.schemas.sleep import SleepDailyResponse, SleepRangeResponse, SleepSyncRequest, SleepSyncResponse


router = APIRouter(prefix="/sleep", tags=["sleep"])
sleep_service = get_sleep_service()


@router.post("/sync", response_model=SleepSyncResponse)
async def sync_sleep(payload: SleepSyncRequest) -> SleepSyncResponse:
    try:
        return await sleep_service.sync_daily_summaries(payload.user_id, payload.summaries)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/daily", response_model=SleepDailyResponse)
async def get_daily_sleep(
    user_id: str = Query(..., min_length=1),
    sleep_day: str | None = Query(default=None),
) -> SleepDailyResponse:
    resolved_day = sleep_day or datetime.now(timezone.utc).date().isoformat()
    return await sleep_service.get_daily(user_id, resolved_day)


@router.get("/range", response_model=SleepRangeResponse)
async def get_sleep_range(
    user_id: str = Query(..., min_length=1),
    start_day: str = Query(..., min_length=10),
    end_day: str = Query(..., min_length=10),
) -> SleepRangeResponse:
    try:
        return await sleep_service.get_range(user_id, start_day, end_day)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
