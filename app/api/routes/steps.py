import logging
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.core.dependencies import get_step_engagement_service, get_step_service, get_step_social_service
from app.schemas.steps import (
    StepDailyResponse,
    StepEngagementRecord,
    StepEngagementSyncRequest,
    StepLeaderboardResponse,
    StepRangeResponse,
    StepSyncRequest,
    StepSyncResponse,
)


router = APIRouter(prefix="/steps", tags=["steps"])
logger = logging.getLogger(__name__)
step_service = get_step_service()
step_engagement_service = get_step_engagement_service()
step_social_service = get_step_social_service()


@router.post("/sync", response_model=StepSyncResponse)
async def sync_steps(payload: StepSyncRequest) -> StepSyncResponse:
    try:
        response = await step_service.sync_records(payload.user_id, payload.records)
        try:
            await step_social_service.process_step_sync(
                payload.user_id,
                [item.date for item in payload.records],
            )
        except Exception as exc:  # pragma: no cover - side effect should not block sync
            logger.warning("step social sync side-effect failed user_id=%s error=%s", payload.user_id, exc)
        return response
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/daily", response_model=StepDailyResponse)
async def get_daily_steps(
    user_id: str = Query(..., min_length=1),
    date: str | None = Query(default=None),
) -> StepDailyResponse:
    resolved_date = date or datetime.now(timezone.utc).date().isoformat()
    return await step_service.get_daily(user_id, resolved_date)


@router.get("/range", response_model=StepRangeResponse)
async def get_step_range(
    user_id: str = Query(..., min_length=1),
    start_date: str = Query(..., min_length=10),
    end_date: str = Query(..., min_length=10),
) -> StepRangeResponse:
    try:
        return await step_service.get_range(user_id, start_date, end_date)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/engagement/sync", response_model=StepEngagementRecord)
async def sync_step_engagement(payload: StepEngagementSyncRequest) -> StepEngagementRecord:
    return await step_engagement_service.sync_snapshot(payload.user_id, payload.snapshot)


@router.get("/leaderboard/daily", response_model=StepLeaderboardResponse)
async def get_daily_step_leaderboard(
    user_id: str = Query(..., min_length=1),
    date: str | None = Query(default=None),
    limit: int = Query(default=5, ge=1, le=20),
) -> StepLeaderboardResponse:
    resolved_date = date or datetime.now(timezone.utc).date().isoformat()
    return await step_service.get_daily_leaderboard(
        user_id=user_id,
        record_date=resolved_date,
        limit=limit,
    )
