from datetime import datetime, timezone
from uuid import uuid4

from app.core.config import settings
from app.db.document_store import DocumentStore, StoredChunkRecord, StoredDocumentRecord
from app.db.vector_store import VectorRecord, VectorStore
from app.schemas.document import ChunkVectorRecord, PDFUploadResponse
from app.services.chunking import chunk_text
from app.services.embeddings import EmbeddingService
from app.services.pdf_extractor import PDFExtractor


class DocumentIngestionService:
    def __init__(
        self,
        pdf_extractor: PDFExtractor,
        embedding_service: EmbeddingService | None = None,
        vector_store: VectorStore | None = None,
        document_store: DocumentStore | None = None,
    ) -> None:
        self.pdf_extractor = pdf_extractor
        self.embedding_service = embedding_service
        self.vector_store = vector_store
        self.document_store = document_store

    async def ingest(
        self,
        filename: str,
        content_type: str,
        file_bytes: bytes,
    ) -> PDFUploadResponse:
        extraction = self.pdf_extractor.extract(file_bytes)
        document_id = str(uuid4())
        created_at = datetime.now(timezone.utc).isoformat()
        chunks = chunk_text(
            extraction.pages,
            document_id=document_id,
            min_words=settings.chunk_min_words,
            max_words=settings.chunk_max_words,
            overlap_words=settings.chunk_overlap_words,
        )

        embeddings: list[list[float]] = []
        vector_records: list[VectorRecord] = []
        vector_store_status = "skipped"

        if self.embedding_service and chunks:
            embeddings = await self.embedding_service.embed_texts(
                [chunk.text for chunk in chunks]
            )
            vector_records = [
                VectorRecord(
                    vector_id=f"{document_id}-chunk-{chunk.chunk_index}",
                    document_id=document_id,
                    chunk_index=chunk.chunk_index,
                    text=chunk.text,
                    embedding=embedding,
                    metadata={
                        "chunk_id": chunk.chunk_id,
                        "filename": filename,
                        "page_count": extraction.page_count,
                        "chunk_index": chunk.chunk_index,
                        "start_word": chunk.start_word,
                        "end_word": chunk.end_word,
                        "word_count": chunk.word_count,
                        "page": chunk.page,
                        "page_end": chunk.page_end,
                        "chapter": chunk.chapter,
                        "section": chunk.section,
                    },
                )
                for chunk, embedding in zip(chunks, embeddings, strict=False)
            ]

            vector_ids_by_chunk = {
                record.chunk_index: record.vector_id for record in vector_records
            }
            for chunk in chunks:
                chunk.vector_id = vector_ids_by_chunk.get(chunk.chunk_index)

            if self.vector_store:
                await self.vector_store.upsert_records(vector_records)
                vector_store_status = "indexed"
            else:
                vector_store_status = "ready"

        if self.document_store:
            await self.document_store.save_document(
                StoredDocumentRecord(
                    document_id=document_id,
                    filename=filename,
                    content_type=content_type,
                    page_count=extraction.page_count,
                    extracted_text=extraction.text,
                    chunk_count=len(chunks),
                    created_at=created_at,
                    chunks=[
                        StoredChunkRecord(
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
                        for chunk in chunks
                    ],
                )
            )

        return PDFUploadResponse(
            document_id=document_id,
            filename=filename,
            content_type=content_type,
            page_count=extraction.page_count,
            created_at=created_at,
            extracted_text=extraction.text,
            chunk_count=len(chunks),
            chunks=chunks,
            embedding_model=(
                self.embedding_service.model_name
                if self.embedding_service
                else "not-configured"
            ),
            embedding_dimensions=(
                self.embedding_service.dimension
                if self.embedding_service
                else 0
            ),
            vector_store_status=vector_store_status,
            vector_records=[
                ChunkVectorRecord(
                    vector_id=record.vector_id,
                    document_id=record.document_id,
                    chunk_index=record.chunk_index,
                    text=record.text,
                    embedding=record.embedding,
                    metadata={
                        key: value
                        for key, value in record.metadata.items()
                        if isinstance(value, (str, int)) or value is None
                    },
                )
                for record in vector_records
            ],
        )
