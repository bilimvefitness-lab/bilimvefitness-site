import re
from dataclasses import dataclass

from app.db.vector_store import VectorMatch, VectorStore
from app.schemas.rag import RAGAnswerResponse, RetrievedChunk, SourceReference
from app.services.embeddings import EmbeddingService


UNSUPPORTED_ANSWER = "This information is not available in the provided sources."


@dataclass(slots=True)
class _SupportedSentence:
    text: str
    support_score: float
    overlap_count: int
    source: SourceReference


@dataclass(slots=True)
class _RerankedMatch:
    match: VectorMatch
    retrieval_score: float
    overlap_count: int
    overlap_ratio: float


class RAGPipelineService:
    def __init__(
        self,
        embedding_service: EmbeddingService | None,
        vector_store: VectorStore,
    ) -> None:
        self.embedding_service = embedding_service
        self.vector_store = vector_store

    async def answer_question(
        self,
        question: str,
        top_k: int = 5,
        document_id: str | None = None,
    ) -> RAGAnswerResponse:
        normalized_question = question.strip()
        if not normalized_question:
            raise ValueError("Question cannot be empty.")
        if self.embedding_service is None:
            raise ValueError(
                "OPENAI_API_KEY is not configured. Set it in your .env file before using /chat."
            )

        matches = await self._retrieve_high_confidence_matches(
            question=normalized_question,
            top_k=top_k,
            document_id=document_id,
        )

        retrieved_chunks = [
            RetrievedChunk(
                vector_id=match.record.vector_id,
                document_id=match.record.document_id,
                chunk_index=match.record.chunk_index,
                score=round(match.score, 6),
                text=match.record.text,
                metadata={
                    key: value
                    for key, value in match.record.metadata.items()
                    if isinstance(value, (str, int)) or value is None
                },
                source=self._build_source_reference(match),
            )
            for match in matches
        ]

        answer, answer_supported, used_sources = self._generate_answer(
            normalized_question,
            matches,
        )

        return RAGAnswerResponse(
            question=normalized_question,
            answer=answer,
            answer_strategy="strict-extractive-from-retrieved-chunks",
            answer_supported=answer_supported,
            retrieved_chunk_count=len(retrieved_chunks),
            retrieved_chunks=retrieved_chunks,
            sources=used_sources or self._dedupe_sources(
                [retrieved_chunk.source for retrieved_chunk in retrieved_chunks]
            ),
        )

    async def _retrieve_high_confidence_matches(
        self,
        question: str,
        top_k: int,
        document_id: str | None,
    ) -> list[VectorMatch]:
        question_terms = _tokenize(question)
        if not question_terms:
            return []

        query_embedding = (await self.embedding_service.embed_texts([question]))[0]
        candidate_count = min(max(top_k * 3, top_k), 20)
        candidate_matches = await self.vector_store.query_similar(
            embedding=query_embedding,
            top_k=candidate_count,
            document_id=document_id,
        )

        reranked_matches = self._rerank_matches(candidate_matches, question_terms)
        return [
            VectorMatch(record=item.match.record, score=item.retrieval_score)
            for item in reranked_matches[:top_k]
        ]

    def _generate_answer(
        self,
        question: str,
        matches: list[VectorMatch],
    ) -> tuple[str, bool, list[SourceReference]]:
        if not matches:
            return UNSUPPORTED_ANSWER, False, []

        ranked_sentences = self._rank_supported_sentences(question, matches)
        if not ranked_sentences:
            return UNSUPPORTED_ANSWER, False, []

        selected_sentences: list[str] = []
        selected_sources: list[SourceReference] = []
        seen_sentences: set[str] = set()

        for candidate in ranked_sentences:
            normalized_sentence = candidate.text.strip()
            if not normalized_sentence or normalized_sentence in seen_sentences:
                continue

            selected_sentences.append(normalized_sentence)
            selected_sources.append(candidate.source)
            seen_sentences.add(normalized_sentence)

            if len(selected_sentences) == 3:
                break

        if not selected_sentences:
            return UNSUPPORTED_ANSWER, False, []

        return " ".join(selected_sentences), True, self._dedupe_sources(selected_sources)

    def _rerank_matches(
        self,
        matches: list[VectorMatch],
        question_terms: set[str],
    ) -> list[_RerankedMatch]:
        reranked_matches: list[_RerankedMatch] = []

        for match in matches:
            chunk_terms = _tokenize(match.record.text)
            if not chunk_terms:
                continue

            overlap_count = len(question_terms.intersection(chunk_terms))
            overlap_ratio = overlap_count / max(len(question_terms), 1)
            lexical_bonus = min(overlap_ratio, 1.0) * 0.35
            retrieval_score = match.score + lexical_bonus

            if match.score < 0.18:
                continue
            if overlap_count == 0:
                continue
            if retrieval_score < 0.3:
                continue
            if overlap_ratio < 0.1 and match.score < 0.35:
                continue

            reranked_matches.append(
                _RerankedMatch(
                    match=match,
                    retrieval_score=retrieval_score,
                    overlap_count=overlap_count,
                    overlap_ratio=overlap_ratio,
                )
            )

        reranked_matches.sort(
            key=lambda item: (item.retrieval_score, item.overlap_count, item.match.score),
            reverse=True,
        )
        return reranked_matches

    def _rank_supported_sentences(
        self,
        question: str,
        matches: list[VectorMatch],
    ) -> list[_SupportedSentence]:
        question_terms = _tokenize(question)
        if not question_terms:
            return []

        ranked_sentences: list[_SupportedSentence] = []
        for match in matches:
            sentences = _split_sentences(match.record.text)
            for sentence in sentences:
                sentence_terms = _tokenize(sentence)
                if not sentence_terms:
                    continue

                overlap = len(question_terms.intersection(sentence_terms))
                if overlap == 0:
                    continue

                support_score = match.score + (overlap * 0.2)
                if support_score < 0.15:
                    continue

                ranked_sentences.append(
                    _SupportedSentence(
                        text=sentence,
                        support_score=support_score,
                        overlap_count=overlap,
                        source=self._build_source_reference(match),
                    )
                )

        ranked_sentences.sort(
            key=lambda item: (item.overlap_count, item.support_score),
            reverse=True,
        )
        return ranked_sentences

    def _build_source_reference(self, match: VectorMatch) -> SourceReference:
        metadata = match.record.metadata
        page = metadata.get("page")
        page_end = metadata.get("page_end")

        return SourceReference(
            vector_id=match.record.vector_id,
            document_id=match.record.document_id,
            chunk_id=_string_or_none(metadata.get("chunk_id")),
            chapter=_string_or_none(metadata.get("chapter")),
            section=_string_or_none(metadata.get("section")),
            page=page if isinstance(page, int) else None,
            page_end=page_end if isinstance(page_end, int) else None,
            filename=_string_or_none(metadata.get("filename")),
        )

    def _dedupe_sources(self, sources: list[SourceReference]) -> list[SourceReference]:
        unique_sources: list[SourceReference] = []
        seen_vector_ids: set[str] = set()

        for source in sources:
            if source.vector_id in seen_vector_ids:
                continue
            unique_sources.append(source)
            seen_vector_ids.add(source.vector_id)

        return unique_sources


def _split_sentences(text: str) -> list[str]:
    return [part.strip() for part in re.split(r"(?<=[.!?])\s+", text) if part.strip()]


def _tokenize(text: str) -> set[str]:
    return {
        token
        for token in re.findall(r"\b[a-zA-Z0-9]{2,}\b", text.lower())
        if token not in _STOPWORDS
    }


def _string_or_none(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
}
