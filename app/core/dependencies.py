from functools import lru_cache

from app.core.config import settings
from app.db.document_store import InMemoryDocumentStore
from app.db.vector_store import InMemoryVectorStore
from app.services.document_catalog import DocumentCatalogService
from app.services.document_ingestion import DocumentIngestionService
from app.services.embeddings import OpenAIEmbeddingService
from app.services.pdf_extractor import PDFExtractor
from app.services.rag_pipeline import RAGPipelineService


@lru_cache
def get_embedding_service() -> OpenAIEmbeddingService | None:
    if not settings.openai_api_key:
        return None
    return OpenAIEmbeddingService(
        api_key=settings.openai_api_key,
        dimension=settings.embedding_dimension,
        model_name=settings.embedding_model,
        batch_size=settings.embedding_batch_size,
    )


@lru_cache
def get_vector_store() -> InMemoryVectorStore:
    return InMemoryVectorStore()


@lru_cache
def get_document_store() -> InMemoryDocumentStore:
    return InMemoryDocumentStore()


@lru_cache
def get_document_ingestion_service() -> DocumentIngestionService:
    return DocumentIngestionService(
        pdf_extractor=PDFExtractor(),
        embedding_service=get_embedding_service(),
        vector_store=get_vector_store(),
        document_store=get_document_store(),
    )


@lru_cache
def get_rag_pipeline_service() -> RAGPipelineService:
    return RAGPipelineService(
        embedding_service=get_embedding_service(),
        vector_store=get_vector_store(),
    )


@lru_cache
def get_document_catalog_service() -> DocumentCatalogService:
    return DocumentCatalogService(document_store=get_document_store())
