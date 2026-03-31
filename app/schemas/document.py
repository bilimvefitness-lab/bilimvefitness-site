from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    chunk_index: int = Field(..., ge=0)
    start_word: int = Field(..., ge=0)
    end_word: int = Field(..., ge=0)
    word_count: int = Field(..., ge=1)
    text: str
    page: int | None = Field(default=None, ge=1)
    page_end: int | None = Field(default=None, ge=1)
    chapter: str | None = None
    section: str | None = None
    vector_id: str | None = None


class DocumentSummary(BaseModel):
    document_id: str
    filename: str
    content_type: str
    page_count: int = Field(..., ge=0)
    chunk_count: int = Field(..., ge=0)
    created_at: str


class DocumentDetail(DocumentSummary):
    extracted_text: str
    chunks: list[DocumentChunk]


class ChunkVectorRecord(BaseModel):
    vector_id: str
    document_id: str
    chunk_index: int = Field(..., ge=0)
    text: str
    embedding: list[float]
    metadata: dict[str, int | str | None]


class PDFUploadResponse(DocumentDetail):
    embedding_model: str
    embedding_dimensions: int = Field(..., ge=0)
    vector_store_status: str
    vector_records: list[ChunkVectorRecord]
