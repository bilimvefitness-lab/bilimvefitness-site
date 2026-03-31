from fastapi import APIRouter

from app.schemas.training import (
    TrainingProgramAnalysisRequest,
    TrainingProgramAnalysisResponse,
)
from app.schemas.training_report import TrainingProgramReportResponse
from app.services.program_report_generator import ProgramReportGenerator
from app.services.training_analysis_engine import TrainingAnalysisEngine


router = APIRouter(prefix="/training", tags=["training"])
training_analysis_service = TrainingAnalysisEngine()
program_report_generator = ProgramReportGenerator()


@router.post("/analyze", response_model=TrainingProgramAnalysisResponse)
async def analyze_training_program(
    payload: TrainingProgramAnalysisRequest,
) -> TrainingProgramAnalysisResponse:
    return training_analysis_service.analyze_program(payload.program_text)


@router.post("/report", response_model=TrainingProgramReportResponse)
async def generate_training_program_report(
    payload: TrainingProgramAnalysisResponse,
) -> TrainingProgramReportResponse:
    return program_report_generator.generate_report(payload)
