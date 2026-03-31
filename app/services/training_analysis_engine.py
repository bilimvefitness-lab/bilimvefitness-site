import re
import unicodedata
from dataclasses import dataclass

from app.schemas.training import (
    DetectedExercise,
    HypertrophyScoreBreakdown,
    HypertrophyScoreComponent,
    MuscleGroupStats,
    NextBestAction,
    RIRSummary,
    TrainingProgramAnalysisResponse,
)


@dataclass(slots=True)
class _ParsedExercise:
    session: str
    exercise_name: str
    matched_alias: str | None
    sets: int
    reps: str | None
    estimated_rir: float
    muscles: dict[str, float]


@dataclass(slots=True)
class _ScoreResult:
    score: int
    explanation: str


def _normalize_exercise_text(text: str) -> str:
    normalized = unicodedata.normalize("NFKD", text.casefold())
    ascii_text = "".join(char for char in normalized if not unicodedata.combining(char))
    ascii_text = ascii_text.replace("&", " and ")
    ascii_text = re.sub(r"\bdb\b", "dumbbell", ascii_text)
    ascii_text = re.sub(r"\bbb\b", "barbell", ascii_text)
    ascii_text = re.sub(r"\bsm\b", "smith machine", ascii_text)
    ascii_text = re.sub(r"[^a-z0-9\s]+", " ", ascii_text)
    ascii_text = re.sub(r"\s+", " ", ascii_text).strip()
    return ascii_text


class TrainingAnalysisEngine:
    def analyze_program(self, program_text: str) -> TrainingProgramAnalysisResponse:
        exercises = self._parse_program(program_text)
        if not exercises:
            return TrainingProgramAnalysisResponse(
                hypertrophy_score=0,
                score_breakdown=self._empty_score_breakdown(),
                overall_interpretation="Insufficient information to rate the program.",
                fatigue_risk="low",
                main_strengths=[],
                main_limiters=[
                    "No recognizable exercises with set prescriptions were detected."
                ],
                next_best_actions=[
                    NextBestAction(
                        title="Add structured exercise lines",
                        priority="high",
                        description="Write each exercise with a clear set prescription such as 'Bench Press - 4x8 @ 2 RIR' so the program can be analyzed reliably.",
                    )
                ],
                weekly_volume_per_muscle_group={},
                frequency_per_muscle_group={},
                muscle_group_stats={},
                estimated_rir_level=RIRSummary(
                    estimated_average_rir=0.0,
                    interpretation="Unable to estimate because no exercises were detected.",
                ),
                optimization_suggestions=[
                    "No exercises were detected. Use lines like 'Bench Press - 4x8 @ 2 RIR' or add clear exercise names and set counts."
                ],
                detected_exercises=[],
            )

        weekly_volume = self._calculate_weekly_volume(exercises)
        frequency = self._calculate_frequency(exercises)
        rir_summary = self._estimate_rir(exercises)
        fatigue_risk = self._calculate_fatigue_risk(
            exercises=exercises,
            weekly_volume=weekly_volume,
            average_rir=rir_summary.estimated_average_rir,
        )
        hypertrophy_score, score_breakdown = self._calculate_hypertrophy_score(
            weekly_volume=weekly_volume,
            frequency=frequency,
            average_rir=rir_summary.estimated_average_rir,
            exercises=exercises,
            fatigue_risk=fatigue_risk,
        )
        overall_interpretation = self._build_overall_interpretation(hypertrophy_score)
        main_limiters = self._build_main_limiters(
            weekly_volume=weekly_volume,
            frequency=frequency,
            average_rir=rir_summary.estimated_average_rir,
            exercises=exercises,
            fatigue_risk=fatigue_risk,
        )
        main_strengths = self._build_main_strengths(
            weekly_volume=weekly_volume,
            frequency=frequency,
            average_rir=rir_summary.estimated_average_rir,
            exercises=exercises,
            fatigue_risk=fatigue_risk,
        )
        suggestions = self._build_suggestions(
            weekly_volume=weekly_volume,
            frequency=frequency,
            average_rir=rir_summary.estimated_average_rir,
            fatigue_risk=fatigue_risk,
            exercises=exercises,
        )
        next_best_actions = self._build_next_best_actions(
            weekly_volume=weekly_volume,
            frequency=frequency,
            average_rir=rir_summary.estimated_average_rir,
            fatigue_risk=fatigue_risk,
            suggestions=suggestions,
        )

        muscle_group_stats = {
            muscle: MuscleGroupStats(
                weekly_sets=round(weekly_volume[muscle], 2),
                frequency=frequency.get(muscle, 0),
            )
            for muscle in sorted(weekly_volume.keys())
        }

        return TrainingProgramAnalysisResponse(
            hypertrophy_score=hypertrophy_score,
            score_breakdown=score_breakdown,
            overall_interpretation=overall_interpretation,
            fatigue_risk=fatigue_risk,
            main_strengths=main_strengths,
            main_limiters=main_limiters,
            next_best_actions=next_best_actions,
            weekly_volume_per_muscle_group={
                muscle: round(value, 2) for muscle, value in sorted(weekly_volume.items())
            },
            frequency_per_muscle_group={
                muscle: frequency.get(muscle, 0) for muscle in sorted(weekly_volume.keys())
            },
            muscle_group_stats=muscle_group_stats,
            estimated_rir_level=rir_summary,
            optimization_suggestions=suggestions,
            detected_exercises=[
                DetectedExercise(
                    session=exercise.session,
                    exercise_name=exercise.exercise_name,
                    matched_alias=exercise.matched_alias,
                    sets=exercise.sets,
                    reps=exercise.reps,
                    estimated_rir=exercise.estimated_rir,
                    muscles=exercise.muscles,
                )
                for exercise in exercises
            ],
        )

    def _parse_program(self, program_text: str) -> list[_ParsedExercise]:
        exercises: list[_ParsedExercise] = []
        current_session = "Session 1"
        session_index = 1

        for raw_line in program_text.splitlines():
            line = raw_line.strip(" -\t")
            if not line:
                continue

            header = self._extract_session_header(line)
            if header:
                current_session = header
                continue

            parsed = self._parse_exercise_line(line, current_session)
            if parsed is not None:
                exercises.append(parsed)
                continue

            if self._looks_like_session_title(line):
                session_index += 1
                current_session = f"Session {session_index}: {line}"

        return exercises

    def _extract_session_header(self, line: str) -> str | None:
        lowered = line.lower()
        if re.match(r"^(day|session|workout)\s*\d+", lowered):
            return line
        if lowered in {"push", "pull", "legs", "upper", "lower", "full body", "rest"}:
            return line.title()
        if re.match(
            r"^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
            lowered,
        ):
            return line.title()
        return None

    def _looks_like_session_title(self, line: str) -> bool:
        return len(line.split()) <= 4 and not re.search(r"\d", line) and line == line.title()

    def _parse_exercise_line(
        self,
        line: str,
        session: str,
    ) -> _ParsedExercise | None:
        sets = self._extract_sets(line)
        if sets is None:
            return None

        exercise_name = self._extract_exercise_name(line)
        if not exercise_name:
            return None

        matched_alias, muscles = self._match_exercise(exercise_name)
        if not muscles:
            return None

        return _ParsedExercise(
            session=session,
            exercise_name=exercise_name,
            matched_alias=matched_alias,
            sets=sets,
            reps=self._extract_reps(line),
            estimated_rir=self._estimate_line_rir(line),
            muscles=muscles,
        )

    def _extract_sets(self, line: str) -> int | None:
        patterns = [
            r"(?P<sets>\d+)\s*x\s*\d+",
            r"(?P<sets>\d+)\s*sets?\b",
        ]
        for pattern in patterns:
            match = re.search(pattern, line.lower())
            if match:
                return int(match.group("sets"))
        return None

    def _extract_reps(self, line: str) -> str | None:
        match = re.search(r"\d+\s*x\s*(\d+(?:-\d+)?)", line.lower())
        if match:
            return match.group(1)
        return None

    def _extract_exercise_name(self, line: str) -> str:
        stripped = re.split(r"\b\d+\s*x\s*\d+", line, maxsplit=1)[0]
        stripped = re.split(r"\b\d+\s*sets?\b", stripped, maxsplit=1)[0]
        return stripped.strip(" -:|")

    def _match_exercise(self, exercise_name: str) -> tuple[str | None, dict[str, float]]:
        normalized_name = _normalize_exercise_text(exercise_name)
        best_alias: str | None = None
        best_mapping: dict[str, float] = {}
        best_length = -1

        for alias, canonical_alias in EXERCISE_ALIAS_MAP.items():
            if alias in normalized_name and len(alias) > best_length:
                best_alias = canonical_alias
                best_mapping = CANONICAL_EXERCISE_MUSCLE_MAP.get(canonical_alias, {})
                best_length = len(alias)

        return best_alias, dict(best_mapping)

    def _estimate_line_rir(self, line: str) -> float:
        lowered = line.lower()
        rir_range = re.search(
            r"rir\s*(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)",
            lowered,
        )
        if rir_range:
            return round((float(rir_range.group(1)) + float(rir_range.group(2))) / 2, 2)

        explicit_rir = re.search(r"(\d+(?:\.\d+)?)\s*(?:rir|reps? in reserve)", lowered)
        if explicit_rir:
            return float(explicit_rir.group(1))

        rpe = re.search(r"rpe\s*(\d+(?:\.\d+)?)", lowered)
        if rpe:
            return max(0.0, round(10.0 - float(rpe.group(1)), 2))

        if any(term in lowered for term in {"to failure", "failure", "amrap"}):
            return 0.0
        if any(term in lowered for term in {"very hard", "all out"}):
            return 0.5
        if any(term in lowered for term in {"hard", "heavy"}):
            return 1.5
        if "moderate" in lowered:
            return 3.0
        if any(term in lowered for term in {"easy", "light", "warm-up", "warmup"}):
            return 4.5
        return 2.5

    def _calculate_weekly_volume(self, exercises: list[_ParsedExercise]) -> dict[str, float]:
        volume: dict[str, float] = {}
        for exercise in exercises:
            for muscle, multiplier in exercise.muscles.items():
                volume[muscle] = volume.get(muscle, 0.0) + (exercise.sets * multiplier)
        return volume

    def _calculate_frequency(self, exercises: list[_ParsedExercise]) -> dict[str, int]:
        sessions_by_muscle: dict[str, set[str]] = {}
        for exercise in exercises:
            for muscle, multiplier in exercise.muscles.items():
                if multiplier < 0.5:
                    continue
                sessions_by_muscle.setdefault(muscle, set()).add(exercise.session)

        return {muscle: len(sessions) for muscle, sessions in sessions_by_muscle.items()}

    def _estimate_rir(self, exercises: list[_ParsedExercise]) -> RIRSummary:
        total_sets = sum(exercise.sets for exercise in exercises)
        weighted_rir = sum(exercise.estimated_rir * exercise.sets for exercise in exercises)
        average_rir = round(weighted_rir / total_sets, 2) if total_sets else 0.0

        if average_rir < 1:
            interpretation = "Very hard effort, with most sets likely close to failure."
        elif average_rir <= 3:
            interpretation = "Good hypertrophy effort range for most working sets."
        elif average_rir <= 4:
            interpretation = "Moderately conservative effort; still useful but not maximally stimulative."
        else:
            interpretation = "Likely too easy for optimal hypertrophy on many sets."

        return RIRSummary(
            estimated_average_rir=average_rir,
            interpretation=interpretation,
        )

    def _calculate_hypertrophy_score(
        self,
        weekly_volume: dict[str, float],
        frequency: dict[str, int],
        average_rir: float,
        exercises: list[_ParsedExercise],
        fatigue_risk: str,
    ) -> tuple[int, HypertrophyScoreBreakdown]:
        if not weekly_volume:
            return 0, self._empty_score_breakdown()

        volume_result = self._score_volume_adequacy(weekly_volume)
        frequency_result = self._score_frequency_adequacy(weekly_volume, frequency)
        effort_result = self._score_effort_quality(average_rir)
        selection_result = self._score_exercise_selection_quality(exercises, weekly_volume)
        fatigue_result = self._score_fatigue_balance(
            exercises=exercises,
            weekly_volume=weekly_volume,
            average_rir=average_rir,
            fatigue_risk=fatigue_risk,
        )

        score_breakdown = HypertrophyScoreBreakdown(
            weekly_volume_adequacy=HypertrophyScoreComponent(
                score=volume_result.score,
                explanation=volume_result.explanation,
                weight=0.30,
            ),
            frequency_adequacy=HypertrophyScoreComponent(
                score=frequency_result.score,
                explanation=frequency_result.explanation,
                weight=0.20,
            ),
            estimated_effort_quality=HypertrophyScoreComponent(
                score=effort_result.score,
                explanation=effort_result.explanation,
                weight=0.20,
            ),
            exercise_selection_quality=HypertrophyScoreComponent(
                score=selection_result.score,
                explanation=selection_result.explanation,
                weight=0.15,
            ),
            fatigue_balance=HypertrophyScoreComponent(
                score=fatigue_result.score,
                explanation=fatigue_result.explanation,
                weight=0.15,
            ),
        )

        weighted_score = (
            score_breakdown.weekly_volume_adequacy.score
            * score_breakdown.weekly_volume_adequacy.weight
            + score_breakdown.frequency_adequacy.score
            * score_breakdown.frequency_adequacy.weight
            + score_breakdown.estimated_effort_quality.score
            * score_breakdown.estimated_effort_quality.weight
            + score_breakdown.exercise_selection_quality.score
            * score_breakdown.exercise_selection_quality.weight
            + score_breakdown.fatigue_balance.score
            * score_breakdown.fatigue_balance.weight
        )
        final_score = max(0, min(100, round(weighted_score)))
        return final_score, score_breakdown

    def _score_volume(self, sets: float) -> float:
        if 10 <= sets <= 20:
            return 100.0
        if sets < 10:
            return max(0.0, (sets / 10.0) * 100.0)
        return max(20.0, 100.0 - ((sets - 20.0) * 8.0))

    def _score_frequency(self, frequency: int) -> float:
        if frequency >= 2:
            return 100.0
        if frequency == 1:
            return 65.0
        return 0.0

    def _score_rir(self, average_rir: float) -> float:
        if 1 <= average_rir <= 3:
            return 100.0
        if 0 <= average_rir < 1:
            return 85.0
        if 3 < average_rir <= 4:
            return 75.0
        return 45.0

    def _score_volume_adequacy(self, weekly_volume: dict[str, float]) -> _ScoreResult:
        primary_muscles = [muscle for muscle in TARGET_MUSCLE_GROUPS if weekly_volume.get(muscle, 0) >= 4]
        if not primary_muscles:
            return _ScoreResult(
                score=0,
                explanation="No muscle group reached a meaningful weekly set volume threshold.",
            )

        scores = [self._score_volume(weekly_volume[muscle]) for muscle in primary_muscles]
        underdosed = [muscle for muscle in primary_muscles if weekly_volume[muscle] < 10]
        overdosed = [muscle for muscle in primary_muscles if weekly_volume[muscle] > 20]
        explanation = (
            f"{len(primary_muscles)} muscle groups reached at least 4 weekly sets. "
            f"Underdosed groups: {self._format_list(underdosed)}. "
            f"Potentially excessive groups: {self._format_list(overdosed)}."
        )
        return _ScoreResult(score=round(sum(scores) / len(scores)), explanation=explanation)

    def _score_frequency_adequacy(
        self,
        weekly_volume: dict[str, float],
        frequency: dict[str, int],
    ) -> _ScoreResult:
        trained_muscles = [muscle for muscle in TARGET_MUSCLE_GROUPS if weekly_volume.get(muscle, 0) >= 4]
        if not trained_muscles:
            return _ScoreResult(
                score=0,
                explanation="No trained muscle groups were available to score frequency.",
            )

        scores = [self._score_frequency(frequency.get(muscle, 0)) for muscle in trained_muscles]
        once_weekly = [muscle for muscle in trained_muscles if frequency.get(muscle, 0) == 1]
        high_frequency = [muscle for muscle in trained_muscles if frequency.get(muscle, 0) >= 2]
        explanation = (
            f"{len(high_frequency)} trained muscle groups are hit at least twice per week. "
            f"Once-weekly groups: {self._format_list(once_weekly)}."
        )
        return _ScoreResult(score=round(sum(scores) / len(scores)), explanation=explanation)

    def _score_effort_quality(self, average_rir: float) -> _ScoreResult:
        score = round(self._score_rir(average_rir))
        if average_rir < 1:
            explanation = (
                f"Average estimated effort is {average_rir} RIR, which is very close to failure and can raise fatigue."
            )
        elif average_rir <= 3:
            explanation = (
                f"Average estimated effort is {average_rir} RIR, which is a strong hypertrophy range for most working sets."
            )
        elif average_rir <= 4:
            explanation = (
                f"Average estimated effort is {average_rir} RIR, slightly conservative for maximal hypertrophy."
            )
        else:
            explanation = (
                f"Average estimated effort is {average_rir} RIR, likely too easy to maximize hypertrophy."
            )
        return _ScoreResult(score=score, explanation=explanation)

    def _score_exercise_selection_quality(
        self,
        exercises: list[_ParsedExercise],
        weekly_volume: dict[str, float],
    ) -> _ScoreResult:
        recognized_exercises = len(exercises)
        unique_aliases = {exercise.matched_alias for exercise in exercises if exercise.matched_alias}
        compound_count = sum(
            1 for exercise in exercises if exercise.matched_alias in COMPOUND_EXERCISES
        )
        isolation_count = max(0, recognized_exercises - compound_count)
        covered_muscles = [
            muscle for muscle in TARGET_MUSCLE_GROUPS if weekly_volume.get(muscle, 0) >= 4
        ]

        coverage_score = min(100.0, len(covered_muscles) * 12.0)
        variety_score = min(100.0, len(unique_aliases) * 9.0)
        pattern_score = 100.0 if compound_count >= 3 and isolation_count >= 2 else 70.0
        score = round((coverage_score * 0.45) + (variety_score * 0.30) + (pattern_score * 0.25))

        explanation = (
            f"{len(unique_aliases)} unique exercise patterns were detected. "
            f"Compound to isolation mix is {compound_count}:{isolation_count}. "
            f"Meaningful coverage was found for {len(covered_muscles)} target muscle groups."
        )
        return _ScoreResult(score=max(0, min(100, score)), explanation=explanation)

    def _score_fatigue_balance(
        self,
        exercises: list[_ParsedExercise],
        weekly_volume: dict[str, float],
        average_rir: float,
        fatigue_risk: str,
    ) -> _ScoreResult:
        total_sets = sum(exercise.sets for exercise in exercises)
        high_stress_groups = [muscle for muscle, sets in weekly_volume.items() if sets > 20]
        near_failure_penalty = 20 if average_rir < 1 else 8 if average_rir <= 2 else 0
        volume_penalty = min(25, max(0, total_sets - 65))
        stress_penalty = len(high_stress_groups) * 8
        risk_penalty = {"low": 0, "medium": 10, "high": 22}[fatigue_risk]
        score = max(
            0,
            min(100, round(100 - near_failure_penalty - volume_penalty - stress_penalty - risk_penalty)),
        )
        explanation = (
            f"Estimated fatigue risk is {fatigue_risk}. Total working sets are {total_sets}, "
            f"and high-stress volume appears in {self._format_list(high_stress_groups)}."
        )
        return _ScoreResult(score=score, explanation=explanation)

    def _calculate_fatigue_risk(
        self,
        exercises: list[_ParsedExercise],
        weekly_volume: dict[str, float],
        average_rir: float,
    ) -> str:
        total_sets = sum(exercise.sets for exercise in exercises)
        risk_points = 0

        if total_sets >= 90:
            risk_points += 2
        elif total_sets >= 70:
            risk_points += 1

        if any(sets > 22 for sets in weekly_volume.values()):
            risk_points += 1
        if average_rir <= 1.0:
            risk_points += 2
        elif average_rir <= 2.0:
            risk_points += 1

        compound_count = sum(
            1
            for exercise in exercises
            if exercise.matched_alias in HIGH_FATIGUE_EXERCISES
        )
        if compound_count >= 8:
            risk_points += 1

        if risk_points >= 4:
            return "high"
        if risk_points >= 2:
            return "medium"
        return "low"

    def _build_overall_interpretation(self, hypertrophy_score: int) -> str:
        if hypertrophy_score >= 80:
            tier = "advanced"
            description = "The program is well-structured for hypertrophy with only minor refinements needed."
        elif hypertrophy_score >= 60:
            tier = "intermediate"
            description = "The program has a solid hypertrophy foundation but still has some meaningful gaps."
        else:
            tier = "beginner"
            description = "The program is not yet well-optimized for hypertrophy and has clear limiting factors."

        return (
            f"{description} Interpretation tier: {tier}. "
            "Thresholds are deterministic: beginner = 0-59, intermediate = 60-79, advanced = 80-100."
        )

    def _build_main_limiters(
        self,
        weekly_volume: dict[str, float],
        frequency: dict[str, int],
        average_rir: float,
        exercises: list[_ParsedExercise],
        fatigue_risk: str,
    ) -> list[str]:
        limiters: list[str] = []

        low_volume = [muscle for muscle in TARGET_MUSCLE_GROUPS if 0 < weekly_volume.get(muscle, 0) < 8]
        once_weekly = [
            muscle
            for muscle in TARGET_MUSCLE_GROUPS
            if weekly_volume.get(muscle, 0) >= 6 and frequency.get(muscle, 0) < 2
        ]
        if low_volume:
            limiters.append(
                f"Low weekly volume for {self._format_list(low_volume[:4])} limits total hypertrophy stimulus."
            )
        if once_weekly:
            limiters.append(
                f"Frequency is low for {self._format_list(once_weekly[:4])}, which reduces repeated growth opportunities."
            )
        if average_rir < 1:
            limiters.append(
                "Average effort appears too close to failure, which may trade recoverability for marginal stimulus gains."
            )
        elif average_rir > 4:
            limiters.append(
                "Average effort appears too easy, so many sets may be below an effective hypertrophy threshold."
            )
        if fatigue_risk == "high":
            limiters.append(
                "Overall fatigue risk is high, which can reduce performance quality and recovery across the week."
            )
        if len({exercise.matched_alias for exercise in exercises if exercise.matched_alias}) < 5:
            limiters.append(
                "Exercise selection is narrow, so the program may miss useful movement variety and muscle coverage."
            )

        if not limiters:
            limiters.append("No major limiter stands out; remaining improvements are mostly fine-tuning.")
        return limiters[:4]

    def _build_main_strengths(
        self,
        weekly_volume: dict[str, float],
        frequency: dict[str, int],
        average_rir: float,
        exercises: list[_ParsedExercise],
        fatigue_risk: str,
    ) -> list[str]:
        strengths: list[str] = []

        well_dosed = [muscle for muscle in TARGET_MUSCLE_GROUPS if 10 <= weekly_volume.get(muscle, 0) <= 20]
        frequent = [
            muscle
            for muscle in TARGET_MUSCLE_GROUPS
            if weekly_volume.get(muscle, 0) >= 6 and frequency.get(muscle, 0) >= 2
        ]
        compound_count = sum(
            1 for exercise in exercises if exercise.matched_alias in COMPOUND_EXERCISES
        )

        if well_dosed:
            strengths.append(
                f"Weekly volume is in a productive hypertrophy range for {self._format_list(well_dosed[:4])}."
            )
        if frequent:
            strengths.append(
                f"Frequency is strong for {self._format_list(frequent[:4])}, helping distribute stimulus and fatigue."
            )
        if 1 <= average_rir <= 3:
            strengths.append(
                "Estimated effort lands in a strong 1-3 RIR hypertrophy zone for most working sets."
            )
        if compound_count >= 3:
            strengths.append(
                "Exercise selection includes enough compound lifts to build efficient base stimulus."
            )
        if fatigue_risk == "low":
            strengths.append(
                "Fatigue balance looks manageable, which should support consistent training quality."
            )

        if not strengths:
            strengths.append("The program has at least some recognizable hypertrophy-oriented exercise structure.")
        return strengths[:4]

    def _build_suggestions(
        self,
        weekly_volume: dict[str, float],
        frequency: dict[str, int],
        average_rir: float,
        fatigue_risk: str,
        exercises: list[_ParsedExercise],
    ) -> list[str]:
        suggestions: list[str] = []

        for muscle in TARGET_MUSCLE_GROUPS:
            sets = weekly_volume.get(muscle, 0.0)
            freq = frequency.get(muscle, 0)

            if 0 < sets < 8:
                suggestions.append(
                    f"Increase {muscle} volume toward roughly 10-20 weekly sets for better hypertrophy stimulus."
                )
            elif sets > 22:
                suggestions.append(
                    f"Reduce {muscle} volume slightly; current workload looks high enough to impair recovery."
                )

            if sets >= 6 and freq < 2:
                suggestions.append(
                    f"Train {muscle} at least twice per week to improve frequency and distribute fatigue."
                )

        if average_rir < 1:
            suggestions.append(
                "Most working sets appear extremely close to failure. Keep only a small portion of sets at 0-1 RIR and leave more sets around 1-3 RIR."
            )
        elif average_rir > 4:
            suggestions.append(
                "The program may be too easy for hypertrophy. Push working sets closer to 1-3 RIR."
            )

        if fatigue_risk == "high":
            suggestions.append(
                "Fatigue risk is high. Reduce weekly sets, remove some near-failure work, or split hard compounds across more sessions."
            )
        elif fatigue_risk == "medium":
            suggestions.append(
                "Monitor recovery closely. Spreading heavy compounds more evenly across the week may improve performance."
            )

        if not any("calves" in exercise.muscles for exercise in exercises):
            suggestions.append(
                "If calf development matters, add direct calf work because it was not clearly detected."
            )

        if not suggestions:
            suggestions.append(
                "The program is reasonably balanced. Fine-tune exercise selection and progression based on recovery and performance trends."
            )

        return suggestions[:8]

    def _build_next_best_actions(
        self,
        weekly_volume: dict[str, float],
        frequency: dict[str, int],
        average_rir: float,
        fatigue_risk: str,
        suggestions: list[str],
    ) -> list[NextBestAction]:
        actions: list[NextBestAction] = []

        low_volume = [
            muscle for muscle in TARGET_MUSCLE_GROUPS if 0 < weekly_volume.get(muscle, 0) < 8
        ]
        if low_volume:
            actions.append(
                NextBestAction(
                    title="Increase low-volume muscle groups",
                    priority="high",
                    description=(
                        f"Bring {self._format_list(low_volume[:4])} closer to roughly 10-20 weekly sets so they receive a more reliable hypertrophy stimulus."
                    ),
                )
            )

        low_frequency = [
            muscle
            for muscle in TARGET_MUSCLE_GROUPS
            if weekly_volume.get(muscle, 0) >= 6 and frequency.get(muscle, 0) < 2
        ]
        if low_frequency:
            actions.append(
                NextBestAction(
                    title="Improve training frequency",
                    priority="high",
                    description=(
                        f"Spread work for {self._format_list(low_frequency[:4])} across at least two sessions per week to improve stimulus quality and recovery distribution."
                    ),
                )
            )

        if average_rir < 1:
            actions.append(
                NextBestAction(
                    title="Back off failure exposure",
                    priority="medium",
                    description="Keep only a small share of working sets at 0-1 RIR and move more sets into the 1-3 RIR range.",
                )
            )
        elif average_rir > 4:
            actions.append(
                NextBestAction(
                    title="Increase set effort",
                    priority="medium",
                    description="Push more working sets into the 1-3 RIR range so the effort level is high enough for hypertrophy.",
                )
            )

        if fatigue_risk == "high":
            actions.append(
                NextBestAction(
                    title="Reduce fatigue bottlenecks",
                    priority="high",
                    description="Trim some volume or near-failure compound work and distribute hard lifts across more sessions.",
                )
            )
        elif fatigue_risk == "medium":
            actions.append(
                NextBestAction(
                    title="Monitor recovery balance",
                    priority="medium",
                    description="Keep an eye on soreness, performance, and exercise ordering to prevent fatigue from accumulating across the week.",
                )
            )

        if not actions and suggestions:
            actions.append(
                NextBestAction(
                    title="Fine-tune the program",
                    priority="low",
                    description=suggestions[0],
                )
            )

        return actions[:4]

    def _empty_score_breakdown(self) -> HypertrophyScoreBreakdown:
        return HypertrophyScoreBreakdown(
            weekly_volume_adequacy=HypertrophyScoreComponent(
                score=0,
                explanation="No data available to score weekly volume adequacy.",
                weight=0.30,
            ),
            frequency_adequacy=HypertrophyScoreComponent(
                score=0,
                explanation="No data available to score frequency adequacy.",
                weight=0.20,
            ),
            estimated_effort_quality=HypertrophyScoreComponent(
                score=0,
                explanation="No data available to score estimated effort quality.",
                weight=0.20,
            ),
            exercise_selection_quality=HypertrophyScoreComponent(
                score=0,
                explanation="No data available to score exercise selection quality.",
                weight=0.15,
            ),
            fatigue_balance=HypertrophyScoreComponent(
                score=0,
                explanation="No data available to score fatigue balance.",
                weight=0.15,
            ),
        )

    def _format_list(self, items: list[str]) -> str:
        if not items:
            return "none"
        return ", ".join(sorted(items))


TARGET_MUSCLE_GROUPS = [
    "chest",
    "back",
    "shoulders",
    "biceps",
    "triceps",
    "quads",
    "hamstrings",
    "glutes",
    "calves",
    "abs",
]


HIGH_FATIGUE_EXERCISES = {
    "barbell squat",
    "back squat",
    "front squat",
    "deadlift",
    "romanian deadlift",
    "stiff leg deadlift",
    "bench press",
    "barbell row",
    "overhead press",
}


COMPOUND_EXERCISES = {
    "bench press",
    "incline bench press",
    "incline dumbbell press",
    "dumbbell bench press",
    "chest press machine",
    "smith machine bench press",
    "push up",
    "dip",
    "pull up",
    "chin up",
    "lat pulldown",
    "barbell row",
    "seated cable row",
    "chest supported row",
    "one arm dumbbell row",
    "t bar row",
    "machine row",
    "overhead press",
    "dumbbell shoulder press",
    "machine shoulder press",
    "back squat",
    "front squat",
    "leg press",
    "split squat",
    "bulgarian split squat",
    "lunge",
    "romanian deadlift",
    "deadlift",
    "stiff leg deadlift",
    "hip thrust",
    "glute bridge",
    "hack squat",
    "smith machine squat",
    "goblet squat",
}


# Canonical muscle mapping lives here. Add new exercises here only once, then point
# any Turkish/English spelling variants to the canonical key in EXERCISE_ALIAS_MAP.
CANONICAL_EXERCISE_MUSCLE_MAP: dict[str, dict[str, float]] = {
    "bench press": {"chest": 1.0, "triceps": 0.5, "shoulders": 0.35},
    "incline bench press": {"chest": 0.9, "shoulders": 0.45, "triceps": 0.4},
    "incline dumbbell press": {"chest": 0.9, "shoulders": 0.45, "triceps": 0.4},
    "dumbbell bench press": {"chest": 0.9, "triceps": 0.45, "shoulders": 0.35},
    "chest press machine": {"chest": 1.0, "triceps": 0.4, "shoulders": 0.3},
    "smith machine bench press": {"chest": 0.95, "triceps": 0.45, "shoulders": 0.3},
    "push up": {"chest": 0.8, "triceps": 0.45, "shoulders": 0.3},
    "dip": {"chest": 0.65, "triceps": 0.8, "shoulders": 0.25},
    "cable fly": {"chest": 0.9, "shoulders": 0.2},
    "pec deck": {"chest": 0.9, "shoulders": 0.2},
    "pull up": {"back": 0.8, "biceps": 0.5},
    "chin up": {"back": 0.75, "biceps": 0.6},
    "lat pulldown": {"back": 0.85, "biceps": 0.4},
    "barbell row": {"back": 1.0, "biceps": 0.35, "hamstrings": 0.15},
    "seated cable row": {"back": 0.9, "biceps": 0.35},
    "chest supported row": {"back": 0.9, "biceps": 0.3},
    "one arm dumbbell row": {"back": 0.9, "biceps": 0.35},
    "t bar row": {"back": 0.95, "biceps": 0.3},
    "machine row": {"back": 0.9, "biceps": 0.3},
    "face pull": {"shoulders": 0.6, "back": 0.3},
    "straight arm pulldown": {"back": 0.75, "shoulders": 0.15},
    "pullover machine": {"back": 0.7, "chest": 0.2},
    "overhead press": {"shoulders": 1.0, "triceps": 0.6},
    "dumbbell shoulder press": {"shoulders": 1.0, "triceps": 0.55},
    "machine shoulder press": {"shoulders": 0.95, "triceps": 0.5},
    "arnold press": {"shoulders": 0.9, "triceps": 0.45},
    "lateral raise": {"shoulders": 0.85},
    "cable lateral raise": {"shoulders": 0.85},
    "rear delt fly": {"shoulders": 0.7, "back": 0.25},
    "reverse pec deck": {"shoulders": 0.75, "back": 0.2},
    "upright row": {"shoulders": 0.7, "back": 0.3},
    "front raise": {"shoulders": 0.6},
    "barbell curl": {"biceps": 1.0},
    "dumbbell curl": {"biceps": 1.0},
    "alternating dumbbell curl": {"biceps": 1.0},
    "hammer curl": {"biceps": 0.9},
    "preacher curl": {"biceps": 1.0},
    "cable curl": {"biceps": 0.95},
    "concentration curl": {"biceps": 0.95},
    "incline dumbbell curl": {"biceps": 1.0},
    "ez bar curl": {"biceps": 1.0},
    "triceps pushdown": {"triceps": 1.0},
    "rope pushdown": {"triceps": 1.0},
    "overhead triceps extension": {"triceps": 0.95},
    "cable overhead triceps extension": {"triceps": 0.95},
    "skullcrusher": {"triceps": 1.0},
    "close grip bench press": {"triceps": 0.9, "chest": 0.35, "shoulders": 0.2},
    "machine dip": {"triceps": 0.9, "chest": 0.4},
    "back squat": {"quads": 1.0, "glutes": 0.7, "hamstrings": 0.2},
    "front squat": {"quads": 1.0, "glutes": 0.5},
    "hack squat": {"quads": 1.0, "glutes": 0.45},
    "leg press": {"quads": 0.9, "glutes": 0.5},
    "smith machine squat": {"quads": 0.9, "glutes": 0.6, "hamstrings": 0.2},
    "goblet squat": {"quads": 0.8, "glutes": 0.55},
    "split squat": {"quads": 0.8, "glutes": 0.6},
    "bulgarian split squat": {"quads": 0.85, "glutes": 0.65},
    "lunge": {"quads": 0.75, "glutes": 0.7, "hamstrings": 0.2},
    "leg extension": {"quads": 1.0},
    "romanian deadlift": {"hamstrings": 1.0, "glutes": 0.75},
    "deadlift": {"hamstrings": 0.8, "glutes": 0.8, "back": 0.5},
    "stiff leg deadlift": {"hamstrings": 1.0, "glutes": 0.65},
    "lying leg curl": {"hamstrings": 1.0},
    "seated leg curl": {"hamstrings": 1.0},
    "nordic curl": {"hamstrings": 1.0},
    "good morning": {"hamstrings": 0.8, "glutes": 0.6, "back": 0.25},
    "hip thrust": {"glutes": 1.0, "hamstrings": 0.35},
    "glute bridge": {"glutes": 0.95, "hamstrings": 0.3},
    "cable kickback": {"glutes": 0.9},
    "glute kickback machine": {"glutes": 0.95},
    "hip abduction machine": {"glutes": 0.8},
    "standing calf raise": {"calves": 1.0},
    "seated calf raise": {"calves": 1.0},
    "calf press": {"calves": 1.0},
    "donkey calf raise": {"calves": 1.0},
    "crunch": {"abs": 1.0},
    "cable crunch": {"abs": 1.0},
    "machine crunch": {"abs": 1.0},
    "sit up": {"abs": 1.0},
    "leg raise": {"abs": 0.9},
    "hanging leg raise": {"abs": 0.95},
    "plank": {"abs": 0.8},
    "ab wheel": {"abs": 1.0},
    "russian twist": {"abs": 0.85},
}


EXERCISE_ALIAS_MAP: dict[str, str] = {
    "bench press": "bench press",
    "flat bench press": "bench press",
    "barbell bench press": "bench press",
    "duz bench press": "bench press",
    "duz barbell press": "bench press",
    "gogus press": "bench press",
    "gogus pres": "bench press",
    "gogus press hareketi": "bench press",
    "göğüs press": "bench press",
    "incline bench press": "incline bench press",
    "incline bench": "incline bench press",
    "incline barbell press": "incline bench press",
    "egimli bench press": "incline bench press",
    "eğimli bench press": "incline bench press",
    "egimli barbell press": "incline bench press",
    "incline dumbbell press": "incline dumbbell press",
    "incline dumbbell bench": "incline dumbbell press",
    "egimli dumbbell press": "incline dumbbell press",
    "eğimli dumbbell press": "incline dumbbell press",
    "dumbbell bench press": "dumbbell bench press",
    "dumbbell chest press": "dumbbell bench press",
    "dumbbell press": "dumbbell bench press",
    "gogus dumbbell press": "dumbbell bench press",
    "chest press machine": "chest press machine",
    "machine chest press": "chest press machine",
    "chest press": "chest press machine",
    "gogus makinesi": "chest press machine",
    "göğüs makinesi": "chest press machine",
    "smith machine bench press": "smith machine bench press",
    "smith bench press": "smith machine bench press",
    "smith incline press": "smith machine bench press",
    "push up": "push up",
    "pushup": "push up",
    "şınav": "push up",
    "sinav": "push up",
    "dip": "dip",
    "dips": "dip",
    "parallel bar dip": "dip",
    "cable fly": "cable fly",
    "cable crossover": "cable fly",
    "crossover": "cable fly",
    "gogus fly": "cable fly",
    "göğüs fly": "cable fly",
    "pec deck": "pec deck",
    "machine fly": "pec deck",
    "chest fly machine": "pec deck",
    "butterfly": "pec deck",
    "kelebek": "pec deck",
    "pull up": "pull up",
    "pullup": "pull up",
    "barfiks": "pull up",
    "chin up": "chin up",
    "chinup": "chin up",
    "underhand pull up": "chin up",
    "lat pulldown": "lat pulldown",
    "lat pull down": "lat pulldown",
    "wide grip lat pulldown": "lat pulldown",
    "close grip pulldown": "lat pulldown",
    "lat cekis": "lat pulldown",
    "lat çekiş": "lat pulldown",
    "barbell row": "barbell row",
    "bent over row": "barbell row",
    "bent over barbell row": "barbell row",
    "seated cable row": "seated cable row",
    "cable row": "seated cable row",
    "seated row": "seated cable row",
    "oturarak row": "seated cable row",
    "chest supported row": "chest supported row",
    "incline bench row": "chest supported row",
    "gogus destekli row": "chest supported row",
    "göğüs destekli row": "chest supported row",
    "one arm dumbbell row": "one arm dumbbell row",
    "single arm dumbbell row": "one arm dumbbell row",
    "tek kol dumbbell row": "one arm dumbbell row",
    "dumbbell row": "one arm dumbbell row",
    "t bar row": "t bar row",
    "tbar row": "t bar row",
    "machine row": "machine row",
    "row machine": "machine row",
    "low row": "machine row",
    "face pull": "face pull",
    "facepull": "face pull",
    "straight arm pulldown": "straight arm pulldown",
    "straight arm pull down": "straight arm pulldown",
    "pullover machine": "pullover machine",
    "machine pullover": "pullover machine",
    "overhead press": "overhead press",
    "barbell overhead press": "overhead press",
    "military press": "overhead press",
    "ohp": "overhead press",
    "shoulder press": "dumbbell shoulder press",
    "dumbbell shoulder press": "dumbbell shoulder press",
    "dumbbell overhead press": "dumbbell shoulder press",
    "omuz press": "dumbbell shoulder press",
    "machine shoulder press": "machine shoulder press",
    "shoulder press machine": "machine shoulder press",
    "omuz makinesi": "machine shoulder press",
    "arnold press": "arnold press",
    "lateral raise": "lateral raise",
    "dumbbell lateral raise": "lateral raise",
    "yan omuz": "lateral raise",
    "yana acis": "lateral raise",
    "yana açış": "lateral raise",
    "cable lateral raise": "cable lateral raise",
    "rear delt fly": "rear delt fly",
    "rear delt raise": "rear delt fly",
    "arka omuz fly": "rear delt fly",
    "reverse pec deck": "reverse pec deck",
    "reverse fly machine": "reverse pec deck",
    "ters pec deck": "reverse pec deck",
    "upright row": "upright row",
    "front raise": "front raise",
    "barbell curl": "barbell curl",
    "biceps curl": "barbell curl",
    "curl": "barbell curl",
    "dumbbell curl": "dumbbell curl",
    "alternating dumbbell curl": "alternating dumbbell curl",
    "alternate dumbbell curl": "alternating dumbbell curl",
    "hammer curl": "hammer curl",
    "preacher curl": "preacher curl",
    "scott curl": "preacher curl",
    "cable curl": "cable curl",
    "kablo curl": "cable curl",
    "concentration curl": "concentration curl",
    "incline dumbbell curl": "incline dumbbell curl",
    "ez bar curl": "ez bar curl",
    "triceps pushdown": "triceps pushdown",
    "tricep pushdown": "triceps pushdown",
    "pushdown": "triceps pushdown",
    "arka kol pushdown": "triceps pushdown",
    "rope pushdown": "rope pushdown",
    "rope triceps pushdown": "rope pushdown",
    "ip pushdown": "rope pushdown",
    "overhead triceps extension": "overhead triceps extension",
    "triceps extension": "overhead triceps extension",
    "french press": "overhead triceps extension",
    "cable overhead triceps extension": "cable overhead triceps extension",
    "skullcrusher": "skullcrusher",
    "skull crusher": "skullcrusher",
    "close grip bench press": "close grip bench press",
    "close grip bench": "close grip bench press",
    "dar bench press": "close grip bench press",
    "machine dip": "machine dip",
    "assisted dip machine": "machine dip",
    "back squat": "back squat",
    "barbell squat": "back squat",
    "squat": "back squat",
    "front squat": "front squat",
    "hack squat": "hack squat",
    "hack machine squat": "hack squat",
    "leg press": "leg press",
    "45 degree leg press": "leg press",
    "smith machine squat": "smith machine squat",
    "smith squat": "smith machine squat",
    "goblet squat": "goblet squat",
    "split squat": "split squat",
    "bulgarian split squat": "bulgarian split squat",
    "bulgarian squat": "bulgarian split squat",
    "lunge": "lunge",
    "walking lunge": "lunge",
    "reverse lunge": "lunge",
    "leg extension": "leg extension",
    "machine leg extension": "leg extension",
    "leg ext": "leg extension",
    "romanian deadlift": "romanian deadlift",
    "rdl": "romanian deadlift",
    "romanian dl": "romanian deadlift",
    "deadlift": "deadlift",
    "conventional deadlift": "deadlift",
    "stiff leg deadlift": "stiff leg deadlift",
    "stiff leg dl": "stiff leg deadlift",
    "lying leg curl": "lying leg curl",
    "leg curl": "lying leg curl",
    "lying hamstring curl": "lying leg curl",
    "seated leg curl": "seated leg curl",
    "seated hamstring curl": "seated leg curl",
    "nordic curl": "nordic curl",
    "good morning": "good morning",
    "hip thrust": "hip thrust",
    "barbell hip thrust": "hip thrust",
    "kalca itis": "hip thrust",
    "kalça itiş": "hip thrust",
    "glute bridge": "glute bridge",
    "kalca kopru": "glute bridge",
    "kalça köprü": "glute bridge",
    "cable kickback": "cable kickback",
    "glute kickback": "cable kickback",
    "kickback": "cable kickback",
    "glute kickback machine": "glute kickback machine",
    "kickback machine": "glute kickback machine",
    "hip abduction machine": "hip abduction machine",
    "abduction machine": "hip abduction machine",
    "abductor machine": "hip abduction machine",
    "standing calf raise": "standing calf raise",
    "calf raise": "standing calf raise",
    "standing calf": "standing calf raise",
    "seated calf raise": "seated calf raise",
    "calf press": "calf press",
    "leg press calf raise": "calf press",
    "donkey calf raise": "donkey calf raise",
    "crunch": "crunch",
    "mekik": "crunch",
    "cable crunch": "cable crunch",
    "machine crunch": "machine crunch",
    "sit up": "sit up",
    "situp": "sit up",
    "leg raise": "leg raise",
    "lying leg raise": "leg raise",
    "hanging leg raise": "hanging leg raise",
    "plank": "plank",
    "ab wheel": "ab wheel",
    "ab rollout": "ab wheel",
    "russian twist": "russian twist",
}


EXERCISE_ALIAS_MAP = {
    _normalize_exercise_text(alias): canonical for alias, canonical in EXERCISE_ALIAS_MAP.items()
}
