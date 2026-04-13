from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.sleep import SleepCoachContext
from app.schemas.steps import StepActivityContext


ConfidenceLevel = Literal["high", "medium", "low"]
SuggestionSource = Literal["database", "recent", "frequent"]


class FoodReference(BaseModel):
    canonical_id: str
    display_name_tr: str
    default_unit: str
    standard_unit_weight_g: float = Field(..., ge=0)
    base_food: str | None = None
    cooking_method: str | None = None
    category: str | None = None
    related_foods: list[str] = Field(default_factory=list)
    brand: str | None = None
    product_name: str | None = None
    is_branded_product: bool = False


class ClarificationChoice(BaseModel):
    label: str
    estimated_weight_g: float = Field(..., ge=0)
    unit: str | None = None
    modifiers: list[str] = Field(default_factory=list)
    canonical_food_id: str | None = None
    canonical_display_name: str | None = None
    brand: str | None = None
    product_name: str | None = None
    is_branded_product: bool = False


class ClarificationQuestion(BaseModel):
    item_index: int = Field(..., ge=0)
    raw_text: str
    question: str
    suggested_options: list[str] = Field(default_factory=list)
    choices: list[ClarificationChoice] = Field(default_factory=list)


class ParserDebugCandidate(BaseModel):
    canonical_food_id: str
    display_name_tr: str
    matched_alias: str
    score: float = Field(..., ge=0, le=1.5)


class ParserDebugInfo(BaseModel):
    detected_tokens: list[str] = Field(default_factory=list)
    matched_alias: str | None = None
    candidate_list: list[ParserDebugCandidate] = Field(default_factory=list)
    final_selected_food: str | None = None
    confidence_score: float = Field(..., ge=0, le=1)


class ParsedNutritionItem(BaseModel):
    raw_text: str
    food_name: str
    amount: float | None = Field(default=None, ge=0)
    unit: str | None = None
    preparation_method: str | None = None
    modifiers: list[str] = Field(default_factory=list)
    canonical_food_id: str | None = None
    canonical_display_name: str | None = None
    base_food: str | None = None
    detected_cooking_method: str | None = None
    food_category: str | None = None
    related_foods: list[str] = Field(default_factory=list)
    brand: str | None = None
    product_name: str | None = None
    is_branded_product: bool = False
    estimated_weight_g: float | None = Field(default=None, ge=0)
    estimated_weight_min_g: float | None = Field(default=None, ge=0)
    estimated_weight_max_g: float | None = Field(default=None, ge=0)
    portion_source: str | None = None
    user_history_samples: int | None = Field(default=None, ge=0)
    confidence_level: ConfidenceLevel
    confidence_score: float = Field(..., ge=0, le=1)
    estimated: bool = False
    needs_clarification: bool = False
    clarification_reason: str | None = None
    debug: ParserDebugInfo | None = None


class MacroTotals(BaseModel):
    kcal: float = Field(..., ge=0)
    protein_g: float = Field(..., ge=0)
    carbs_g: float = Field(..., ge=0)
    fat_g: float = Field(..., ge=0)


class NutritionCalculatedItem(ParsedNutritionItem):
    nutrition: MacroTotals | None = None
    calculation_basis: str | None = None


class NutritionParseRequest(BaseModel):
    text: str = Field(..., min_length=1)
    user_id: str | None = None


class NutritionParseResponse(BaseModel):
    input_text: str
    parsed_items: list[ParsedNutritionItem]
    normalized_foods: list[FoodReference]
    confidence_level: ConfidenceLevel
    confidence_score: float = Field(..., ge=0, le=1)
    needs_clarification: bool
    clarification_questions: list[ClarificationQuestion]


class NutritionCalculateRequest(BaseModel):
    items: list[ParsedNutritionItem]
    user_id: str | None = None


class NutritionCalculateResponse(BaseModel):
    items: list[NutritionCalculatedItem]
    meal_totals: MacroTotals
    confidence_level: ConfidenceLevel
    confidence_score: float = Field(..., ge=0, le=1)
    needs_clarification: bool
    clarification_questions: list[ClarificationQuestion]
    excluded_item_count: int = Field(..., ge=0)


class FoodSuggestion(BaseModel):
    canonical_id: str
    display_name_tr: str
    insert_text: str
    source: SuggestionSource
    matched_text: str
    brand: str | None = None
    product_name: str | None = None
    is_branded_product: bool = False
    score: float = Field(..., ge=0, le=1)
    usage_count: int = Field(default=0, ge=0)
    last_used_at: str | None = None


class NutritionSuggestResponse(BaseModel):
    query: str
    segment: str
    suggestions: list[FoodSuggestion]


class ProductSearchResponse(BaseModel):
    query: str
    brand: str | None = None
    products: list[FoodReference]


class MealSaveRequest(BaseModel):
    user_id: str | None = None
    meal_type: str = Field(..., min_length=1)
    items: list[NutritionCalculatedItem]
    totals: MacroTotals
    consumed_at: str | None = None
    date: str | None = None
    notes: str | None = None


class MealEntryItem(BaseModel):
    raw_text: str
    canonical_food_id: str
    canonical_display_name: str
    amount: float | None = Field(default=None, ge=0)
    unit: str | None = None
    estimated_weight_g: float = Field(..., ge=0)
    estimated_weight_min_g: float | None = Field(default=None, ge=0)
    estimated_weight_max_g: float | None = Field(default=None, ge=0)
    portion_source: str | None = None
    user_history_samples: int | None = Field(default=None, ge=0)
    confidence_level: ConfidenceLevel
    confidence_score: float = Field(..., ge=0, le=1)
    nutrition: MacroTotals
    preparation_method: str | None = None
    modifiers: list[str] = Field(default_factory=list)


class MealEntry(BaseModel):
    meal_id: str
    user_id: str | None = None
    meal_type: str
    date: str
    consumed_at: str
    notes: str | None = None
    items: list[MealEntryItem]
    totals: MacroTotals
    confidence: "ConfidenceSummary | None" = None
    created_at: str


class DailySummaryResponse(BaseModel):
    date: str
    total_kcal: float = Field(..., ge=0)
    total_protein_g: float = Field(..., ge=0)
    total_carbs_g: float = Field(..., ge=0)
    total_fat_g: float = Field(..., ge=0)
    meal_count: int = Field(..., ge=0)
    meals: list[MealEntry]
    confidence_overview: "ConfidenceSummary | None" = None


class ConfidenceSummary(BaseModel):
    score: int = Field(..., ge=0, le=100)
    level: ConfidenceLevel
    explanation: str


class BehaviorScoreComponent(BaseModel):
    key: "BehaviorComponentKey"
    score: int = Field(..., ge=0, le=100)
    explanation: str


class DailyBehaviorScore(BaseModel):
    total: int = Field(..., ge=0, le=100)
    status: "BehaviorScoreStatus"
    priority_component: "BehaviorComponentKey"
    explanation: str
    components: list[BehaviorScoreComponent] = Field(default_factory=list)


class BehaviorStreak(BaseModel):
    count: int = Field(..., ge=0)
    active: bool = False
    label: str
    explanation: str


class BehaviorStreaks(BaseModel):
    logging: BehaviorStreak
    protein_target: BehaviorStreak


CalorieBalance = Literal["deficit", "surplus", "near_target"]
ProteinStatus = Literal["low", "close", "on_target", "above_target"]
ActionPriority = Literal["low", "medium", "high"]
DailyActionType = Literal["protein_up", "calories_down", "calories_up", "maintain", "rebalance"]
ActionTriggerType = Literal["quick_add", "focus_meal_input", "log_water", "show_missing"]
ExecutableActionType = Literal["add_food", "reduce_carbs", "log_meal", "add_water"]
ActionStatus = Literal["pending", "completed"]
ActionEventType = Literal["action_clicked", "action_completed"]
BehaviorSeverity = Literal["low", "medium", "high"]
BehaviorComponentKey = Literal["protein", "calories", "logging"]
BehaviorScoreStatus = Literal["strong", "fair", "fragile"]
BehaviorCode = Literal[
    "logging_consistency_low",
    "protein_consistency_low",
    "calorie_surplus_pattern",
    "underfueling_pattern",
    "meal_skipping_pattern",
    "low_daily_score",
    "low_logging_streak",
    "low_confidence_logging",
    "on_track",
]
TrendDirection = Literal["improving", "stable", "drifting"]
CoachMetric = Literal["protein", "calories"]
PrimeCoachMode = Literal["strict", "balanced", "flexible"]
CoachRiskLevel = Literal["low", "medium", "high"]
PrimeVoiceMode = Literal["crisis", "end_of_day"]


class DailyMetricAnalysis(BaseModel):
    metric: CoachMetric
    target: float = Field(..., ge=0)
    actual: float = Field(..., ge=0)
    difference: float
    adherence_ratio: float = Field(..., ge=0)
    status: str
    summary: str


class WeeklyTrendPoint(BaseModel):
    date: str
    actual_kcal: float = Field(..., ge=0)
    actual_protein_g: float = Field(..., ge=0)
    meal_count: int = Field(..., ge=0)
    calorie_difference_kcal: float
    protein_gap_g: float
    logged: bool


class WeeklyTrendSummary(BaseModel):
    start_date: str
    end_date: str
    days_logged: int = Field(..., ge=0)
    average_kcal: float = Field(..., ge=0)
    average_protein_g: float = Field(..., ge=0)
    average_calorie_difference_kcal: float
    average_protein_gap_g: float
    on_target_days: int = Field(..., ge=0)
    trend_direction: TrendDirection
    summary: str
    daily_points: list[WeeklyTrendPoint] = Field(default_factory=list)


class BehaviorSignal(BaseModel):
    code: BehaviorCode
    severity: BehaviorSeverity
    message: str


class PrimePredictionSignal(BaseModel):
    code: str
    label: str
    message: str
    risk_level: CoachRiskLevel
    confidence: float = Field(..., ge=0, le=1)


class PrimeBehaviorMemory(BaseModel):
    window_days: int = Field(..., ge=1)
    late_eating_days: int = Field(..., ge=0)
    skipped_meal_days: int = Field(..., ge=0)
    low_compliance_days: int = Field(..., ge=0)
    inconsistent_tracking: bool = False
    dominant_pattern: str = ""
    notes: list[str] = Field(default_factory=list)


class PrimeCoachOutput(BaseModel):
    mode: PrimeCoachMode
    message: str
    actions: list[str] = Field(default_factory=list, max_length=3)
    reason: str
    risk_level: CoachRiskLevel
    confidence: float = Field(..., ge=0, le=1)


class DailyDecisionOutput(BaseModel):
    today_decision: list[str] = Field(default_factory=list)
    next_meal_action: str
    risk_control: str
    priority: str


class DailyCoachResponse(BaseModel):
    date: str
    protein_target_g: float = Field(..., ge=0)
    actual_protein_g: float = Field(..., ge=0)
    protein_gap_g: float
    protein_status: ProteinStatus
    calorie_target_kcal: float = Field(..., ge=0)
    actual_kcal: float = Field(..., ge=0)
    calorie_difference_kcal: float
    calorie_balance: CalorieBalance
    suggestions: list[str] = Field(default_factory=list)
    coaching_message: str
    coaching_focus: str = ""
    daily_analysis: list[DailyMetricAnalysis] = Field(default_factory=list)
    weekly_trend: WeeklyTrendSummary | None = None
    behavior_signals: list[BehaviorSignal] = Field(default_factory=list)
    behavior_score: DailyBehaviorScore | None = None
    streaks: BehaviorStreaks | None = None
    confidence_overview: ConfidenceSummary | None = None
    behavior_memory: PrimeBehaviorMemory | None = None
    prediction_signals: list[PrimePredictionSignal] = Field(default_factory=list)
    prime: PrimeCoachOutput | None = None
    sleep: SleepCoachContext | None = None
    step_activity: StepActivityContext | None = None
    decision: DailyDecisionOutput | None = None


class DailyActionResponse(BaseModel):
    date: str
    primary_action: str
    quick_fix: str | None = None
    secondary_note: str | None = None
    priority: ActionPriority
    risk_level: CoachRiskLevel
    action_type: DailyActionType
    protein_gap_g: float
    calorie_difference_kcal: float
    pressure_level: int = Field(..., ge=1, le=3)
    ignored_action_count: int = Field(default=0, ge=0)
    actions: list["ExecutableAction"] = Field(default_factory=list)
    pending_actions: list[str] = Field(default_factory=list)
    completed_actions: list[str] = Field(default_factory=list)
    voice: "PrimeVoiceResponse | None" = None


class ExecutableActionPayload(BaseModel):
    suggested_foods: list[str] = Field(default_factory=list)
    protein_target: float | None = Field(default=None, ge=0)
    quick_text: str | None = None
    water_amount_ml: int | None = Field(default=None, ge=0)
    meal_type_hint: str | None = None
    avoid_foods: list[str] = Field(default_factory=list)
    focus_field: str | None = None


class ExecutableAction(BaseModel):
    action_id: str
    label: str
    type: ExecutableActionType
    payload: ExecutableActionPayload
    ui_trigger: ActionTriggerType
    status: ActionStatus = "pending"


class DailyActionTrackRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    date: str = Field(..., min_length=1)
    action_id: str = Field(..., min_length=1)
    event_type: ActionEventType


class DailyActionTrackResponse(BaseModel):
    action_id: str
    event_type: ActionEventType
    status: ActionStatus
    pending_actions: list[str] = Field(default_factory=list)
    completed_actions: list[str] = Field(default_factory=list)
    pressure_level: int = Field(..., ge=1, le=3)


class PrimeVoiceResponse(BaseModel):
    enabled: bool = False
    auto_play: bool = False
    mode: PrimeVoiceMode = "end_of_day"
    priority: ActionPriority = "low"
    audio_url: str = ""
    reason: str = ""


QuickAddSource = Literal["recent", "favorite"]


class QuickAddFood(BaseModel):
    quick_add_id: str
    label: str
    quick_text: str
    canonical_food_id: str | None = None
    meal_type_hint: str | None = None
    source: QuickAddSource
    last_used_at: str | None = None
    usage_count: int = Field(default=0, ge=0)


class QuickAddMeal(BaseModel):
    template_id: str
    title: str
    quick_text: str
    meal_type: str | None = None
    item_count: int = Field(default=0, ge=0)
    source: QuickAddSource
    last_used_at: str | None = None


class QuickAddResponse(BaseModel):
    user_id: str
    last_10_foods: list[QuickAddFood]
    favorite_foods: list[QuickAddFood]
    favorite_meals: list[QuickAddMeal]


class FavoriteFoodRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    quick_text: str = Field(..., min_length=1)
    display_name_tr: str = Field(..., min_length=1)
    canonical_food_id: str | None = None
    meal_type_hint: str | None = None
    active: bool = True


class FavoriteMealRequest(BaseModel):
    user_id: str = Field(..., min_length=1)
    title: str = Field(..., min_length=1)
    quick_text: str = Field(..., min_length=1)
    meal_type: str | None = None
    item_count: int = Field(default=0, ge=0)
    active: bool = True
