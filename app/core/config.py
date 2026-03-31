import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


PROJECT_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_ROOT / ".env")


@dataclass(slots=True)
class Settings:
    app_name: str
    api_prefix: str
    upload_dir: str
    max_upload_size_bytes: int
    chunk_min_words: int
    chunk_max_words: int
    chunk_overlap_words: int
    openai_api_key: str | None
    embedding_model: str
    embedding_dimension: int
    embedding_batch_size: int

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.mkdir(parents=True, exist_ok=True)
        return path


def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "RAG Backend"),
        api_prefix=os.getenv("API_PREFIX", "/api/v1"),
        upload_dir=os.getenv("UPLOAD_DIR", "data/uploads"),
        max_upload_size_bytes=int(os.getenv("MAX_UPLOAD_SIZE_BYTES", "10485760")),
        chunk_min_words=int(os.getenv("CHUNK_MIN_WORDS", "400")),
        chunk_max_words=int(os.getenv("CHUNK_MAX_WORDS", "700")),
        chunk_overlap_words=int(os.getenv("CHUNK_OVERLAP_WORDS", "100")),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
        embedding_dimension=int(os.getenv("EMBEDDING_DIMENSION", "1536")),
        embedding_batch_size=int(os.getenv("EMBEDDING_BATCH_SIZE", "128")),
    )


settings = get_settings()
settings.upload_path.mkdir(parents=True, exist_ok=True)
