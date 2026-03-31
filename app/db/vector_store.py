import math
from dataclasses import dataclass
from typing import Any, Protocol, Sequence


@dataclass(slots=True)
class VectorRecord:
    vector_id: str
    document_id: str
    chunk_index: int
    text: str
    embedding: list[float]
    metadata: dict[str, Any]


@dataclass(slots=True)
class VectorMatch:
    record: VectorRecord
    score: float


class VectorStore(Protocol):
    async def upsert_records(self, records: Sequence[VectorRecord]) -> None:
        """Persist chunk embeddings for later retrieval."""

    async def query_similar(
        self,
        embedding: Sequence[float],
        top_k: int = 3,
        document_id: str | None = None,
    ) -> list[VectorMatch]:
        """Return the most similar stored records for a query embedding."""


class InMemoryVectorStore:
    """Temporary in-memory store for local development."""

    def __init__(self) -> None:
        self._items: dict[str, list[VectorRecord]] = {}

    async def upsert_records(self, records: Sequence[VectorRecord]) -> None:
        grouped_records: dict[str, list[VectorRecord]] = {}
        for record in records:
            grouped_records.setdefault(record.document_id, []).append(record)

        for document_id, document_records in grouped_records.items():
            self._items[document_id] = document_records

    async def query_similar(
        self,
        embedding: Sequence[float],
        top_k: int = 3,
        document_id: str | None = None,
    ) -> list[VectorMatch]:
        if top_k <= 0:
            return []

        candidate_records = (
            self._items.get(document_id, [])
            if document_id
            else [record for records in self._items.values() for record in records]
        )

        matches = [
            VectorMatch(record=record, score=_cosine_similarity(embedding, record.embedding))
            for record in candidate_records
        ]
        matches.sort(key=lambda match: match.score, reverse=True)
        return matches[:top_k]


def _cosine_similarity(left: Sequence[float], right: Sequence[float]) -> float:
    if len(left) != len(right):
        raise ValueError("Embeddings must have the same dimensions for similarity search")

    dot_product = sum(left_value * right_value for left_value, right_value in zip(left, right))
    left_norm = math.sqrt(sum(value * value for value in left))
    right_norm = math.sqrt(sum(value * value for value in right))

    if left_norm == 0 or right_norm == 0:
        return 0.0

    return dot_product / (left_norm * right_norm)
