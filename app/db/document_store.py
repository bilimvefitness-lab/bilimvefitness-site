from dataclasses import dataclass
from typing import Protocol, Sequence


@dataclass(slots=True)
class StoredChunkRecord:
    chunk_id: str
    document_id: str
    chunk_index: int
    start_word: int
    end_word: int
    word_count: int
    text: str
    page: int | None = None
    page_end: int | None = None
    chapter: str | None = None
    section: str | None = None
    vector_id: str | None = None


@dataclass(slots=True)
class StoredDocumentRecord:
    document_id: str
    filename: str
    content_type: str
    page_count: int
    extracted_text: str
    chunk_count: int
    created_at: str
    chunks: list[StoredChunkRecord]


class DocumentStore(Protocol):
    async def save_document(self, record: StoredDocumentRecord) -> None:
        """Persist the processed document and its chunk metadata."""

    async def list_documents(self) -> Sequence[StoredDocumentRecord]:
        """List all stored documents."""

    async def get_document(self, document_id: str) -> StoredDocumentRecord | None:
        """Return a single stored document by id."""


class InMemoryDocumentStore:
    def __init__(self) -> None:
        self._documents: dict[str, StoredDocumentRecord] = {}

    async def save_document(self, record: StoredDocumentRecord) -> None:
        self._documents[record.document_id] = record

    async def list_documents(self) -> Sequence[StoredDocumentRecord]:
        return list(self._documents.values())

    async def get_document(self, document_id: str) -> StoredDocumentRecord | None:
        return self._documents.get(document_id)
