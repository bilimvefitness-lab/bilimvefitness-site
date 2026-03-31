from pydantic import BaseModel, Field


class TrainingProgramAnalysisRequest(BaseModel):
    program_text: str = Field(..., min_length=1)


class DetectedExercise(BaseModel):
    session: str
    exercise_name: str
    matched_alias: str | None = None
    sets: int = Field(..., ge=1)
    reps: str | None = None
    estimated_rir: float = Field(..., ge=0)
    muscles: dict[str, float]


class MuscleGroupStats(BaseModel):
    weekly_sets: float = Field(..., ge=0)
    frequency: int = Field(..., ge=0)


class RIRSummary(BaseModel):
    estimated_average_rir: float = Field(..., ge=0)
    interpretation: str


class HypertrophyScoreComponent(BaseModel):
    score: int = Field(..., ge=0, le=100)
    explanation: str
    weight: float = Field(..., ge=0, le=1)


class HypertrophyScoreBreakdown(BaseModel):
    weekly_volume_adequacy: HypertrophyScoreComponent
    frequency_adequacy: HypertrophyScoreComponent
    estimated_effort_quality: HypertrophyScoreComponent
    exercise_selection_quality: HypertrophyScoreComponent
    fatigue_balance: HypertrophyScoreComponent


class NextBestAction(BaseModel):
    title: str
    priority: str
    description: str


class TrainingProgramAnalysisResponse(BaseModel):
    hypertrophy_score: int = Field(..., ge=0, le=100)
    score_breakdown: HypertrophyScoreBreakdown
    overall_interpretation: str
    fatigue_risk: str
    main_strengths: list[str]
    main_limiters: list[str]
    next_best_actions: list[NextBestAction]
    weekly_volume_per_muscle_group: dict[str, float]
    frequency_per_muscle_group: dict[str, int]
    muscle_group_stats: dict[str, MuscleGroupStats]
    estimated_rir_level: RIRSummary
    optimization_suggestions: list[str]
    detected_exercises: list[DetectedExercise]
