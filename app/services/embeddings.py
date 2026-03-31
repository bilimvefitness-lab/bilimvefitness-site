from typing import Protocol

from openai import AsyncOpenAI


class EmbeddingService(Protocol):
    model_name: str
    dimension: int

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """Return vector embeddings for a list of chunk texts."""


class OpenAIEmbeddingService:
    def __init__(
        self,
        api_key: str | None,
        model_name: str = "text-embedding-3-small",
        dimension: int = 1536,
        batch_size: int = 128,
    ) -> None:
        if dimension <= 0:
            raise ValueError("dimension must be greater than zero")
        if batch_size <= 0:
            raise ValueError("batch_size must be greater than zero")

        self.model_name = model_name
        self.dimension = dimension
        self.batch_size = batch_size
        self._api_key = api_key
        self._client = AsyncOpenAI(api_key=api_key) if api_key else None

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        if not texts:
            return []
        if not self._client:
            raise ValueError("OPENAI_API_KEY is not set.")

        embeddings: list[list[float]] = []
        for batch_start in range(0, len(texts), self.batch_size):
            batch = [text for text in texts[batch_start : batch_start + self.batch_size] if text]
            if not batch:
                continue

            response = await self._client.embeddings.create(
                model=self.model_name,
                input=batch,
                encoding_format="float",
                dimensions=self.dimension,
            )
            embeddings.extend([item.embedding for item in response.data])

        return embeddings
