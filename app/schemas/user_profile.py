from typing import Literal

from pydantic import BaseModel, Field


Gender = Literal["male", "female"]
ActivityLevel = Literal["sedentary", "light", "moderate", "active", "very_active"]
GoalType = Literal["fat_loss", "muscle_gain", "recomposition", "maintenance"]
ProgressDirection = Literal["down", "up", "stable"]
ProgressStatus = Literal["on_track", "at_risk", "needs_more_data"]
RiskSeverity = Literal["low", "medium", "high"]


class UserProfilePayload(BaseModel):
    user_id: str = Field(..., min_length=1)
    weight_kg: float = Field(..., gt=0)
    height_cm: float = Field(..., gt=0)
    age: int = Field(..., gt=0, le=120)
    gender: Gender
    activity_level: ActivityLevel
    training_frequency_per_week: int = Field(..., ge=0, le=14)
    goal: GoalType


class UserProfile(UserProfilePayload):
    created_at: str
    updated_at: str


class WeightLogEntry(BaseModel):
    weight_kg: float = Field(..., gt=0)
    measured_at: str
    created_at: str


class WeightLogRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    weight_kg: float = Field(..., gt=0)
    measured_at: str | None = None


class MacroTargetExplanation(BaseModel):
    grams: float = Field(..., ge=0)
    grams_per_kg: float = Field(..., ge=0)
    calories: float = Field(..., ge=0)
    rationale: str


class GoalCalculation(BaseModel):
    bmr_kcal: float = Field(..., ge=0)
    activity_multiplier: float = Field(..., ge=0)
    tdee_kcal: float = Field(..., ge=0)
    calorie_adjustment_kcal: float
    calorie_target_kcal: float = Field(..., ge=0)
    protein: MacroTargetExplanation
    fat: MacroTargetExplanation
    carbs_g: float = Field(..., ge=0)
    carbs_kcal: float = Field(..., ge=0)
    explanations: list[str] = Field(default_factory=list)
    calculated_at: str


class UserProfileResponse(BaseModel):
    profile: UserProfile
    goals: GoalCalculation | None = None


class GoalRecalculateRequest(BaseModel):
    user_id: str = Field(..., min_length=1)


class UserGoalsResponse(BaseModel):
    user_id: str
    goal: GoalType
    goals: GoalCalculation


class WeightTrendSummary(BaseModel):
    first_log_date: str | None = None
    last_log_date: str | None = None
    log_count: int = Field(..., ge=0)
    latest_weight_kg: float | None = Field(default=None, gt=0)
    start_weight_kg: float | None = Field(default=None, gt=0)
    change_kg: float = 0
    change_percent: float = 0
    average_weekly_change_kg: float = 0
    direction: ProgressDirection = "stable"
    summary: str = ""


class ProgressPrediction(BaseModel):
    horizon_days: int = Field(..., ge=1)
    predicted_date: str
    predicted_weight_kg: float = Field(..., gt=0)
    confidence: str
    summary: str


class ProgressRiskSignal(BaseModel):
    code: str
    severity: RiskSeverity
    message: str


class ProgressResponse(BaseModel):
    user_id: str
    goal: GoalType
    current_weight_kg: float = Field(..., gt=0)
    weight_history: list[WeightLogEntry] = Field(default_factory=list)
    trend: WeightTrendSummary
    predictions: list[ProgressPrediction] = Field(default_factory=list)
    risks: list[ProgressRiskSignal] = Field(default_factory=list)
    status: ProgressStatus
    assumptions: list[str] = Field(default_factory=list)
