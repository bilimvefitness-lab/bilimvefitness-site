from typing import Literal

from pydantic import BaseModel, Field


CommandPriority = Literal["low", "medium", "high"]
CommandDomain = Literal["protein", "calories", "hydration", "maintain"]
ProteinCommandStatus = Literal["behind", "on_track", "ahead"]
CalorieCommandStatus = Literal["low", "on_track", "high"]
HydrationCommandStatus = Literal["behind", "on_track", "ahead"]


class DailyCommandSubStatus(BaseModel):
    protein: ProteinCommandStatus
    calories: CalorieCommandStatus
    hydration: HydrationCommandStatus


class DailyCommandMetrics(BaseModel):
    protein_percent: float = Field(..., ge=0)
    calorie_percent: float = Field(..., ge=0)
    hydration_percent: float = Field(..., ge=0)


class DailyCommandResponse(BaseModel):
    date: str
    overall_status: str
    primary_domain: CommandDomain
    primary_action: str
    quick_fix: str | None = None
    priority: CommandPriority
    sub_status: DailyCommandSubStatus
    metrics: DailyCommandMetrics
    hydration_quick_add_ml: int | None = Field(default=None, ge=0)
