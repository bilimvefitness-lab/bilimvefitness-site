from dataclasses import dataclass

import fitz


@dataclass(slots=True)
class PDFPageContent:
    page_number: int
    text: str


@dataclass(slots=True)
class PDFExtractionResult:
    text: str
    page_count: int
    pages: list[PDFPageContent]


class PDFExtractor:
    def extract(self, file_bytes: bytes) -> PDFExtractionResult:
        try:
            with fitz.open(stream=file_bytes, filetype="pdf") as document:
                page_text: list[str] = []
                pages: list[PDFPageContent] = []

                for page in document:
                    text = page.get_text("text")
                    page_text.append(text)
                    pages.append(PDFPageContent(page_number=page.number + 1, text=text))

                return PDFExtractionResult(
                    text="\n".join(page_text).strip(),
                    page_count=len(document),
                    pages=pages,
                )
        except RuntimeError as exc:
            raise ValueError("Unable to open PDF file.") from exc
