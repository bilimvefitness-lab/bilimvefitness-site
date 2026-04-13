from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone

from app.db.user_profile_store import StoredUserProfile, StoredWeightLogEntry
from app.schemas.user_profile import (
    GoalType,
    ProgressPrediction,
    ProgressResponse,
    ProgressRiskSignal,
    ProgressStatus,
    WeightLogEntry,
    WeightTrendSummary,
)


@dataclass(frozen=True, slots=True)
class WeightTrendStats:
    start_weight_kg: float
    latest_weight_kg: float
    change_kg: float
    change_percent: float
    average_weekly_change_kg: float
    direction: str
    span_days: int
    log_count: int
    first_log_date: str
    last_log_date: str


class ProgressEngine:
    def build_progress(self, profile: StoredUserProfile) -> ProgressResponse:
        history = sorted(profile.weight_history or [], key=lambda item: item.measured_at)
        trend = self._build_trend(history, profile.weight_kg)
        predictions = self._build_predictions(profile.goal, history, trend)
        risks = self._detect_risks(profile.goal, history, trend)
        status = self._derive_status(risks, history)

        return ProgressResponse(
            user_id=profile.user_id,
            goal=profile.goal,
            current_weight_kg=profile.weight_kg,
            weight_history=[
                WeightLogEntry(
                    weight_kg=item.weight_kg,
                    measured_at=item.measured_at,
                    created_at=item.created_at,
                )
                for item in history
            ],
            trend=trend,
            predictions=predictions,
            risks=risks,
            status=status,
            assumptions=self._assumptions(),
        )

    def log_weight(
        self,
        *,
        profile: StoredUserProfile,
        weight_kg: float,
        measured_at: str | None,
    ) -> StoredUserProfile:
        timestamp = measured_at or datetime.now(timezone.utc).isoformat()
        created_at = datetime.now(timezone.utc).isoformat()
        history = list(profile.weight_history or [])
        if self._should_drop_seed_entry(profile, history, timestamp):
            history = []
        history.append(
            StoredWeightLogEntry(
                weight_kg=weight_kg,
                measured_at=timestamp,
                created_at=created_at,
            )
        )
        history.sort(key=lambda item: item.measured_at)
        profile.weight_history = history
        profile.weight_kg = weight_kg
        profile.updated_at = created_at
        return profile

    def _build_trend(self, history: list[StoredWeightLogEntry], fallback_weight_kg: float) -> WeightTrendSummary:
        if not history:
            return WeightTrendSummary(
                log_count=0,
                latest_weight_kg=fallback_weight_kg,
                start_weight_kg=fallback_weight_kg,
                summary="Henuz kilo gecmisi yok. Trend olusmasi icin en az iki olcum gerekli.",
            )

        stats = self._trend_stats(history)
        return WeightTrendSummary(
            first_log_date=stats.first_log_date,
            last_log_date=stats.last_log_date,
            log_count=stats.log_count,
            latest_weight_kg=stats.latest_weight_kg,
            start_weight_kg=stats.start_weight_kg,
            change_kg=stats.change_kg,
            change_percent=stats.change_percent,
            average_weekly_change_kg=stats.average_weekly_change_kg,
            direction=stats.direction,
            summary=self._trend_summary(stats),
        )

    def _build_predictions(
        self,
        goal: GoalType,
        history: list[StoredWeightLogEntry],
        trend: WeightTrendSummary,
    ) -> list[ProgressPrediction]:
        if len(history) < 2 or not trend.last_log_date or not trend.latest_weight_kg:
            return []
        if abs(trend.average_weekly_change_kg) < 0.01:
            rate = 0.0
        else:
            rate = trend.average_weekly_change_kg

        latest_date = date.fromisoformat(trend.last_log_date[:10])
        confidence = self._prediction_confidence(history, trend)
        predictions: list[ProgressPrediction] = []
        for horizon_days in (14, 28):
            projected_change = rate * (horizon_days / 7)
            projected_weight = max(round(trend.latest_weight_kg + projected_change, 2), 30.0)
            predicted_date = (latest_date + timedelta(days=horizon_days)).isoformat()
            predictions.append(
                ProgressPrediction(
                    horizon_days=horizon_days,
                    predicted_date=predicted_date,
                    predicted_weight_kg=projected_weight,
                    confidence=confidence,
                    summary=self._prediction_summary(goal, horizon_days, projected_weight, rate),
                )
            )
        return predictions

    def _detect_risks(
        self,
        goal: GoalType,
        history: list[StoredWeightLogEntry],
        trend: WeightTrendSummary,
    ) -> list[ProgressRiskSignal]:
        risks: list[ProgressRiskSignal] = []

        if len(history) < 2:
            return [
                ProgressRiskSignal(
                    code="insufficient_weight_data",
                    severity="medium",
                    message="Trend ve tahmin icin en az iki kilo olcumu gerekli.",
                )
            ]

        span_days = self._days_between(history[0].measured_at, history[-1].measured_at)
        if span_days < 7:
            risks.append(
                ProgressRiskSignal(
                    code="short_tracking_window",
                    severity="medium",
                    message="Olcum araligi 7 gunden kisa. Tahminler henuz dusuk guvenli.",
                )
            )

        rate = trend.average_weekly_change_kg
        if goal == "fat_loss":
            if rate > 0.1:
                risks.append(
                    ProgressRiskSignal(
                        code="goal_direction_mismatch",
                        severity="high",
                        message="Fat loss hedefinde agirlik yukari gidiyor. Enerji dengesi tekrar kontrol edilmeli.",
                    )
                )
            elif rate < -1.0:
                risks.append(
                    ProgressRiskSignal(
                        code="aggressive_weight_loss",
                        severity="high",
                        message="Kilo dususu cok hizli gorunuyor. Surdurulebilirlik ve toparlanma riski var.",
                    )
                )
            elif abs(rate) < 0.1 and span_days >= 14:
                risks.append(
                    ProgressRiskSignal(
                        code="fat_loss_plateau",
                        severity="medium",
                        message="Iki haftalik pencerede belirgin kilo dususu yok. Platea olabilir.",
                    )
                )
        elif goal == "muscle_gain":
            if rate < -0.1:
                risks.append(
                    ProgressRiskSignal(
                        code="goal_direction_mismatch",
                        severity="high",
                        message="Muscle gain hedefinde agirlik dusuyor. Kalori veya toparlanma yetersiz olabilir.",
                    )
                )
            elif rate > 0.6:
                risks.append(
                    ProgressRiskSignal(
                        code="aggressive_weight_gain",
                        severity="medium",
                        message="Kilo artis hizi yuksek. Fazla yagli artis riski olabilir.",
                    )
                )
        elif goal == "maintenance":
            if abs(rate) > 0.25:
                risks.append(
                    ProgressRiskSignal(
                        code="maintenance_drift",
                        severity="medium",
                        message="Maintenance hedefinde agirlik trendi belirgin kayiyor.",
                    )
                )
        elif goal == "recomposition":
            if rate > 0.25:
                risks.append(
                    ProgressRiskSignal(
                        code="recomposition_gain_drift",
                        severity="medium",
                        message="Recomposition icin kilo artisi beklenenden hizli.",
                    )
                )
            elif rate < -0.75:
                risks.append(
                    ProgressRiskSignal(
                        code="recomposition_loss_too_fast",
                        severity="medium",
                        message="Recomposition icin kilo dususu fazla hizli. Kas koruma riski olabilir.",
                    )
                )

        if self._is_volatile(history):
            risks.append(
                ProgressRiskSignal(
                    code="volatile_weight_data",
                    severity="low",
                    message="Olcumler dalgali. Tahminleri yorumlarken su, sodium ve zamanlama etkisini dusun.",
                )
            )

        if not risks:
            risks.append(
                ProgressRiskSignal(
                    code="on_track",
                    severity="low",
                    message="Mevcut trend hedefle uyumlu gorunuyor.",
                )
            )
        return risks

    def _derive_status(
        self,
        risks: list[ProgressRiskSignal],
        history: list[StoredWeightLogEntry],
    ) -> ProgressStatus:
        if len(history) < 2:
            return "needs_more_data"
        if any(risk.severity == "high" for risk in risks if risk.code != "on_track"):
            return "at_risk"
        if any(risk.code not in {"on_track", "volatile_weight_data"} for risk in risks):
            return "at_risk"
        return "on_track"

    def _trend_stats(self, history: list[StoredWeightLogEntry]) -> WeightTrendStats:
        if len(history) == 1:
            item = history[0]
            return WeightTrendStats(
                start_weight_kg=item.weight_kg,
                latest_weight_kg=item.weight_kg,
                change_kg=0.0,
                change_percent=0.0,
                average_weekly_change_kg=0.0,
                direction="stable",
                span_days=0,
                log_count=1,
                first_log_date=item.measured_at,
                last_log_date=item.measured_at,
            )

        span_days = max(self._days_between(history[0].measured_at, history[-1].measured_at), 1)
        start_weight = self._average_weight(history[: min(3, len(history))])
        latest_weight = self._average_weight(history[-min(3, len(history)) :])
        change_kg = round(latest_weight - start_weight, 2)
        change_percent = round((change_kg / start_weight) * 100, 2) if start_weight > 0 else 0.0
        average_weekly_change_kg = round((change_kg / span_days) * 7, 2)
        direction = "stable"
        if average_weekly_change_kg <= -0.1:
            direction = "down"
        elif average_weekly_change_kg >= 0.1:
            direction = "up"

        return WeightTrendStats(
            start_weight_kg=round(start_weight, 2),
            latest_weight_kg=round(latest_weight, 2),
            change_kg=change_kg,
            change_percent=change_percent,
            average_weekly_change_kg=average_weekly_change_kg,
            direction=direction,
            span_days=span_days,
            log_count=len(history),
            first_log_date=history[0].measured_at,
            last_log_date=history[-1].measured_at,
        )

    def _prediction_confidence(self, history: list[StoredWeightLogEntry], trend: WeightTrendSummary) -> str:
        if len(history) >= 6 and trend.log_count >= 6 and abs(trend.average_weekly_change_kg) >= 0.1:
            return "medium"
        if len(history) >= 3:
            return "low"
        return "very_low"

    def _prediction_summary(self, goal: GoalType, horizon_days: int, projected_weight: float, rate: float) -> str:
        direction_text = "stabil" if abs(rate) < 0.01 else ("dusmeye" if rate < 0 else "artmaya")
        return (
            f"Mevcut lineer trend korunursa {horizon_days} gun sonra tahmini kilo {projected_weight:.2f} kg. "
            f"Bu tahmin {goal} hedefine gore mevcut agirligin {direction_text} devam ettigi varsayimiyla uretilir."
        )

    def _trend_summary(self, stats: WeightTrendStats) -> str:
        if stats.log_count < 2:
            return "Henuz tek olcum var. Trend olusmasi icin ikinci kayit gerekli."
        if stats.direction == "stable":
            return (
                f"{stats.span_days} gunluk pencerede agirlik stabil. "
                f"Ortalama haftalik degisim {stats.average_weekly_change_kg:.2f} kg."
            )
        direction_text = "azalis" if stats.direction == "down" else "artis"
        return (
            f"{stats.span_days} gunluk pencerede net {abs(stats.change_kg):.2f} kg {direction_text} var. "
            f"Ortalama haftalik degisim {stats.average_weekly_change_kg:.2f} kg."
        )

    def _assumptions(self) -> list[str]:
        return [
            "Trend hesabinda ilk ve son 3 olcumun ortalamasi kullanilir; bu, gunluk su dalgalanmasini yumusatir.",
            "Prediction lineer trend varsayar; aktivite, sodium, menstrual cycle ve olcum saati modellenmez.",
            "Risk tespiti yalnizca kilo trendine dayanir; performans, aynadaki gorunum veya circumference datasi dahil degildir.",
        ]

    def _average_weight(self, entries: list[StoredWeightLogEntry]) -> float:
        return sum(item.weight_kg for item in entries) / max(len(entries), 1)

    def _days_between(self, left: str, right: str) -> int:
        left_date = datetime.fromisoformat(left.replace("Z", "+00:00")).date()
        right_date = datetime.fromisoformat(right.replace("Z", "+00:00")).date()
        return (right_date - left_date).days

    def _is_volatile(self, history: list[StoredWeightLogEntry]) -> bool:
        if len(history) < 3:
            return False
        jumps = []
        for previous, current in zip(history, history[1:]):
            day_gap = max(self._days_between(previous.measured_at, current.measured_at), 1)
            daily_jump = abs(current.weight_kg - previous.weight_kg) / day_gap
            jumps.append(daily_jump)
        return max(jumps, default=0.0) >= 0.8

    def _should_drop_seed_entry(
        self,
        profile: StoredUserProfile,
        history: list[StoredWeightLogEntry],
        measured_at: str,
    ) -> bool:
        if len(history) != 1:
            return False
        seed = history[0]
        if seed.measured_at != profile.created_at or seed.created_at != profile.created_at:
            return False
        if abs(seed.weight_kg - profile.weight_kg) > 0.001:
            return False
        return measured_at != seed.measured_at
