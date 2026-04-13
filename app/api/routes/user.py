from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, Query

from app.core.dependencies import (
    get_decision_engine,
    get_goal_engine,
    get_meal_logging_service,
    get_progress_engine,
    get_sleep_service,
    get_step_service,
    get_user_profile_store,
)
from app.db.user_profile_store import (
    StoredGoalCalculation,
    StoredMacroTarget,
    StoredUserProfile,
    StoredWeightLogEntry,
)
from app.schemas.nutrition import DailyCoachResponse
from app.schemas.nutrition import PrimeCoachMode
from app.schemas.user_profile import (
    GoalCalculation,
    GoalRecalculateRequest,
    ProgressResponse,
    UserGoalsResponse,
    UserProfile,
    UserProfilePayload,
    UserProfileResponse,
    WeightLogRequest,
)


router = APIRouter(prefix="/user", tags=["user"])
user_profile_store = get_user_profile_store()
goal_engine = get_goal_engine()
progress_engine = get_progress_engine()
decision_engine = get_decision_engine()
meal_logging_service = get_meal_logging_service()
step_service = get_step_service()
sleep_service = get_sleep_service()


@router.post("/profile", response_model=UserProfileResponse)
async def upsert_user_profile(payload: UserProfilePayload) -> UserProfileResponse:
    existing = await user_profile_store.get_profile(payload.user_id)
    timestamp = datetime.now(timezone.utc).isoformat()
    calculated_goals = goal_engine.calculate(payload)

    stored_profile = StoredUserProfile(
        user_id=payload.user_id,
        weight_kg=payload.weight_kg,
        height_cm=payload.height_cm,
        age=payload.age,
        gender=payload.gender,
        activity_level=payload.activity_level,
        training_frequency_per_week=payload.training_frequency_per_week,
        goal=payload.goal,
        created_at=existing.created_at if existing else timestamp,
        updated_at=timestamp,
        goals=_to_stored_goals(calculated_goals),
        weight_history=(
            existing.weight_history
            if existing and existing.weight_history
            else [
                StoredWeightLogEntry(
                    weight_kg=payload.weight_kg,
                    measured_at=timestamp,
                    created_at=timestamp,
                )
            ]
        ),
    )
    await user_profile_store.save_profile(stored_profile)
    return _to_profile_response(stored_profile)


@router.get("/profile", response_model=UserProfileResponse)
async def get_user_profile(user_id: str = Query(..., min_length=1)) -> UserProfileResponse:
    profile = await user_profile_store.get_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")
    return _to_profile_response(profile)


@router.post("/goals/recalculate", response_model=UserGoalsResponse)
async def recalculate_goals(payload: GoalRecalculateRequest) -> UserGoalsResponse:
    profile = await user_profile_store.get_profile(payload.user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")

    calculated_goals = goal_engine.calculate(_to_profile_payload(profile))
    profile.goals = _to_stored_goals(calculated_goals)
    profile.updated_at = datetime.now(timezone.utc).isoformat()
    await user_profile_store.save_profile(profile)
    return _to_goals_response(profile.user_id, profile.goal, calculated_goals)


@router.get("/goals", response_model=UserGoalsResponse)
async def get_user_goals(user_id: str = Query(..., min_length=1)) -> UserGoalsResponse:
    profile = await user_profile_store.get_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")

    if profile.goals is None:
        calculated_goals = goal_engine.calculate(_to_profile_payload(profile))
        profile.goals = _to_stored_goals(calculated_goals)
        profile.updated_at = datetime.now(timezone.utc).isoformat()
        await user_profile_store.save_profile(profile)
    else:
        calculated_goals = _to_goal_calculation(profile.goals)

    return _to_goals_response(profile.user_id, profile.goal, calculated_goals)


@router.get("/daily-coach", response_model=DailyCoachResponse)
async def get_user_daily_coach(
    user_id: str = Query(..., min_length=1),
    date: str | None = Query(default=None),
    mode: PrimeCoachMode = Query(default="balanced"),
) -> DailyCoachResponse:
    profile = await user_profile_store.get_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")

    if profile.goals is None:
        calculated_goals = goal_engine.calculate(_to_profile_payload(profile))
        profile.goals = _to_stored_goals(calculated_goals)
        profile.updated_at = datetime.now(timezone.utc).isoformat()
        await user_profile_store.save_profile(profile)
    else:
        calculated_goals = _to_goal_calculation(profile.goals)

    resolved_date = date or datetime.now(timezone.utc).date().isoformat()
    sleep_context = await sleep_service.build_coach_context(
        user_id=user_id,
        sleep_day=resolved_date,
    )
    step_activity = await step_service.build_activity_context(
        user_id=user_id,
        analysis_date=resolved_date,
        base_calorie_target_kcal=calculated_goals.calorie_target_kcal,
        weight_kg=profile.weight_kg,
    )
    dynamic_calorie_target_kcal = (
        step_activity.adjusted_calorie_target_kcal
        if step_activity.available and step_activity.adjusted_calorie_target_kcal is not None
        else calculated_goals.calorie_target_kcal
    )
    coach = await meal_logging_service.get_daily_coach(
        date=resolved_date,
        protein_target_g=calculated_goals.protein.grams,
        calorie_target_kcal=dynamic_calorie_target_kcal,
        user_id=user_id,
        mode=mode,
        sleep_context=sleep_context if sleep_context.available else None,
        step_activity=step_activity if step_activity.available else None,
    )
    progress = progress_engine.build_progress(profile)
    coach.sleep = sleep_context
    coach.step_activity = step_activity
    coach.decision = decision_engine.build_decision(
        coach=coach,
        progress=progress,
        goal=profile.goal,
        sleep_context=sleep_context if sleep_context.available else None,
        step_activity=step_activity,
    )
    return coach


@router.post("/progress/weight", response_model=ProgressResponse)
async def log_weight(payload: WeightLogRequest) -> ProgressResponse:
    profile = await user_profile_store.get_profile(payload.user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")

    updated_profile = progress_engine.log_weight(
        profile=profile,
        weight_kg=payload.weight_kg,
        measured_at=payload.measured_at,
    )
    await user_profile_store.save_profile(updated_profile)
    return progress_engine.build_progress(updated_profile)


@router.get("/progress", response_model=ProgressResponse)
async def get_progress(user_id: str = Query(..., min_length=1)) -> ProgressResponse:
    profile = await user_profile_store.get_profile(user_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="User profile not found.")
    return progress_engine.build_progress(profile)


def _to_profile_payload(profile: StoredUserProfile) -> UserProfilePayload:
    return UserProfilePayload(
        user_id=profile.user_id,
        weight_kg=profile.weight_kg,
        height_cm=profile.height_cm,
        age=profile.age,
        gender=profile.gender,
        activity_level=profile.activity_level,
        training_frequency_per_week=profile.training_frequency_per_week,
        goal=profile.goal,
    )


def _to_profile_response(profile: StoredUserProfile) -> UserProfileResponse:
    return UserProfileResponse(
        profile=UserProfile(
            user_id=profile.user_id,
            weight_kg=profile.weight_kg,
            height_cm=profile.height_cm,
            age=profile.age,
            gender=profile.gender,
            activity_level=profile.activity_level,
            training_frequency_per_week=profile.training_frequency_per_week,
            goal=profile.goal,
            created_at=profile.created_at,
            updated_at=profile.updated_at,
        ),
        goals=_to_goal_calculation(profile.goals) if profile.goals else None,
    )


def _to_goals_response(user_id: str, goal: str, goals: GoalCalculation) -> UserGoalsResponse:
    return UserGoalsResponse(user_id=user_id, goal=goal, goals=goals)


def _to_stored_goals(goals: GoalCalculation) -> StoredGoalCalculation:
    return StoredGoalCalculation(
        bmr_kcal=goals.bmr_kcal,
        activity_multiplier=goals.activity_multiplier,
        tdee_kcal=goals.tdee_kcal,
        calorie_adjustment_kcal=goals.calorie_adjustment_kcal,
        calorie_target_kcal=goals.calorie_target_kcal,
        protein=StoredMacroTarget(
            grams=goals.protein.grams,
            grams_per_kg=goals.protein.grams_per_kg,
            calories=goals.protein.calories,
            rationale=goals.protein.rationale,
        ),
        fat=StoredMacroTarget(
            grams=goals.fat.grams,
            grams_per_kg=goals.fat.grams_per_kg,
            calories=goals.fat.calories,
            rationale=goals.fat.rationale,
        ),
        carbs_g=goals.carbs_g,
        carbs_kcal=goals.carbs_kcal,
        explanations=list(goals.explanations),
        calculated_at=goals.calculated_at,
    )


def _to_goal_calculation(goals: StoredGoalCalculation) -> GoalCalculation:
    return GoalCalculation(
        bmr_kcal=goals.bmr_kcal,
        activity_multiplier=goals.activity_multiplier,
        tdee_kcal=goals.tdee_kcal,
        calorie_adjustment_kcal=goals.calorie_adjustment_kcal,
        calorie_target_kcal=goals.calorie_target_kcal,
        protein={
            "grams": goals.protein.grams,
            "grams_per_kg": goals.protein.grams_per_kg,
            "calories": goals.protein.calories,
            "rationale": goals.protein.rationale,
        },
        fat={
            "grams": goals.fat.grams,
            "grams_per_kg": goals.fat.grams_per_kg,
            "calories": goals.fat.calories,
            "rationale": goals.fat.rationale,
        },
        carbs_g=goals.carbs_g,
        carbs_kcal=goals.carbs_kcal,
        explanations=list(goals.explanations),
        calculated_at=goals.calculated_at,
    )
