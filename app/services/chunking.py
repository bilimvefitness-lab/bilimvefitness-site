import re
from dataclasses import dataclass

from app.schemas.document import DocumentChunk
from app.services.pdf_extractor import PDFPageContent


@dataclass(slots=True)
class _WordToken:
    text: str
    page_number: int


@dataclass(slots=True)
class _HeadingMarker:
    kind: str
    value: str
    word_index: int


def chunk_text(
    pages: list[PDFPageContent],
    document_id: str,
    min_words: int,
    max_words: int,
    overlap_words: int,
) -> list[DocumentChunk]:
    if min_words <= 0:
        raise ValueError("min_words must be greater than zero")
    if max_words < min_words:
        raise ValueError("max_words must be greater than or equal to min_words")
    if overlap_words < 0:
        raise ValueError("overlap_words cannot be negative")
    if overlap_words >= min_words:
        raise ValueError("overlap_words must be smaller than min_words")

    tokens, headings = _build_word_tokens_and_headings(pages)
    if not tokens:
        return []

    total_words = len(tokens)
    if total_words <= max_words:
        chapter, section = _resolve_headings(headings, total_words - 1)
        return [
            DocumentChunk(
                chunk_id=f"{document_id}-chunk-0",
                document_id=document_id,
                chunk_index=0,
                start_word=0,
                end_word=total_words - 1,
                word_count=total_words,
                text=" ".join(token.text for token in tokens),
                page=tokens[0].page_number,
                page_end=tokens[-1].page_number,
                chapter=chapter,
                section=section,
            )
        ]

    chunk_count = _determine_chunk_count(
        total_words=total_words,
        min_words=min_words,
        max_words=max_words,
        overlap_words=overlap_words,
    )
    chunk_lengths = _build_chunk_lengths(
        total_words=total_words,
        chunk_count=chunk_count,
        min_words=min_words,
        max_words=max_words,
        overlap_words=overlap_words,
    )

    chunks: list[DocumentChunk] = []
    start_word = 0
    for index, length in enumerate(chunk_lengths):
        end_word = start_word + length
        chunk_tokens = tokens[start_word:end_word]
        chapter, section = _resolve_headings(headings, end_word - 1)

        chunks.append(
            DocumentChunk(
                chunk_id=f"{document_id}-chunk-{index}",
                document_id=document_id,
                chunk_index=index,
                start_word=start_word,
                end_word=end_word - 1,
                word_count=len(chunk_tokens),
                text=" ".join(token.text for token in chunk_tokens),
                page=chunk_tokens[0].page_number if chunk_tokens else None,
                page_end=chunk_tokens[-1].page_number if chunk_tokens else None,
                chapter=chapter,
                section=section,
            )
        )

        start_word = end_word - overlap_words

    return chunks


def _determine_chunk_count(
    total_words: int,
    min_words: int,
    max_words: int,
    overlap_words: int,
) -> int:
    chunk_count = 1
    while True:
        min_coverage = (chunk_count * min_words) - (overlap_words * (chunk_count - 1))
        max_coverage = (chunk_count * max_words) - (overlap_words * (chunk_count - 1))
        if min_coverage <= total_words <= max_coverage:
            return chunk_count
        chunk_count += 1


def _build_chunk_lengths(
    total_words: int,
    chunk_count: int,
    min_words: int,
    max_words: int,
    overlap_words: int,
) -> list[int]:
    total_allocated_words = total_words + (overlap_words * (chunk_count - 1))
    base_lengths = [min_words] * chunk_count
    extra_words = total_allocated_words - (min_words * chunk_count)

    index = 0
    while extra_words > 0:
        available = max_words - base_lengths[index]
        increment = min(available, extra_words)
        base_lengths[index] += increment
        extra_words -= increment
        index = (index + 1) % chunk_count

    return base_lengths


def _build_word_tokens_and_headings(
    pages: list[PDFPageContent],
) -> tuple[list[_WordToken], list[_HeadingMarker]]:
    tokens: list[_WordToken] = []
    headings: list[_HeadingMarker] = []
    current_word_index = 0

    for page in pages:
        for raw_line in page.text.splitlines():
            line = " ".join(raw_line.strip().split())
            if not line:
                continue

            heading_kind = _classify_heading(line)
            if heading_kind is not None:
                headings.append(
                    _HeadingMarker(
                        kind=heading_kind,
                        value=line,
                        word_index=current_word_index,
                    )
                )

            for word in line.split(" "):
                tokens.append(_WordToken(text=word, page_number=page.page_number))
                current_word_index += 1

    return tokens, headings


def _classify_heading(line: str) -> str | None:
    lowered = line.lower()
    word_count = len(line.split())

    if re.match(r"^(chapter|part|book)\b", lowered):
        return "chapter"
    if re.match(r"^(section|appendix|prologue|epilogue)\b", lowered):
        return "section"
    if re.match(r"^\d+(\.\d+)*\s+\S+", line):
        return "section"
    if word_count <= 8 and not line.endswith((".", "!", "?", ":")):
        if line.isupper():
            return "section"
        if line == line.title():
            return "section"

    return None


def _resolve_headings(
    headings: list[_HeadingMarker],
    word_index: int,
) -> tuple[str | None, str | None]:
    chapter: str | None = None
    section: str | None = None

    for heading in headings:
        if heading.word_index > word_index:
            break
        if heading.kind == "chapter":
            chapter = heading.value
        elif heading.kind == "section":
            section = heading.value

    return chapter, section
