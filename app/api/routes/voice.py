from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.core.dependencies import get_prime_voice_service


router = APIRouter(prefix="/voice", tags=["voice"])
prime_voice_service = get_prime_voice_service()


@router.get("/audio/{file_name}")
async def get_prime_voice_audio(file_name: str) -> FileResponse:
    file_path = prime_voice_service.resolve_audio_path(file_name)
    if file_path is None:
        raise HTTPException(status_code=404, detail="Voice audio not found.")
    return FileResponse(file_path, media_type="audio/mpeg", filename=file_path.name)
