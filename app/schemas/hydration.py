from typing import Literal

from pydantic import BaseModel, Field


HydrationTargetMode = Literal["auto", "manual"]
HydrationSourceUnit = Literal["glass", "ml", "liter"]
HydrationStatus = Literal["low", "on_track", "complete", "above_target"]
TrainingIntensity = Literal["light", "moderate", "intense"]
HydrationTimeStatus = Literal["ahead", "on_track", "behind_schedule"]
HydrationReminderIntervalMinutes = Literal[15, 30, 60, 90, 120, 150]


class UserHydrationProfilePayload(BaseModel):
    user_id: str = Field(..., min_length=1)
    weight_kg: float | None = Field(default=None, gt=0)
    default_glass_ml: int = Field(default=250, ge=100, le=1000)
    target_mode: HydrationTargetMode = "auto"
    manual_target_ml: int | None = Field(default=None, ge=500, le=10000)
    activity_adjustment_enabled: bool = False


class UserHydrationProfile(UserHydrationProfilePayload):
    created_at: str
    updated_at: str


class HydrationTargetDetails(BaseModel):
    mode: HydrationTargetMode
    base_target_ml: int = Field(..., ge=0)
    activity_adjustment_ml: int = Field(..., ge=0)
    target_ml: int = Field(..., ge=0)
    reason: str


class UserHydrationProfileResponse(BaseModel):
    profile: UserHydrationProfile
    target: HydrationTargetDetails


class HydrationReminderSettingsPayload(BaseModel):
    user_id: str = Field(..., min_length=1)
    enabled: bool = False
    start_time: str = Field(default="08:00", pattern=r"^\d{2}:\d{2}$")
    end_time: str = Field(default="22:00", pattern=r"^\d{2}:\d{2}$")
    interval_minutes: HydrationReminderIntervalMinutes = 60


class HydrationReminderSettings(HydrationReminderSettingsPayload):
    created_at: str
    updated_at: str


class HydrationReminderSettingsResponse(BaseModel):
    settings: HydrationReminderSettings
    next_hint: str


class WaterLogRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    unit: HydrationSourceUnit
    logged_at: str | None = None
    note: str | None = Field(default=None, max_length=160)


class WaterLogEntry(BaseModel):
    id: str
    user_id: str
    amount_ml: int = Field(..., ge=1)
    source_unit: HydrationSourceUnit
    source_value: float = Field(..., gt=0)
    logged_at: str
    note: str | None = None


class DeleteWaterLogResponse(BaseModel):
    log_id: str
    deleted: bool


class HydrationFeedback(BaseModel):
    message: str
    completion_percent: float = Field(..., ge=0)
    remaining_ml: int = Field(..., ge=0)
    status: HydrationStatus
    next_hint: str


class HydrationNextAction(BaseModel):
    suggested_ml: int = Field(..., ge=0)
    quick_action_label: str


class HydrationStreak(BaseModel):
    current_streak: int = Field(..., ge=0)
    best_streak: int = Field(..., ge=0)
    threshold_percent: int = Field(default=90, ge=1, le=100)


class WeeklyHydrationDayStat(BaseModel):
    date: str
    consumed_ml: int = Field(..., ge=0)
    target_ml: int = Field(..., ge=0)
    completion_percent: float = Field(..., ge=0)
    reached_target: bool
    score: int = Field(..., ge=0, le=100)


class WeeklyHydrationStatsResponse(BaseModel):
    start_date: str
    end_date: str
    days: list[WeeklyHydrationDayStat] = Field(default_factory=list)
    average_daily_ml: float = Field(..., ge=0)
    total_ml: int = Field(..., ge=0)
    best_streak: int = Field(..., ge=0)
    goal_reached_days: int = Field(..., ge=0)
    highest_day_ml: int = Field(..., ge=0)
    highest_day_date: str | None = None


class DailyHydrationSummary(BaseModel):
    date: str
    target_ml: int = Field(..., ge=0)
    base_target_ml: int = Field(..., ge=0)
    activity_adjustment_ml: int = Field(..., ge=0)
    consumed_ml: int = Field(..., ge=0)
    remaining_ml: int = Field(..., ge=0)
    completion_percent: float = Field(..., ge=0)
    expected_progress_percent: float = Field(..., ge=0, le=100)
    progress_gap: float
    time_status: HydrationTimeStatus
    hydration_score: int = Field(..., ge=0, le=100)
    status: HydrationStatus
    streak: HydrationStreak
    feedback: HydrationFeedback
    next_action: HydrationNextAction
    logs: list[WaterLogEntry] = Field(default_factory=list)


class HydrationLogListResponse(BaseModel):
    date: str
    logs: list[WaterLogEntry] = Field(default_factory=list)


class HydrationLogResponse(BaseModel):
    log: WaterLogEntry
    summary: DailyHydrationSummary
    feedback: HydrationFeedback
