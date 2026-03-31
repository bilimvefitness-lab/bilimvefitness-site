from fastapi import APIRouter, File, HTTPException, UploadFile, status

from app.core.config import settings
from app.core.dependencies import (
    get_document_catalog_service,
    get_document_ingestion_service,
)
from app.schemas.document import DocumentDetail, DocumentSummary, PDFUploadResponse


router = APIRouter(tags=["documents"])
ingestion_service = get_document_ingestion_service()
document_catalog_service = get_document_catalog_service()


@router.post(
    "/upload",
    response_model=PDFUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_document(file: UploadFile = File(...)) -> PDFUploadResponse:
    if file.content_type not in {"application/pdf", "application/x-pdf"}:
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(file_bytes) > settings.max_upload_size_bytes:
        raise HTTPException(status_code=413, detail="Uploaded file is too large.")

    try:
        return await ingestion_service.ingest(
            filename=file.filename or "document.pdf",
            content_type=file.content_type or "application/pdf",
            file_bytes=file_bytes,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.get("/documents", response_model=list[DocumentSummary])
async def list_documents() -> list[DocumentSummary]:
    return await document_catalog_service.list_documents()


@router.get("/documents/{document_id}", response_model=DocumentDetail)
async def get_document(document_id: str) -> DocumentDetail:
    document = await document_catalog_service.get_document(document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found.")
    return document
