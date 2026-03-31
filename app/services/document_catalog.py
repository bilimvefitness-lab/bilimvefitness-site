from app.db.document_store import DocumentStore, StoredDocumentRecord
from app.schemas.document import DocumentChunk, DocumentDetail, DocumentSummary


class DocumentCatalogService:
    def __init__(self, document_store: DocumentStore) -> None:
        self.document_store = document_store

    async def list_documents(self) -> list[DocumentSummary]:
        records = await self.document_store.list_documents()
        ordered_records = sorted(records, key=lambda record: record.created_at, reverse=True)
        return [self._to_summary(record) for record in ordered_records]

    async def get_document(self, document_id: str) -> DocumentDetail | None:
        record = await self.document_store.get_document(document_id)
        if record is None:
            return None
        return self._to_detail(record)

    def _to_summary(self, record: StoredDocumentRecord) -> DocumentSummary:
        return DocumentSummary(
            document_id=record.document_id,
            filename=record.filename,
            content_type=record.content_type,
            page_count=record.page_count,
            chunk_count=record.chunk_count,
            created_at=record.created_at,
        )

    def _to_detail(self, record: StoredDocumentRecord) -> DocumentDetail:
        return DocumentDetail(
            document_id=record.document_id,
            filename=record.filename,
            content_type=record.content_type,
            page_count=record.page_count,
            chunk_count=record.chunk_count,
            created_at=record.created_at,
            extracted_text=record.extracted_text,
            chunks=[
                DocumentChunk(
                    chunk_id=chunk.chunk_id,
                    document_id=chunk.document_id,
                    chunk_index=chunk.chunk_index,
                    start_word=chunk.start_word,
                    end_word=chunk.end_word,
                    word_count=chunk.word_count,
                    text=chunk.text,
                    page=chunk.page,
                    page_end=chunk.page_end,
                    chapter=chunk.chapter,
                    section=chunk.section,
                    vector_id=chunk.vector_id,
                )
                for chunk in record.chunks
            ],
        )
