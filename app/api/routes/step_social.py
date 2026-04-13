from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.core.dependencies import get_step_social_service
from app.schemas.step_social import (
    SocialChallengeRecord,
    SocialChallengeSyncRequest,
    SocialDuelCreateRequest,
    SocialDuelRecord,
    SocialEventCenterResponse,
    SocialGroup,
    SocialGroupCreateRequest,
    SocialGroupJoinRequest,
    SocialOverviewResponse,
    SocialPushTokenRegisterRequest,
)


router = APIRouter(prefix="/social", tags=["step-social"])
step_social_service = get_step_social_service()


@router.post("/groups", response_model=SocialGroup)
async def create_social_group(payload: SocialGroupCreateRequest) -> SocialGroup:
    try:
        return await step_social_service.create_group(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/groups/join", response_model=SocialGroup)
async def join_social_group(payload: SocialGroupJoinRequest) -> SocialGroup:
    try:
        return await step_social_service.join_group(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/challenges/sync", response_model=list[SocialChallengeRecord])
async def sync_social_challenges(payload: SocialChallengeSyncRequest) -> list[SocialChallengeRecord]:
    return await step_social_service.sync_challenges(payload.user_id, payload.challenges)


@router.post("/push/register")
async def register_social_push_token(payload: SocialPushTokenRegisterRequest) -> dict[str, str | bool]:
    return await step_social_service.register_push_token(payload)


@router.post("/duels", response_model=SocialDuelRecord)
async def create_social_duel(payload: SocialDuelCreateRequest) -> SocialDuelRecord:
    try:
        return await step_social_service.start_duel(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/overview", response_model=SocialOverviewResponse)
async def get_social_overview(
    user_id: str = Query(..., min_length=1),
    date: str | None = Query(default=None),
) -> SocialOverviewResponse:
    resolved_date = date or datetime.now(timezone.utc).date().isoformat()
    return await step_social_service.get_overview(user_id, resolved_date)


@router.get("/events", response_model=SocialEventCenterResponse)
async def get_social_events(
    user_id: str = Query(..., min_length=1),
    date: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=50),
) -> SocialEventCenterResponse:
    resolved_date = date or datetime.now(timezone.utc).date().isoformat()
    events = await step_social_service.get_events(user_id, date=resolved_date, limit=limit)
    return SocialEventCenterResponse(user_id=user_id, date=resolved_date, events=events)
