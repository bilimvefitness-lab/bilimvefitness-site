from pydantic import BaseModel, Field


class ProgramReportMetric(BaseModel):
    key: str
    label: str
    value: str
    detail: str | None = None


class ProgramReportAction(BaseModel):
    priority: str
    title: str
    description: str


class ProgramReportSection(BaseModel):
    key: str
    title: str
    summary: str | None = None
    bullets: list[str] = Field(default_factory=list)
    metrics: list[ProgramReportMetric] = Field(default_factory=list)
    actions: list[ProgramReportAction] = Field(default_factory=list)


class TrainingProgramReportResponse(BaseModel):
    report_text: str
    report_sections: list[ProgramReportSection]
