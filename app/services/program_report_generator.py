from app.schemas.training import TrainingProgramAnalysisResponse
from app.schemas.training_report import (
    ProgramReportAction,
    ProgramReportMetric,
    ProgramReportSection,
    TrainingProgramReportResponse,
)


class ProgramReportGenerator:
    def generate_report(
        self,
        analysis: TrainingProgramAnalysisResponse,
    ) -> TrainingProgramReportResponse:
        sections = self._build_sections(analysis)
        report_text = self._build_report_text(sections)
        return TrainingProgramReportResponse(
            report_text=report_text,
            report_sections=sections,
        )

    def _build_sections(
        self,
        analysis: TrainingProgramAnalysisResponse,
    ) -> list[ProgramReportSection]:
        score_tier = self._score_tier(analysis.hypertrophy_score)
        strengths = analysis.main_strengths or ["No clear strengths stood out yet."]
        limiters = analysis.main_limiters or ["No major limiter stood out."]
        actions = analysis.next_best_actions or [
            ProgramReportAction(
                priority="low",
                title="Maintain the current plan",
                description="No urgent change stands out, so keep progressing and monitor recovery.",
            )
        ]

        sections = [
            ProgramReportSection(
                key="hypertrophy_score",
                title="Hypertrophy Score",
                summary=f"{analysis.hypertrophy_score}/100 ({score_tier})",
                metrics=[
                    ProgramReportMetric(
                        key="weekly_volume_adequacy",
                        label="Volume",
                        value=f"{analysis.score_breakdown.weekly_volume_adequacy.score}/100",
                        detail=analysis.score_breakdown.weekly_volume_adequacy.explanation,
                    ),
                    ProgramReportMetric(
                        key="frequency_adequacy",
                        label="Frequency",
                        value=f"{analysis.score_breakdown.frequency_adequacy.score}/100",
                        detail=analysis.score_breakdown.frequency_adequacy.explanation,
                    ),
                    ProgramReportMetric(
                        key="estimated_effort_quality",
                        label="Effort",
                        value=f"{analysis.score_breakdown.estimated_effort_quality.score}/100",
                        detail=analysis.score_breakdown.estimated_effort_quality.explanation,
                    ),
                    ProgramReportMetric(
                        key="exercise_selection_quality",
                        label="Exercise Selection",
                        value=f"{analysis.score_breakdown.exercise_selection_quality.score}/100",
                        detail=analysis.score_breakdown.exercise_selection_quality.explanation,
                    ),
                    ProgramReportMetric(
                        key="fatigue_balance",
                        label="Fatigue Balance",
                        value=f"{analysis.score_breakdown.fatigue_balance.score}/100",
                        detail=analysis.score_breakdown.fatigue_balance.explanation,
                    ),
                ],
            ),
            ProgramReportSection(
                key="overall_interpretation",
                title="Overall Interpretation",
                summary=analysis.overall_interpretation,
            ),
            ProgramReportSection(
                key="strengths",
                title="Strengths",
                bullets=strengths,
            ),
            ProgramReportSection(
                key="limiters",
                title="Limiters",
                bullets=limiters,
            ),
            ProgramReportSection(
                key="key_metrics",
                title="Key Metrics",
                metrics=self._build_key_metrics(analysis),
            ),
            ProgramReportSection(
                key="fatigue_risk",
                title="Fatigue Risk",
                summary=self._build_fatigue_summary(analysis),
            ),
            ProgramReportSection(
                key="next_best_actions",
                title="Next Best Actions",
                actions=actions,
            ),
            ProgramReportSection(
                key="final_coach_summary",
                title="Final Coach Summary",
                summary=self._build_coach_summary(
                    analysis=analysis,
                    score_tier=score_tier,
                    strengths=strengths,
                    limiters=limiters,
                    actions=actions,
                ),
            ),
        ]
        return sections

    def _build_key_metrics(
        self,
        analysis: TrainingProgramAnalysisResponse,
    ) -> list[ProgramReportMetric]:
        metrics: list[ProgramReportMetric] = []

        for muscle in sorted(analysis.weekly_volume_per_muscle_group.keys()):
            weekly_sets = analysis.weekly_volume_per_muscle_group[muscle]
            frequency = analysis.frequency_per_muscle_group.get(muscle, 0)
            metrics.append(
                ProgramReportMetric(
                    key=f"muscle_{muscle}",
                    label=muscle.replace("_", " ").title(),
                    value=f"{weekly_sets:.2f} weekly sets",
                    detail=f"Frequency: {frequency}x per week",
                )
            )

        metrics.append(
            ProgramReportMetric(
                key="estimated_rir",
                label="Estimated RIR",
                value=f"{analysis.estimated_rir_level.estimated_average_rir:.2f}",
                detail=analysis.estimated_rir_level.interpretation,
            )
        )
        return metrics

    def _build_fatigue_summary(
        self,
        analysis: TrainingProgramAnalysisResponse,
    ) -> str:
        risk_label = analysis.fatigue_risk.title()
        fatigue_detail = analysis.score_breakdown.fatigue_balance.explanation
        return f"{risk_label} fatigue risk. {fatigue_detail}"

    def _build_coach_summary(
        self,
        analysis: TrainingProgramAnalysisResponse,
        score_tier: str,
        strengths: list[str],
        limiters: list[str],
        actions: list[ProgramReportAction],
    ) -> str:
        top_strength = strengths[0]
        top_limiter = limiters[0]
        top_action = actions[0]
        return (
            f"This program currently rates as {analysis.hypertrophy_score}/100, which places it in the {score_tier.lower()} tier. "
            f"The biggest positive is that {top_strength[0].lower() + top_strength[1:] if top_strength else 'it has some usable structure'}. "
            f"The main issue holding it back is that {top_limiter[0].lower() + top_limiter[1:] if top_limiter else 'it still needs better balance across the week'}. "
            f"The next best move is to {top_action.title.lower()} by {top_action.description[0].lower() + top_action.description[1:]}."
        )

    def _build_report_text(
        self,
        sections: list[ProgramReportSection],
    ) -> str:
        lines: list[str] = []

        for section in sections:
            lines.append(section.title.upper())
            if section.summary:
                lines.append(section.summary)
            for bullet in section.bullets:
                lines.append(f"- {bullet}")
            for metric in section.metrics:
                if metric.detail:
                    lines.append(f"- {metric.label}: {metric.value} ({metric.detail})")
                else:
                    lines.append(f"- {metric.label}: {metric.value}")
            for action in section.actions:
                lines.append(
                    f"- [{action.priority.title()}] {action.title}: {action.description}"
                )
            lines.append("")

        return "\n".join(lines).strip()

    def _score_tier(self, hypertrophy_score: int) -> str:
        if hypertrophy_score >= 80:
            return "Advanced"
        if hypertrophy_score >= 60:
            return "Intermediate"
        return "Beginner"
