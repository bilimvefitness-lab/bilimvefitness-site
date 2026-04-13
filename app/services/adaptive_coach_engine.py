from dataclasses import dataclass
from datetime import date, datetime, time, timedelta

from app.schemas.nutrition import (
    BehaviorSignal,
    BehaviorStreaks,
    ConfidenceSummary,
    DailyBehaviorScore,
    DailyCoachResponse,
    DailyMetricAnalysis,
    PrimeBehaviorMemory,
    PrimeCoachMode,
    PrimeCoachOutput,
    PrimePredictionSignal,
    WeeklyTrendPoint,
    WeeklyTrendSummary,
)
from app.schemas.sleep import SleepCoachContext
from app.schemas.steps import StepActivityContext


@dataclass(frozen=True, slots=True)
class CoachDaySnapshot:
    date: str
    actual_kcal: float
    actual_protein_g: float
    meal_count: int
    calorie_difference_kcal: float
    protein_gap_g: float
    logged: bool


@dataclass(frozen=True, slots=True)
class CoachMealEvent:
    date: str
    meal_type: str
    consumed_at: str
    total_kcal: float
    total_protein_g: float


class AdaptiveCoachEngine:
    def build_daily_coach(
        self,
        *,
        analysis_date: str,
        protein_target_g: float,
        calorie_target_kcal: float,
        actual_protein_g: float,
        actual_kcal: float,
        meal_count: int,
        historical_days: list[CoachDaySnapshot],
        historical_meals: list[CoachMealEvent],
        mode: PrimeCoachMode = "balanced",
        behavior_score: DailyBehaviorScore | None = None,
        streaks: BehaviorStreaks | None = None,
        confidence_overview: ConfidenceSummary | None = None,
        sleep_context: SleepCoachContext | None = None,
        step_activity: StepActivityContext | None = None,
    ) -> DailyCoachResponse:
        protein_gap = round(actual_protein_g - protein_target_g, 2)
        calorie_difference = round(actual_kcal - calorie_target_kcal, 2)

        protein_status = self._protein_status(actual_protein_g, protein_target_g)
        calorie_balance = self._calorie_balance(calorie_difference)

        daily_analysis = [
            DailyMetricAnalysis(
                metric="protein",
                target=round(protein_target_g, 2),
                actual=round(actual_protein_g, 2),
                difference=protein_gap,
                adherence_ratio=self._safe_ratio(actual_protein_g, protein_target_g),
                status=protein_status,
                summary=self._protein_summary(actual_protein_g, protein_target_g, protein_status),
            ),
            DailyMetricAnalysis(
                metric="calories",
                target=round(calorie_target_kcal, 2),
                actual=round(actual_kcal, 2),
                difference=calorie_difference,
                adherence_ratio=self._calorie_adherence(actual_kcal, calorie_target_kcal),
                status=calorie_balance,
                summary=self._calorie_summary(actual_kcal, calorie_target_kcal, calorie_balance),
            ),
        ]

        weekly_trend = self._build_weekly_trend(
            analysis_date=analysis_date,
            days=historical_days,
            calorie_target_kcal=calorie_target_kcal,
            protein_target_g=protein_target_g,
        )
        behavior_signals = self._detect_behaviors(
            days=historical_days,
            calorie_target_kcal=calorie_target_kcal,
            protein_target_g=protein_target_g,
            behavior_score=behavior_score,
            streaks=streaks,
            confidence_overview=confidence_overview,
        )
        behavior_memory = self._build_behavior_memory(
            analysis_date=analysis_date,
            historical_days=historical_days,
            historical_meals=historical_meals,
            protein_target_g=protein_target_g,
            calorie_target_kcal=calorie_target_kcal,
            behavior_score=behavior_score,
        )
        prediction_signals = self._build_prediction_signals(
            historical_days=historical_days,
            historical_meals=historical_meals,
            analysis_date=analysis_date,
            protein_target_g=protein_target_g,
            calorie_target_kcal=calorie_target_kcal,
            behavior_memory=behavior_memory,
        )
        coaching_focus = self._determine_focus(
            protein_status=protein_status,
            calorie_balance=calorie_balance,
            behavior_signals=behavior_signals,
            behavior_score=behavior_score,
            streaks=streaks,
        )
        prime = self._build_prime_output(
            mode=mode,
            actual_protein_g=actual_protein_g,
            protein_target_g=protein_target_g,
            actual_kcal=actual_kcal,
            calorie_target_kcal=calorie_target_kcal,
            meal_count=meal_count,
            prediction_signals=prediction_signals,
            behavior_memory=behavior_memory,
            behavior_score=behavior_score,
            confidence_overview=confidence_overview,
        )
        suggestions = self._build_suggestions(
            protein_status=protein_status,
            calorie_balance=calorie_balance,
            meal_count=meal_count,
            behavior_signals=behavior_signals,
            behavior_score=behavior_score,
            confidence_overview=confidence_overview,
            sleep_context=sleep_context,
            step_activity=step_activity,
        )
        coaching_message = self._build_coaching_message(
            coaching_focus=coaching_focus,
            protein_target_g=protein_target_g,
            actual_protein_g=actual_protein_g,
            calorie_target_kcal=calorie_target_kcal,
            actual_kcal=actual_kcal,
            weekly_trend=weekly_trend,
            behavior_signals=behavior_signals,
            behavior_score=behavior_score,
            streaks=streaks,
            confidence_overview=confidence_overview,
            prime=prime,
            sleep_context=sleep_context,
            step_activity=step_activity,
        )

        return DailyCoachResponse(
            date=analysis_date,
            protein_target_g=round(protein_target_g, 2),
            actual_protein_g=round(actual_protein_g, 2),
            protein_gap_g=protein_gap,
            protein_status=protein_status,
            calorie_target_kcal=round(calorie_target_kcal, 2),
            actual_kcal=round(actual_kcal, 2),
            calorie_difference_kcal=calorie_difference,
            calorie_balance=calorie_balance,
            suggestions=suggestions,
            coaching_message=coaching_message,
            coaching_focus=coaching_focus,
            daily_analysis=daily_analysis,
            weekly_trend=weekly_trend,
            behavior_signals=behavior_signals,
            behavior_score=behavior_score,
            streaks=streaks,
            confidence_overview=confidence_overview,
            behavior_memory=behavior_memory,
            prediction_signals=prediction_signals,
            prime=prime,
            sleep=sleep_context,
            step_activity=step_activity,
        )

    def build_history_window(
        self,
        *,
        analysis_date: str,
        calorie_target_kcal: float,
        protein_target_g: float,
        meals: list[tuple[str, float, float, int]],
    ) -> list[CoachDaySnapshot]:
        target_date = date.fromisoformat(analysis_date)
        day_map = {
            item_date: {
                "actual_kcal": total_kcal,
                "actual_protein_g": total_protein_g,
                "meal_count": meal_count,
            }
            for item_date, total_kcal, total_protein_g, meal_count in meals
        }

        snapshots: list[CoachDaySnapshot] = []
        for offset in range(6, -1, -1):
            current_date = (target_date - timedelta(days=offset)).isoformat()
            current = day_map.get(current_date)
            actual_kcal = float(current["actual_kcal"]) if current else 0.0
            actual_protein_g = float(current["actual_protein_g"]) if current else 0.0
            meal_count = int(current["meal_count"]) if current else 0
            logged = current is not None
            snapshots.append(
                CoachDaySnapshot(
                    date=current_date,
                    actual_kcal=round(actual_kcal, 2),
                    actual_protein_g=round(actual_protein_g, 2),
                    meal_count=meal_count,
                    calorie_difference_kcal=round(actual_kcal - calorie_target_kcal, 2),
                    protein_gap_g=round(protein_target_g - actual_protein_g, 2),
                    logged=logged,
                )
            )
        return snapshots

    def build_meal_events(self, meals: list[tuple[str, str, str, float, float]]) -> list[CoachMealEvent]:
        events = [
            CoachMealEvent(
                date=item_date,
                meal_type=meal_type,
                consumed_at=consumed_at,
                total_kcal=round(total_kcal, 2),
                total_protein_g=round(total_protein_g, 2),
            )
            for item_date, meal_type, consumed_at, total_kcal, total_protein_g in meals
        ]
        events.sort(key=lambda item: item.consumed_at)
        return events

    def _build_weekly_trend(
        self,
        *,
        analysis_date: str,
        days: list[CoachDaySnapshot],
        calorie_target_kcal: float,
        protein_target_g: float,
    ) -> WeeklyTrendSummary:
        logged_days = [day for day in days if day.logged]
        avg_kcal = round(sum(day.actual_kcal for day in logged_days) / len(logged_days), 2) if logged_days else 0.0
        avg_protein = (
            round(sum(day.actual_protein_g for day in logged_days) / len(logged_days), 2) if logged_days else 0.0
        )
        avg_calorie_difference = (
            round(sum(day.calorie_difference_kcal for day in logged_days) / len(logged_days), 2)
            if logged_days
            else 0.0
        )
        avg_protein_gap = (
            round(sum(day.protein_gap_g for day in logged_days) / len(logged_days), 2) if logged_days else 0.0
        )
        on_target_days = sum(
            1
            for day in logged_days
            if day.actual_protein_g >= protein_target_g * 0.9 and abs(day.calorie_difference_kcal) <= 200
        )
        trend_direction = self._trend_direction(logged_days)
        summary = self._weekly_summary_text(
            logged_days=len(logged_days),
            avg_calorie_difference=avg_calorie_difference,
            avg_protein_gap=avg_protein_gap,
            on_target_days=on_target_days,
            trend_direction=trend_direction,
            calorie_target_kcal=calorie_target_kcal,
            protein_target_g=protein_target_g,
        )

        return WeeklyTrendSummary(
            start_date=days[0].date if days else analysis_date,
            end_date=analysis_date,
            days_logged=len(logged_days),
            average_kcal=avg_kcal,
            average_protein_g=avg_protein,
            average_calorie_difference_kcal=avg_calorie_difference,
            average_protein_gap_g=avg_protein_gap,
            on_target_days=on_target_days,
            trend_direction=trend_direction,
            summary=summary,
            daily_points=[
                WeeklyTrendPoint(
                    date=day.date,
                    actual_kcal=day.actual_kcal,
                    actual_protein_g=day.actual_protein_g,
                    meal_count=day.meal_count,
                    calorie_difference_kcal=day.calorie_difference_kcal,
                    protein_gap_g=day.protein_gap_g,
                    logged=day.logged,
                )
                for day in days
            ],
        )

    def _detect_behaviors(
        self,
        *,
        days: list[CoachDaySnapshot],
        calorie_target_kcal: float,
        protein_target_g: float,
        behavior_score: DailyBehaviorScore | None,
        streaks: BehaviorStreaks | None,
        confidence_overview: ConfidenceSummary | None,
    ) -> list[BehaviorSignal]:
        signals: list[BehaviorSignal] = []
        logged_days = [day for day in days if day.logged]
        recent_logged = logged_days[-3:]

        if len(logged_days) <= 2:
            signals.append(
                BehaviorSignal(
                    code="logging_consistency_low",
                    severity="high",
                    message="Kayit cok seyrek. Sonraki ogunu aninda gir.",
                )
            )
        elif len(logged_days) <= 4:
            signals.append(
                BehaviorSignal(
                    code="logging_consistency_low",
                    severity="medium",
                    message="Kayit parcali. Her ogunu bekletmeden gir.",
                )
            )

        if len(recent_logged) == 3 and all(day.actual_protein_g < protein_target_g * 0.9 for day in recent_logged):
            signals.append(
                BehaviorSignal(
                    code="protein_consistency_low",
                    severity="high",
                    message="Protein 3 gundur geride. Simdi protein ekle.",
                )
            )

        surplus_days = [day for day in logged_days if day.calorie_difference_kcal >= 200]
        if len(surplus_days) >= 4:
            signals.append(
                BehaviorSignal(
                    code="calorie_surplus_pattern",
                    severity="high" if len(surplus_days) >= 5 else "medium",
                    message="Kalori hafta boyunca tasiyor. Ekstra kaloriyi kes.",
                )
            )

        deficit_days = [day for day in logged_days if day.calorie_difference_kcal <= -250]
        if len(deficit_days) >= 4:
            signals.append(
                BehaviorSignal(
                    code="underfueling_pattern",
                    severity="medium",
                    message="Acik birikiyor. Bugun toparlanacak kadar ye.",
                )
            )

        if len(logged_days) >= 3:
            average_meal_count = sum(day.meal_count for day in logged_days) / len(logged_days)
            if average_meal_count < 2:
                signals.append(
                    BehaviorSignal(
                        code="meal_skipping_pattern",
                        severity="medium",
                        message="Ogun atliyorsun. Sonraki ogunu geciktirme.",
                    )
                )

        if behavior_score and behavior_score.total < 60:
            signals.append(
                BehaviorSignal(
                    code="low_daily_score",
                    severity="high" if behavior_score.total < 45 else "medium",
                    message=(
                        f"Skor {behavior_score.total}/100. "
                        f"Simdi {self._component_label(behavior_score.priority_component)} duzelt."
                    ),
                )
            )

        if streaks and streaks.logging.count == 0 and any(day.logged for day in days[:-1]):
            signals.append(
                BehaviorSignal(
                    code="low_logging_streak",
                    severity="medium",
                    message="Log serisi kirik. Sonraki ogunu simdi kaydet.",
                )
            )

        if confidence_overview and confidence_overview.score < 70 and logged_days:
            signals.append(
                BehaviorSignal(
                    code="low_confidence_logging",
                    severity="medium",
                    message="Kayit netligi dusuk. Sonraki girisi gramla yap.",
                )
            )

        if not signals:
            signals.append(
                BehaviorSignal(
                    code="on_track",
                    severity="low",
                    message="Ritim iyi. Bugunu bozma.",
                )
            )

        return signals

    def _determine_focus(
        self,
        *,
        protein_status: str,
        calorie_balance: str,
        behavior_signals: list[BehaviorSignal],
        behavior_score: DailyBehaviorScore | None,
        streaks: BehaviorStreaks | None,
    ) -> str:
        top_signal = behavior_signals[0].code if behavior_signals else "on_track"
        if behavior_score and behavior_score.total < 60 and behavior_score.priority_component == "logging":
            return "logging_consistency"
        if streaks and streaks.logging.count == 0 and top_signal == "low_logging_streak":
            return "logging_consistency"
        if protein_status == "low" and calorie_balance == "surplus":
            return "rebalance_day"
        if protein_status == "low":
            return "protein_recovery"
        if calorie_balance == "surplus":
            return "calorie_control"
        if calorie_balance == "deficit":
            return "fueling_support"
        if top_signal == "protein_consistency_low":
            return "protein_consistency"
        if top_signal == "logging_consistency_low":
            return "logging_consistency"
        return "maintain"

    def _build_behavior_memory(
        self,
        *,
        analysis_date: str,
        historical_days: list[CoachDaySnapshot],
        historical_meals: list[CoachMealEvent],
        protein_target_g: float,
        calorie_target_kcal: float,
        behavior_score: DailyBehaviorScore | None,
    ) -> PrimeBehaviorMemory:
        days = historical_days[-7:]
        late_eating_days = len(
            {
                meal.date
                for meal in historical_meals
                if self._days_ago(analysis_date, meal.date) <= 6 and self._is_late_meal(meal.consumed_at)
            }
        )
        skipped_meal_days = sum(1 for day in days if day.logged and day.meal_count <= 1)
        low_compliance_days = sum(
            1
            for day in days
            if day.logged and (day.actual_protein_g < protein_target_g * 0.9 or abs(day.calorie_difference_kcal) >= 200)
        )
        inconsistent_tracking = sum(1 for day in days if day.logged) <= 4 or self._has_tracking_gaps(days)

        notes: list[str] = []
        if late_eating_days >= 3:
            notes.append("Aksam kalorisi gec saate kayiyor.")
        if skipped_meal_days >= 2:
            notes.append("Ogun atlama paterni var.")
        if low_compliance_days >= 3:
            notes.append("Son hafta hedef uyumu dusuk.")
        if inconsistent_tracking:
            notes.append("Kayit ritmi dalgali.")
        if behavior_score and behavior_score.total < 60:
            notes.append("Gunluk skor kirilgan.")

        dominant_pattern = "istikrar iyi"
        pattern_candidates = [
            ("late_eating", late_eating_days),
            ("skipped_meals", skipped_meal_days),
            ("low_compliance", low_compliance_days),
            ("inconsistent_tracking", 3 if inconsistent_tracking else 0),
        ]
        top_pattern, top_value = max(pattern_candidates, key=lambda item: item[1])
        if top_value > 0:
            dominant_pattern = {
                "late_eating": "gec yeme paterni",
                "skipped_meals": "ogun atlama paterni",
                "low_compliance": "dusuk uyum paterni",
                "inconsistent_tracking": "duzensiz kayit paterni",
            }[top_pattern]

        return PrimeBehaviorMemory(
            window_days=len(days) or 7,
            late_eating_days=late_eating_days,
            skipped_meal_days=skipped_meal_days,
            low_compliance_days=low_compliance_days,
            inconsistent_tracking=inconsistent_tracking,
            dominant_pattern=dominant_pattern,
            notes=notes[:4],
        )

    def _build_prediction_signals(
        self,
        *,
        historical_days: list[CoachDaySnapshot],
        historical_meals: list[CoachMealEvent],
        analysis_date: str,
        protein_target_g: float,
        calorie_target_kcal: float,
        behavior_memory: PrimeBehaviorMemory,
    ) -> list[PrimePredictionSignal]:
        signals: list[PrimePredictionSignal] = []
        recent_logged = [day for day in historical_days if day.logged][-3:]

        if len(recent_logged) == 3 and all(day.actual_protein_g < protein_target_g * 0.9 for day in recent_logged):
            signals.append(
                PrimePredictionSignal(
                    code="low_protein_streak",
                    label="Protein sarkmasi",
                    message="Aksam proteini yine eksik kalma riski tasiyor.",
                    risk_level="high",
                    confidence=0.92,
                )
            )

        if len(recent_logged) >= 2 and all(day.calorie_difference_kcal >= 150 for day in recent_logged):
            signals.append(
                PrimePredictionSignal(
                    code="calorie_overflow_trend",
                    label="Kalori tasma trendi",
                    message="Kalori tasmasi bugun de tekrar etme egiliminde.",
                    risk_level="high" if len(recent_logged) == 3 else "medium",
                    confidence=0.91 if len(recent_logged) == 3 else 0.86,
                )
            )

        if behavior_memory.skipped_meal_days >= 2:
            signals.append(
                PrimePredictionSignal(
                    code="skipped_meals",
                    label="Ogun atlama",
                    message="Bugun aksami hafif gecistirme riski var.",
                    risk_level="medium",
                    confidence=0.78,
                )
            )

        if behavior_memory.late_eating_days >= 3:
            signals.append(
                PrimePredictionSignal(
                    code="late_eating",
                    label="Gec yemek",
                    message="Kaloriyi geceye birakma paterni tekrar ediyor.",
                    risk_level="medium",
                    confidence=0.74,
                )
            )

        if behavior_memory.inconsistent_tracking:
            signals.append(
                PrimePredictionSignal(
                    code="inconsistent_tracking",
                    label="Kayit kopmasi",
                    message="Bugun kayit gecikirse gun kontrolden cikar.",
                    risk_level="medium",
                    confidence=0.7,
                )
            )

        if not signals:
            signals.append(
                PrimePredictionSignal(
                    code="stable_day",
                    label="Stabil gun",
                    message="Bugun ana risk dusuk; ritmi koru.",
                    risk_level="low",
                    confidence=0.82,
                )
            )

        signals.sort(key=lambda item: (self._risk_rank(item.risk_level), item.confidence), reverse=True)
        return signals[:4]

    def _build_prime_output(
        self,
        *,
        mode: PrimeCoachMode,
        actual_protein_g: float,
        protein_target_g: float,
        actual_kcal: float,
        calorie_target_kcal: float,
        meal_count: int,
        prediction_signals: list[PrimePredictionSignal],
        behavior_memory: PrimeBehaviorMemory,
        behavior_score: DailyBehaviorScore | None,
        confidence_overview: ConfidenceSummary | None,
    ) -> PrimeCoachOutput:
        protein_gap = round(max(protein_target_g - actual_protein_g, 0.0), 1)
        calorie_difference = round(actual_kcal - calorie_target_kcal, 1)
        lead_signal = prediction_signals[0]

        if lead_signal.code == "low_protein_streak":
            message = self._tone_line(mode, "Aksam proteinini simdi kilitle.")
            actions = [
                f"Bir sonraki ogune {int(max(protein_gap, 25))} g protein ekle",
                "Whey, yogurt veya tavukla acigi kapat",
                "Kaloriyi yaga degil proteine harca",
            ]
            reason = "Son 3 gunde protein aksama sarkti."
        elif lead_signal.code == "calorie_overflow_trend" and protein_gap > 10:
            message = self._tone_line(mode, "Proteini yukari cek, kaloriyi tasirma.")
            actions = [
                "Yagisiz protein sec",
                "Ekmek, sos ve kuruyemisi bugun kis",
                "Aksam porsiyonunu yarim kademe kucult",
            ]
            reason = "Kalori trendi yukari, protein hala geride."
        elif lead_signal.code == "calorie_overflow_trend":
            message = self._tone_line(mode, "Kalori tasmasini bugun durdur.")
            actions = [
                "Aksam yagli ekleri kes",
                "Tatli veya ekstra ekmegi acma",
                "Son ogunu protein + sebzeyle kapat",
            ]
            reason = "Son gunlerde kalori fazlasi tekrar ediyor."
        elif lead_signal.code == "skipped_meals":
            message = self._tone_line(mode, "Aksami atlama, duzeni simdi kur.")
            actions = [
                "Planli bir ogun ekle",
                "En az 30 g protein koy",
                "Acele atistirma yerine net porsiyon sec",
            ]
            reason = "Son hafta ogun atlaniyor."
        elif lead_signal.code == "late_eating":
            message = self._tone_line(mode, "Kaloriyi geceye birakma.")
            actions = [
                "Ana kaloriyi gun icine cek",
                "Aksam hafif ve protein odakli kal",
                "Gece atistirmasini kapat",
            ]
            reason = "Gec yeme paterni son 7 gunde tekrar ediyor."
        elif behavior_memory.inconsistent_tracking:
            message = self._tone_line(mode, "Logu geciktirme, gunu simdi sabitle.")
            actions = [
                "Sonraki ogunu aninda gir",
                "Tahmini degil net porsiyon sec",
                "Bugunu bos gecirme",
            ]
            reason = "Kayit ritmi kiriliyor."
        elif calorie_difference <= -150 and protein_gap <= 10:
            message = self._tone_line(mode, "Bugun kontrollu yakit ekle.")
            actions = [
                "Bir ara ogun ekle",
                "Protein + karbonhidrat birlikte kullan",
                "Acigi gereksiz buyutme",
            ]
            reason = "Kalori acigi hedefin altina indi."
        else:
            message = self._tone_line(mode, "Ritmi koru, fazladan hamle acma.")
            actions = [
                "Plani aynen surdur",
                "Ekstra atistirma ekleme",
                "Gunu net kayitla kapat",
            ]
            reason = "Bugun ana risk dusuk."

        if meal_count <= 1 and actions[0] != "Planli bir ogun ekle":
            actions[0] = "Bir ogun daha planla ve gir"
        if confidence_overview and confidence_overview.score < 70:
            actions[-1] = "Sonraki giriste gram kullan"

        return PrimeCoachOutput(
            mode=mode,
            message=message,
            actions=actions[:3],
            reason=reason,
            risk_level=lead_signal.risk_level,
            confidence=self._prime_confidence(
                lead_confidence=lead_signal.confidence,
                behavior_score=behavior_score,
                confidence_overview=confidence_overview,
            ),
        )

    def _build_suggestions(
        self,
        *,
        protein_status: str,
        calorie_balance: str,
        meal_count: int,
        behavior_signals: list[BehaviorSignal],
        behavior_score: DailyBehaviorScore | None,
        confidence_overview: ConfidenceSummary | None,
        sleep_context: SleepCoachContext | None,
        step_activity: StepActivityContext | None,
    ) -> list[str]:
        suggestions: list[str] = []
        signal_codes = {signal.code for signal in behavior_signals}

        if protein_status == "low":
            suggestions.append("Simdi 25-35 g protein ekle: tavuk, yogurt, lor veya whey sec.")
        if calorie_balance == "surplus":
            suggestions.append("Bugun sosu, kuruyemisi, ekstra ekmegi ve tatliyi kes.")
        elif calorie_balance == "deficit":
            suggestions.append("Bugun kontrollu karbonhidrat ekle. Acigi buyutme.")

        if meal_count <= 1:
            suggestions.append("Bugun bir ogun daha gir. Eksik kaydi kapat.")
        if "protein_consistency_low" in signal_codes:
            suggestions.append("Her ana ogune protein koy: yumurta, yogurt, tavuk veya kofte.")
        if "logging_consistency_low" in signal_codes:
            suggestions.append("Seriyi kur. En az 5 gun ust uste kayit al.")
        if "calorie_surplus_pattern" in signal_codes:
            suggestions.append("Her gun tekrar eden fazla kaloriyi bugun kes.")
        if "underfueling_pattern" in signal_codes:
            suggestions.append("Hedefe yakin ye. Acigi surukleme.")
        if behavior_score and behavior_score.total < 60:
            suggestions.append(f"Bugun once {self._component_label(behavior_score.priority_component)} duzelt.")
        if "low_logging_streak" in signal_codes:
            suggestions.append("Sonraki ogunu bekletmeden kaydet. Seriyi bugun baslat.")
        if confidence_overview and confidence_overview.score < 70:
            suggestions.append("Sonraki giriste gram veya net porsiyon sec.")
        if sleep_context and sleep_context.available:
            if sleep_context.recovery_signal == "low":
                suggestions.append("Son uyku kisa gorunuyor. Bugun plani sade tut ve plansiz atistirmayi acma.")
            elif sleep_context.recovery_signal == "moderate":
                suggestions.append("Uyku hedef bandinin altinda gorunuyor. Bugun ogun ritmini ve suyu aksatma.")
            if (
                sleep_context.trend_3d_average is not None
                and sleep_context.trend_7d_average is not None
                and sleep_context.trend_3d_average + 20 < sleep_context.trend_7d_average
            ):
                suggestions.append("Son 3 gunde uyku suresi asagi geliyor. Bugun toparlanmayi oncele.")
            if sleep_context.sleep_consistency_flag == "delayed":
                suggestions.append("Yatis saati gecikiyor gibi gorunuyor. Aksam rutinini biraz erkene cek.")
        if step_activity and step_activity.available:
            if step_activity.activity_level in {"very_low", "low"}:
                suggestions.append("Bugun adim dusuk. 10-15 dakikalik yuruyus ekle.")
            if step_activity.activity_level in {"good", "very_high"}:
                suggestions.append("Bugun hareket yuksek. Suyu ve enerjiyi geciktirme.")
            if step_activity.trend_direction == "down":
                suggestions.append("Son 3 gunde hareket dusuyor. Uzun oturma bloklarini bol.")

        if not suggestions:
            suggestions.append("Plan iyi gidiyor. Bugunu ayni disiplinle kapat.")

        return suggestions[:4]

    def _build_coaching_message(
        self,
        *,
        coaching_focus: str,
        protein_target_g: float,
        actual_protein_g: float,
        calorie_target_kcal: float,
        actual_kcal: float,
        weekly_trend: WeeklyTrendSummary,
        behavior_signals: list[BehaviorSignal],
        behavior_score: DailyBehaviorScore | None,
        streaks: BehaviorStreaks | None,
        confidence_overview: ConfidenceSummary | None,
        prime: PrimeCoachOutput | None,
        sleep_context: SleepCoachContext | None,
        step_activity: StepActivityContext | None,
    ) -> str:
        if prime is not None:
            extra_notes: list[str] = []
            if sleep_context and sleep_context.available:
                if sleep_context.recovery_signal == "low":
                    extra_notes.append("Son uyku kisa gorunuyor; bugunu biraz daha sade tut.")
                elif sleep_context.recovery_signal == "moderate":
                    extra_notes.append("Uyku hedef bandinin altinda gorunuyor; ritmi koru.")
            if step_activity and step_activity.available and step_activity.coach_message_hint:
                extra_notes.append(step_activity.coach_message_hint)
            if extra_notes:
                return f"PRIME: {prime.message} {' '.join(extra_notes)}"
            return f"PRIME: {prime.message}"
        if sleep_context and sleep_context.available and sleep_context.recovery_signal == "low":
            return (
                f"Son uyku kisa gorunuyor ({sleep_context.total_sleep_minutes} dk). "
                "Bugun toparlanmayi koruyacak kadar sade kal."
            )
        if sleep_context and sleep_context.available and sleep_context.recovery_signal == "moderate":
            return (
                f"Son uyku hedef bandinin altinda gorunuyor ({sleep_context.total_sleep_minutes} dk). "
                "Bugun ritmi sade tut."
            )
        if step_activity and step_activity.available and step_activity.activity_level in {"very_low", "low"}:
            return (
                f"Bugun {step_activity.activity_label} harekettesin ({step_activity.step_count} adim). "
                f"{step_activity.coach_message_hint}"
            )
        if step_activity and step_activity.available and step_activity.activity_level in {"good", "very_high"}:
            return (
                f"Bugun hareket {step_activity.activity_label} ({step_activity.step_count} adim). "
                f"{step_activity.coach_message_hint}"
            )
        lead_signal = behavior_signals[0].message if behavior_signals else "Ritim iyi. Bugunu bozma."
        if behavior_score and behavior_score.total < 60:
            return f"Skor {behavior_score.total}/100. Simdi {self._component_label(behavior_score.priority_component)} duzelt. {lead_signal}"
        if coaching_focus == "rebalance_day":
            return (
                f"Bugun denge bozuk: protein {actual_protein_g:.0f}/{protein_target_g:.0f} g, "
                f"kalori {actual_kcal:.0f}/{calorie_target_kcal:.0f} kcal. "
                f"Simdi yagisiz protein ekle, ekstra kaloriyi kes."
            )
        if coaching_focus == "protein_recovery":
            return f"Simdi 25-35 g protein ekle. Bugun {actual_protein_g:.0f}/{protein_target_g:.0f} g'dasin."
        if coaching_focus == "calorie_control":
            return f"Bugun kaloriyi durdur. Kalan ogunlerde protein ve sebze disina cikma."
        if coaching_focus == "fueling_support":
            return f"Bugun acigi buyutme. Sonraki ogune kontrollu karbonhidrat ekle."
        if coaching_focus == "logging_consistency":
            if streaks and streaks.logging.count == 0:
                return "Log serisi kirik. Sonraki ogunu simdi kaydet."
            return "Kaydi siklastir. Bugun her ogunu bekletmeden gir."
        if confidence_overview and confidence_overview.score < 70:
            return f"Kayit netligi {confidence_overview.score}/100. Sonraki girisi gramla yap."
        if streaks and streaks.protein_target.count >= 3:
            return f"Protein serin {streaks.protein_target.count} gun. Seriyi bugun bozma."
        if step_activity and step_activity.available and step_activity.coach_message_hint:
            return step_activity.coach_message_hint
        return "Hedefe yakin gidiyorsun. Plani bozma."

    def _trend_direction(self, logged_days: list[CoachDaySnapshot]) -> str:
        if len(logged_days) < 4:
            return "stable"

        recent = logged_days[-3:]
        earlier = logged_days[:-3]
        recent_score = self._consistency_score(recent)
        earlier_score = self._consistency_score(earlier)
        if recent_score <= earlier_score - 0.08:
            return "improving"
        if recent_score >= earlier_score + 0.08:
            return "drifting"
        return "stable"

    def _weekly_summary_text(
        self,
        *,
        logged_days: int,
        avg_calorie_difference: float,
        avg_protein_gap: float,
        on_target_days: int,
        trend_direction: str,
        calorie_target_kcal: float,
        protein_target_g: float,
    ) -> str:
        if logged_days == 0:
            return "Son 7 gunde kayit yok. Haftalik trend olusmadi."

        calorie_phrase = (
            "kaloride hedefe yakin"
            if abs(avg_calorie_difference) <= 150
            else ("kalori hedefin ustunde" if avg_calorie_difference > 0 else "kalori hedefin altinda")
        )
        protein_phrase = (
            "protein ritmi iyi"
            if avg_protein_gap <= protein_target_g * 0.1
            else "protein hedefi duzenli olarak geride kaliyor"
        )
        trend_phrase = {
            "improving": "Son gunlerde uyum toparlaniyor.",
            "drifting": "Son gunlerde hedeflerden uzaklasma var.",
            "stable": "Trend simdilik stabil.",
        }[trend_direction]
        return (
            f"Son 7 gunde {logged_days} gun kayit var, {on_target_days} gun hem protein hem kalori bandina yakinsin. "
            f"Ortalama {calorie_phrase} ve {protein_phrase}. {trend_phrase}"
        )

    def _consistency_score(self, days: list[CoachDaySnapshot]) -> float:
        if not days:
            return 1.0
        protein_component = sum(max(day.protein_gap_g, 0.0) for day in days) / max(len(days), 1)
        calorie_component = sum(abs(day.calorie_difference_kcal) for day in days) / max(len(days), 1)
        return min((protein_component / 60.0) + (calorie_component / 600.0), 1.5)

    def _component_label(self, key: str) -> str:
        if key == "protein":
            return "protein"
        if key == "calories":
            return "kalori dengesini"
        return "kayit tamligini"

    def _protein_status(self, actual_protein_g: float, protein_target_g: float) -> str:
        ratio = self._safe_ratio(actual_protein_g, protein_target_g)
        if ratio < 0.85:
            return "low"
        if ratio < 1.0:
            return "close"
        if ratio <= 1.2:
            return "on_target"
        return "above_target"

    def _calorie_balance(self, calorie_difference: float) -> str:
        if calorie_difference <= -250:
            return "deficit"
        if calorie_difference >= 250:
            return "surplus"
        return "near_target"

    def _protein_summary(self, actual: float, target: float, status: str) -> str:
        if status == "low":
            return f"Protein belirgin dusuk: {actual:.0f}/{target:.0f} g."
        if status == "close":
            return f"Protein hedefe yakin: {actual:.0f}/{target:.0f} g."
        if status == "above_target":
            return f"Protein hedefin ustunde: {actual:.0f}/{target:.0f} g."
        return f"Protein hedef bandinda: {actual:.0f}/{target:.0f} g."

    def _calorie_summary(self, actual: float, target: float, status: str) -> str:
        if status == "deficit":
            return f"Kalori hedefin altinda: {actual:.0f}/{target:.0f} kcal."
        if status == "surplus":
            return f"Kalori hedefin ustunde: {actual:.0f}/{target:.0f} kcal."
        return f"Kalori hedefe yakin: {actual:.0f}/{target:.0f} kcal."

    def _safe_ratio(self, actual: float, target: float) -> float:
        if target <= 0:
            return 1.0
        return round(actual / target, 3)

    def _calorie_adherence(self, actual: float, target: float) -> float:
        if target <= 0:
            return 1.0
        return round(max(0.0, 1 - (abs(actual - target) / target)), 3)

    def _has_tracking_gaps(self, days: list[CoachDaySnapshot]) -> bool:
        recent = [day.logged for day in days[-7:]]
        gap_count = 0
        for previous, current in zip(recent, recent[1:], strict=False):
            if previous and not current:
                gap_count += 1
        return gap_count >= 2

    def _is_late_meal(self, consumed_at: str) -> bool:
        try:
            parsed = datetime.fromisoformat(consumed_at.replace("Z", "+00:00"))
        except ValueError:
            return False
        return parsed.timetz().replace(tzinfo=None) >= time(21, 0)

    def _days_ago(self, analysis_date: str, compared_date: str) -> int:
        return (date.fromisoformat(analysis_date) - date.fromisoformat(compared_date)).days

    def _risk_rank(self, risk_level: str) -> int:
        return {"low": 1, "medium": 2, "high": 3}.get(risk_level, 0)

    def _prime_confidence(
        self,
        *,
        lead_confidence: float,
        behavior_score: DailyBehaviorScore | None,
        confidence_overview: ConfidenceSummary | None,
    ) -> float:
        score = lead_confidence
        if behavior_score is not None:
            score += 0.04 if behavior_score.total >= 70 else -0.04
        if confidence_overview is not None:
            score += 0.04 if confidence_overview.score >= 80 else -0.05
        return round(max(0.35, min(score, 0.98)), 2)

    def _tone_line(self, mode: PrimeCoachMode, message: str) -> str:
        if mode == "strict":
            strict_map = {
                "Aksam proteinini simdi kilitle.": "Aksam proteini kacirma. Simdi kapat.",
                "Proteini yukari cek, kaloriyi tasirma.": "Proteini toparla, kaloriyi tasirma.",
                "Kalori tasmasini bugun durdur.": "Bugun tasmayi kes.",
                "Aksami atlama, duzeni simdi kur.": "Aksami gecistirme. Simdi duzelt.",
                "Kaloriyi geceye birakma.": "Geceye kalma. Simdi kontrol et.",
                "Logu geciktirme, gunu simdi sabitle.": "Logu geciktirme. Simdi gir.",
                "Bugun kontrollu yakit ekle.": "Acigi buyutme. Kontrollu yakit ekle.",
                "Ritmi koru, fazladan hamle acma.": "Cizgiyi bozma. Ekstra hamle acma.",
            }
            return strict_map.get(message, message)
        if mode == "flexible":
            flexible_map = {
                "Aksam proteinini simdi kilitle.": "Aksam proteini erken kapat.",
                "Proteini yukari cek, kaloriyi tasirma.": "Proteini toparla, kaloriye dikkat et.",
                "Kalori tasmasini bugun durdur.": "Bugun biraz daha kontrollu git.",
                "Aksami atlama, duzeni simdi kur.": "Aksami planla, duzeni koru.",
                "Kaloriyi geceye birakma.": "Kaloriyi geceye yigma.",
                "Logu geciktirme, gunu simdi sabitle.": "Logu bugun koparma.",
                "Bugun kontrollu yakit ekle.": "Bugun hafif bir destek ogunu ekle.",
                "Ritmi koru, fazladan hamle acma.": "Ayni cizgide devam et.",
            }
            return flexible_map.get(message, message)
        return message
