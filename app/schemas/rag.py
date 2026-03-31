from pydantic import BaseModel, Field


class RAGQuestionRequest(BaseModel):
    question: str = Field(..., min_length=1)
    top_k: int = Field(default=5, ge=1, le=10)
    document_id: str | None = None


class SourceReference(BaseModel):
    vector_id: str
    document_id: str
    chunk_id: str | None = None
    chapter: str | None = None
    section: str | None = None
    page: int | None = Field(default=None, ge=1)
    page_end: int | None = Field(default=None, ge=1)
    filename: str | None = None


class RetrievedChunk(BaseModel):
    vector_id: str
    document_id: str
    chunk_index: int = Field(..., ge=0)
    score: float
    text: str
    metadata: dict[str, int | str | None]
    source: SourceReference


class RAGAnswerResponse(BaseModel):
    question: str
    answer: str
    answer_strategy: str
    answer_supported: bool
    retrieved_chunk_count: int = Field(..., ge=0)
    retrieved_chunks: list[RetrievedChunk]
    sources: list[SourceReference]
