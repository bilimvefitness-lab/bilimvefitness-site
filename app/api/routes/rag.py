from fastapi import APIRouter, HTTPException

from app.core.dependencies import get_rag_pipeline_service
from app.schemas.rag import RAGAnswerResponse, RAGQuestionRequest


router = APIRouter(prefix="/rag", tags=["rag"])
rag_pipeline_service = get_rag_pipeline_service()


@router.post("/ask", response_model=RAGAnswerResponse)
async def ask_question(payload: RAGQuestionRequest) -> RAGAnswerResponse:
    try:
        return await rag_pipeline_service.answer_question(
            question=payload.question,
            top_k=payload.top_k,
            document_id=payload.document_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
