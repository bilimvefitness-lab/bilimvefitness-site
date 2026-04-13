from typing import Literal

from pydantic import BaseModel, Field


StepSource = Literal["ios_pedometer", "android_health_connect", "manual", "unknown"]
StepActivityBand = Literal["very_low", "low", "moderate", "good", "very_high"]
StepTrendDirection = Literal["up", "steady", "down", "insufficient_data"]
PrimeTone = Literal["motive", "firm", "challenge"]
StepDailyTaskType = Literal["walk_session", "step_goal"]
StepAchievementKey = Literal["first_session", "streak_3", "streak_7", "high_step_day", "night_walk"]
StepStreakProtectionLevel = Literal["safe", "watch", "critical", "broken"]


class StepRecordPayload(BaseModel):
    date: str = Field(..., min_length=10, max_length=10)
    step_count: int = Field(..., ge=0)
    source: StepSource = "unknown"
    last_synced_at: str | None = None


class StepSyncRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    records: list[StepRecordPayload] = Field(default_factory=list, min_length=1)


class StepRecord(BaseModel):
    user_id: str
    date: str
    step_count: int = Field(..., ge=0)
    source: StepSource
    last_synced_at: str
    created_at: str
    updated_at: str


class StepDailyResponse(BaseModel):
    user_id: str
    date: str
    record: StepRecord | None = None


class StepRangeResponse(BaseModel):
    user_id: str
    start_date: str
    end_date: str
    records: list[StepRecord] = Field(default_factory=list)


class StepSyncResponse(BaseModel):
    user_id: str
    upserted_count: int = Field(..., ge=0)
    records: list[StepRecord] = Field(default_factory=list)


class StepDailyTask(BaseModel):
    type: StepDailyTaskType
    title: str
    detail: str = ""
    target_value: int = Field(default=0, ge=0)
    progress_value: int = Field(default=0, ge=0)
    completed: bool = False


class StepAchievement(BaseModel):
    key: StepAchievementKey
    title: str
    detail: str = ""
    earned: bool = False
    earned_at: str | None = None


class StepStreakSnapshot(BaseModel):
    current_days: int = Field(default=0, ge=0)
    longest_days: int = Field(default=0, ge=0)
    completed_today: bool = False
    protection_level: StepStreakProtectionLevel = "safe"
    protection_message: str = ""


class StepSessionBehaviorSummary(BaseModel):
    completed_today: int = Field(default=0, ge=0)
    total_sessions_7d: int = Field(default=0, ge=0)
    latest_session_at: str | None = None


class StepEngagementSnapshotPayload(BaseModel):
    date: str = Field(..., min_length=10, max_length=10)
    daily_task: StepDailyTask
    achievements: list[StepAchievement] = Field(default_factory=list)
    streak: StepStreakSnapshot
    prime_tone: PrimeTone = "motive"
    prime_message: str = ""
    fomo_messages: list[str] = Field(default_factory=list)
    leaderboard_rank: int | None = Field(default=None, ge=1)
    session_summary: StepSessionBehaviorSummary | None = None


class StepEngagementSyncRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    snapshot: StepEngagementSnapshotPayload


class StepEngagementRecord(BaseModel):
    user_id: str
    date: str
    daily_task: StepDailyTask
    achievements: list[StepAchievement] = Field(default_factory=list)
    streak: StepStreakSnapshot
    prime_tone: PrimeTone = "motive"
    prime_message: str = ""
    fomo_messages: list[str] = Field(default_factory=list)
    leaderboard_rank: int | None = Field(default=None, ge=1)
    session_summary: StepSessionBehaviorSummary | None = None
    created_at: str
    updated_at: str


class StepLeaderboardEntry(BaseModel):
    user_id: str
    rank: int = Field(..., ge=1)
    step_count: int = Field(..., ge=0)
    is_current_user: bool = False


class StepLeaderboardResponse(BaseModel):
    date: str
    total_participants: int = Field(default=0, ge=0)
    entries: list[StepLeaderboardEntry] = Field(default_factory=list)
    current_user: StepLeaderboardEntry | None = None


class StepTrendPoint(BaseModel):
    date: str
    step_count: int = Field(default=0, ge=0)
    source: StepSource = "unknown"
    available: bool = False
    activity_level: StepActivityBand | None = None


class StepActivityContext(BaseModel):
    available: bool = False
    date: str
    step_count: int = Field(default=0, ge=0)
    step_goal: int = Field(default=10000, ge=1)
    progress_percent: float = Field(default=0, ge=0)
    source: StepSource = "unknown"
    activity_level: StepActivityBand | None = None
    activity_label: str = ""
    adjusted_calorie_delta_kcal: int = 0
    adjusted_calorie_target_kcal: float | None = Field(default=None, ge=0)
    hydration_adjustment_ml: int = Field(default=0, ge=0)
    hydration_target_ml: int | None = Field(default=None, ge=0)
    movement_alerts: list[str] = Field(default_factory=list)
    coach_message_hint: str = ""
    trend_direction: StepTrendDirection = "insufficient_data"
    trend_summary: str = ""
    last_3_days: list[StepTrendPoint] = Field(default_factory=list)
