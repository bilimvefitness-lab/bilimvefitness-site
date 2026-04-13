from typing import Literal

from pydantic import BaseModel, Field


SleepSourceType = Literal["apple_health", "health_connect", "manual"]
SleepConfidenceLevel = Literal["low", "standard", "high"]
SleepBedtimeTrend = Literal["earlier", "stable", "later", "insufficient_data"]
SleepConsistencyFlag = Literal["stable", "delayed", "insufficient_data"]
SleepRecoverySignal = Literal["low", "moderate", "target", "high", "unknown"]


class SleepDailySummaryPayload(BaseModel):
    sleep_day: str = Field(..., min_length=10, max_length=10)
    primary_source: SleepSourceType
    bedtime: str = Field(..., min_length=10)
    wake_time: str = Field(..., min_length=10)
    total_sleep_minutes: int = Field(..., ge=0)
    time_in_bed_minutes: int | None = Field(default=None, ge=0)
    awake_minutes: int | None = Field(default=None, ge=0)
    rem_minutes: int | None = Field(default=None, ge=0)
    core_minutes: int | None = Field(default=None, ge=0)
    deep_minutes: int | None = Field(default=None, ge=0)
    awakenings_count: int | None = Field(default=None, ge=0)
    manual_quality_score: int | None = Field(default=None, ge=1, le=5)
    trend_3d_average: float | None = Field(default=None, ge=0)
    trend_7d_average: float | None = Field(default=None, ge=0)
    bedtime_trend: SleepBedtimeTrend | None = None
    is_stage_data_available: bool = False
    is_manual: bool = False
    confidence_level: SleepConfidenceLevel = "low"
    last_synced_at: str | None = None


class SleepSyncRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    summaries: list[SleepDailySummaryPayload] = Field(default_factory=list, min_length=1)


class SleepDailySummary(BaseModel):
    user_id: str
    sleep_day: str
    primary_source: SleepSourceType
    bedtime: str
    wake_time: str
    total_sleep_minutes: int = Field(..., ge=0)
    time_in_bed_minutes: int | None = Field(default=None, ge=0)
    awake_minutes: int | None = Field(default=None, ge=0)
    rem_minutes: int | None = Field(default=None, ge=0)
    core_minutes: int | None = Field(default=None, ge=0)
    deep_minutes: int | None = Field(default=None, ge=0)
    awakenings_count: int | None = Field(default=None, ge=0)
    manual_quality_score: int | None = Field(default=None, ge=1, le=5)
    trend_3d_average: float | None = Field(default=None, ge=0)
    trend_7d_average: float | None = Field(default=None, ge=0)
    bedtime_trend: SleepBedtimeTrend | None = None
    is_stage_data_available: bool = False
    is_manual: bool = False
    confidence_level: SleepConfidenceLevel = "low"
    last_synced_at: str
    created_at: str
    updated_at: str


class SleepDailyResponse(BaseModel):
    user_id: str
    sleep_day: str
    summary: SleepDailySummary | None = None


class SleepRangeResponse(BaseModel):
    user_id: str
    start_day: str
    end_day: str
    summaries: list[SleepDailySummary] = Field(default_factory=list)


class SleepSyncResponse(BaseModel):
    user_id: str
    upserted_count: int = Field(..., ge=0)
    summaries: list[SleepDailySummary] = Field(default_factory=list)


class SleepCoachContext(BaseModel):
    available: bool = False
    sleep_day: str
    total_sleep_minutes: int = Field(default=0, ge=0)
    bedtime: str | None = None
    wake_time: str | None = None
    awakenings_count: int | None = Field(default=None, ge=0)
    manual_quality_score: int | None = Field(default=None, ge=1, le=5)
    rem_minutes: int | None = Field(default=None, ge=0)
    deep_minutes: int | None = Field(default=None, ge=0)
    source_type: SleepSourceType | None = None
    trend_3d_average: float | None = Field(default=None, ge=0)
    trend_7d_average: float | None = Field(default=None, ge=0)
    bedtime_trend: SleepBedtimeTrend = "insufficient_data"
    sleep_consistency_flag: SleepConsistencyFlag = "insufficient_data"
    confidence_level: SleepConfidenceLevel = "low"
    is_stage_data_available: bool = False
    recovery_signal: SleepRecoverySignal = "unknown"
    stage_summary: str = ""
    insights: list[str] = Field(default_factory=list)
