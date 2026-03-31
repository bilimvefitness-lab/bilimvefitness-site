import re
from dataclasses import dataclass

from app.schemas.training import (
    DetectedExercise,
    MuscleGroupStats,
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


class TrainingAnalysisService:
    def analyze_program(self, program_text: str) -> TrainingProgramAnalysisResponse:
        exercises = self._parse_program(program_text)
        if not exercises:
            return TrainingProgramAnalysisResponse(
                weekly_volume_per_muscle_group={},
                frequency_per_muscle_group={},
                muscle_group_stats={},
                estimated_rir_level=RIRSummary(
                    estimated_average_rir=0.0,
                    interpretation="Unable to estimate because no exercises were detected.",
                ),
                hypertrophy_score=0,
                fatigue_risk="low",
                optimization_suggestions=[
                    "No exercises were detected. Use lines like 'Bench Press - 4x8 @ 2 RIR' or add clear exercise names and set counts."
                ],
                detected_exercises=[],
            )

        weekly_volume = self._calculate_weekly_volume(exercises)
        frequency = self._calculate_frequency(exercises)
        rir_summary = self._estimate_rir(exercises)
        hypertrophy_score = self._calculate_hypertrophy_score(
            weekly_volume=weekly_volume,
            frequency=frequency,
            average_rir=rir_summary.estimated_average_rir,
        )
        fatigue_risk = self._calculate_fatigue_risk(
            exercises=exercises,
            weekly_volume=weekly_volume,
            average_rir=rir_summary.estimated_average_rir,
        )
        suggestions = self._build_suggestions(
            weekly_volume=weekly_volume,
            frequency=frequency,
            average_rir=rir_summary.estimated_average_rir,
            fatigue_risk=fatigue_risk,
            exercises=exercises,
        )

        muscle_group_stats = {
            muscle: MuscleGroupStats(
                weekly_sets=round(weekly_volume[muscle], 2),
                frequency=frequency.get(muscle, 0),
            )
            for muscle in sorted(weekly_volume.keys())
        }

        return TrainingProgramAnalysisResponse(
            weekly_volume_per_muscle_group={
                muscle: round(value, 2) for muscle, value in sorted(weekly_volume.items())
            },
            frequency_per_muscle_group={
                muscle: frequency.get(muscle, 0) for muscle in sorted(weekly_volume.keys())
            },
            muscle_group_stats=muscle_group_stats,
            estimated_rir_level=rir_summary,
            hypertrophy_score=hypertrophy_score,
            fatigue_risk=fatigue_risk,
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
        return (
            len(line.split()) <= 4
            and not re.search(r"\d", line)
            and line == line.title()
        )

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
        stripped = stripped.strip(" -:|")
        return stripped

    def _match_exercise(self, exercise_name: str) -> tuple[str | None, dict[str, float]]:
        lowered = exercise_name.lower()
        best_alias: str | None = None
        best_mapping: dict[str, float] = {}
        best_length = -1

        for alias, muscles in EXERCISE_MUSCLE_MAP.items():
            if alias in lowered and len(alias) > best_length:
                best_alias = alias
                best_mapping = muscles
                best_length = len(alias)

        return best_alias, dict(best_mapping)

    def _estimate_line_rir(self, line: str) -> float:
        lowered = line.lower()
        explicit_rir = re.search(r"(\d+(?:\.\d+)?)\s*(?:rir|reps? in reserve)", lowered)
        if explicit_rir:
            return float(explicit_rir.group(1))

        rir_range = re.search(
            r"rir\s*(\d+(?:\.\d+)?)\s*[-/]\s*(\d+(?:\.\d+)?)",
            lowered,
        )
        if rir_range:
            return round((float(rir_range.group(1)) + float(rir_range.group(2))) / 2, 2)

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
        weighted_rir = sum(
            exercise.estimated_rir * exercise.sets for exercise in exercises
        )
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
    ) -> int:
        if not weekly_volume:
            return 0

        volume_scores = [self._score_volume(sets) for sets in weekly_volume.values()]
        frequency_scores = [self._score_frequency(frequency.get(muscle, 0)) for muscle in weekly_volume]
        rir_score = self._score_rir(average_rir)

        balance_penalty = 0
        active_groups = [sets for sets in weekly_volume.values() if sets >= 4]
        if len(active_groups) < 4:
            balance_penalty += 10
        if any(sets > 24 for sets in weekly_volume.values()):
            balance_penalty += 5

        score = (
            (sum(volume_scores) / len(volume_scores)) * 0.55
            + (sum(frequency_scores) / len(frequency_scores)) * 0.25
            + rir_score * 0.20
            - balance_penalty
        )
        return max(0, min(100, round(score)))

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
                    f"Increase {muscle} volume toward roughly 10–20 weekly sets for better hypertrophy stimulus."
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
                "Most working sets appear extremely close to failure. Keep only a small portion of sets at 0–1 RIR and leave more sets around 1–3 RIR."
            )
        elif average_rir > 4:
            suggestions.append(
                "The program may be too easy for hypertrophy. Push working sets closer to 1–3 RIR."
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
            suggestions.append("If calf development matters, add direct calf work because it was not clearly detected.")

        if not suggestions:
            suggestions.append(
                "The program is reasonably balanced. Fine-tune exercise selection and progression based on recovery and performance trends."
            )

        return suggestions[:8]


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


EXERCISE_MUSCLE_MAP: dict[str, dict[str, float]] = {
    "bench press": {"chest": 1.0, "triceps": 0.5, "shoulders": 0.35},
    "incline bench": {"chest": 0.9, "shoulders": 0.45, "triceps": 0.4},
    "incline dumbbell press": {"chest": 0.9, "shoulders": 0.45, "triceps": 0.4},
    "dumbbell press": {"chest": 0.9, "triceps": 0.45, "shoulders": 0.35},
    "chest press": {"chest": 1.0, "triceps": 0.4, "shoulders": 0.3},
    "push up": {"chest": 0.8, "triceps": 0.45, "shoulders": 0.3},
    "dip": {"chest": 0.65, "triceps": 0.8, "shoulders": 0.25},
    "cable fly": {"chest": 0.9, "shoulders": 0.2},
    "pec deck": {"chest": 0.9, "shoulders": 0.2},
    "pull up": {"back": 0.8, "biceps": 0.5},
    "chin up": {"back": 0.75, "biceps": 0.6},
    "lat pulldown": {"back": 0.85, "biceps": 0.4},
    "row": {"back": 0.9, "biceps": 0.35, "shoulders": 0.2},
    "barbell row": {"back": 1.0, "biceps": 0.35, "hamstrings": 0.15},
    "seated row": {"back": 0.9, "biceps": 0.35},
    "face pull": {"shoulders": 0.6, "back": 0.3},
    "pullover": {"back": 0.7, "chest": 0.2},
    "overhead press": {"shoulders": 1.0, "triceps": 0.6},
    "shoulder press": {"shoulders": 1.0, "triceps": 0.55},
    "lateral raise": {"shoulders": 0.85},
    "rear delt fly": {"shoulders": 0.7, "back": 0.25},
    "upright row": {"shoulders": 0.7, "back": 0.3},
    "curl": {"biceps": 1.0},
    "hammer curl": {"biceps": 0.9},
    "preacher curl": {"biceps": 1.0},
    "tricep pushdown": {"triceps": 1.0},
    "triceps pushdown": {"triceps": 1.0},
    "skullcrusher": {"triceps": 1.0},
    "triceps extension": {"triceps": 0.95},
    "squat": {"quads": 0.9, "glutes": 0.7, "hamstrings": 0.25},
    "back squat": {"quads": 1.0, "glutes": 0.7, "hamstrings": 0.2},
    "front squat": {"quads": 1.0, "glutes": 0.5},
    "leg press": {"quads": 0.9, "glutes": 0.5},
    "split squat": {"quads": 0.8, "glutes": 0.6},
    "lunge": {"quads": 0.75, "glutes": 0.7, "hamstrings": 0.2},
    "leg extension": {"quads": 1.0},
    "romanian deadlift": {"hamstrings": 1.0, "glutes": 0.75},
    "rdl": {"hamstrings": 1.0, "glutes": 0.75},
    "deadlift": {"hamstrings": 0.8, "glutes": 0.8, "back": 0.5},
    "stiff leg deadlift": {"hamstrings": 1.0, "glutes": 0.65},
    "leg curl": {"hamstrings": 1.0},
    "hip thrust": {"glutes": 1.0, "hamstrings": 0.35},
    "glute bridge": {"glutes": 0.95, "hamstrings": 0.3},
    "calf raise": {"calves": 1.0},
    "seated calf raise": {"calves": 1.0},
    "standing calf raise": {"calves": 1.0},
    "crunch": {"abs": 1.0},
    "sit up": {"abs": 1.0},
    "leg raise": {"abs": 0.9},
    "plank": {"abs": 0.8},
    "ab wheel": {"abs": 1.0},
}
