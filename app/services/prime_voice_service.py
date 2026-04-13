import hashlib
from pathlib import Path

from openai import AsyncOpenAI


class PrimeVoiceService:
    def __init__(
        self,
        *,
        api_key: str | None,
        cache_dir: Path,
        model_name: str,
        voice_name: str,
    ) -> None:
        self._client = AsyncOpenAI(api_key=api_key) if api_key else None
        self._cache_dir = cache_dir
        self._cache_dir.mkdir(parents=True, exist_ok=True)
        self._model_name = model_name
        self._voice_name = voice_name

    async def get_or_create_audio_url(
        self,
        *,
        message: str,
        mode: str,
        pressure_level: int,
        variation_seed: str,
        action_type: str = "",
        target_area: str | None = None,
        timing_context: str | None = None,
        day_progression: str | None = None,
        training_status: str | None = None,
    ) -> str:
        prepared = self.build_tts_input(
            message=message,
            mode=mode,
            pressure_level=pressure_level,
            variation_seed=variation_seed,
            action_type=action_type,
            target_area=target_area,
            timing_context=timing_context,
            day_progression=day_progression,
            training_status=training_status,
        )
        if not prepared["text"]:
            return ""

        cache_key = self._build_cache_key(
            message=prepared["text"],
            mode=mode,
            pressure_level=pressure_level,
            variation_key=prepared["variation_key"],
        )
        file_path = self._cache_dir / f"{cache_key}.mp3"
        if file_path.exists() and file_path.stat().st_size > 0:
            return self.build_audio_url(cache_key)
        if not self._client:
            return ""

        try:
            response = await self._client.audio.speech.create(
                model=self._model_name,
                voice=self._voice_name,
                input=prepared["text"],
                instructions=self._instructions_for_mode(mode, prepared["style"], prepared["variant"]),
                response_format="mp3",
                speed=self._speed_for_style(prepared["style"]),
            )
            await response.astream_to_file(file_path)
        except Exception:
            return ""

        if not file_path.exists() or file_path.stat().st_size <= 0:
            return ""
        return self.build_audio_url(cache_key)

    def build_audio_url(self, cache_key: str) -> str:
        return f"/api/v1/voice/audio/{cache_key}.mp3"

    def resolve_audio_path(self, file_name: str) -> Path | None:
        if not file_name.endswith(".mp3"):
            return None
        safe_name = Path(file_name).name
        if safe_name != file_name:
            return None
        path = self._cache_dir / safe_name
        if not path.exists():
            return None
        return path

    def build_tts_input(
        self,
        *,
        message: str,
        mode: str,
        pressure_level: int,
        variation_seed: str,
        action_type: str = "",
        target_area: str | None = None,
        timing_context: str | None = None,
        day_progression: str | None = None,
        training_status: str | None = None,
    ) -> dict[str, str]:
        normalized_message = self._normalize_message(message)
        if not normalized_message:
            return {"text": "", "style": "", "variant": "", "variation_key": ""}

        style = self._style_for_pressure(pressure_level)
        variant = self._variant_for_seed(variation_seed)
        transformed = self._transform_message(
            normalized_message,
            style=style,
            variant=variant,
            mode=mode,
            action_type=action_type,
            target_area=target_area,
            timing_context=timing_context,
            day_progression=day_progression,
            training_status=training_status,
        )
        return {
            "text": transformed,
            "style": style,
            "variant": variant,
            "variation_key": f"{style}:{variant}",
        }

    def _build_cache_key(self, *, message: str, mode: str, pressure_level: int, variation_key: str) -> str:
        payload = f"{self._model_name}|{self._voice_name}|{mode}|{pressure_level}|{variation_key}|{message}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:24]


    @staticmethod
    def _normalize_message(message: str) -> str:
        first_sentence = str(message or "").strip().split(".")[0].strip()
        if not first_sentence:
            return ""
        first_sentence = (
            first_sentence.replace("Simdi", "Şimdi")
            .replace(" simdi", " şimdi")
            .replace("Aksam", "Akşam")
            .replace(" g ", " gram ")
            .replace("G ", "Gram ")
        )
        first_sentence = " ".join(first_sentence.split())
        if not first_sentence.endswith("."):
            first_sentence = f"{first_sentence}."
        return first_sentence[:180]

    @staticmethod
    def _instructions_for_mode(mode: str, style: str, variant: str) -> str:
        if mode == "crisis":
            return (
                f"Speak in Turkish. {style.capitalize()}, direct, sharp, command-first. "
                f"Respect the hard pauses in punctuation. Keep each spoken segment short and imperative. "
                f"Delivery variant: {variant}."
            )
        return (
            f"Speak in Turkish. {style.capitalize()}, direct end-of-day review, command-first. "
            f"Respect the hard pauses in punctuation. Keep each spoken segment short and imperative. "
            f"Delivery variant: {variant}."
        )

    @staticmethod
    def _style_for_pressure(pressure_level: int) -> str:
        if pressure_level >= 3:
            return "strict"
        if pressure_level >= 2:
            return "firm"
        return "calm"

    @staticmethod
    def _speed_for_style(style: str) -> float:
        if style == "strict":
            return 1.06
        if style == "firm":
            return 1.0
        return 0.94

    @staticmethod
    def _variant_for_seed(seed: str) -> str:
        variants = ("pulse", "cut", "focus")
        digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
        return variants[int(digest[:2], 16) % len(variants)]

    @staticmethod
    def _transform_message(
        message: str,
        *,
        style: str,
        variant: str,
        mode: str,
        action_type: str,
        target_area: str | None,
        timing_context: str | None,
        day_progression: str | None,
        training_status: str | None,
    ) -> str:
        action_command = PrimeVoiceService._build_action_command(
            message.rstrip(".").strip(),
            action_type=action_type,
            target_area=target_area,
            timing_context=timing_context,
            day_progression=day_progression,
            training_status=training_status,
        )
        closing = PrimeVoiceService._closing_for_style(style=style, mode=mode, variant=variant)
        opener = PrimeVoiceService._opener_for_style(style=style)

        if style == "strict":
            segments = [opener, action_command]
        else:
            segments = [action_command, closing]

        limited_segments = [PrimeVoiceService._limit_segment_words(segment) for segment in segments if segment]
        return ". ".join(limited_segments[:2]) + "."

    @staticmethod
    def _build_action_command(
        base: str,
        *,
        action_type: str,
        target_area: str | None,
        timing_context: str | None,
        day_progression: str | None,
        training_status: str | None,
    ) -> str:
        normalized = (
            base.replace("Bir sonraki öğüne", "")
            .replace("Bu öğüne", "")
            .replace("Akşam öğününe", "")
            .replace("Akşam", "")
            .replace("Bugüne", "")
            .replace("Şimdi", "")
            .replace("Hala eksik", "")
            .replace("Disiplin düşüyor", "")
            .replace("Disiplin dusuyor", "")
            .replace("Protein yine sarkıyor", "")
            .replace("Protein yine sarkiyor", "")
            .replace("Simdi", "")
        )
        normalized = " ".join(normalized.split()).strip(" ,.")
        if not normalized:
            return "Hedefi tamamla"
        protein_amount = PrimeVoiceService._extract_gram_target(normalized)
        resolved_target_area = target_area or ("Akşam öğününde" if timing_context == "evening" else "Bu öğünde")
        if training_status == "post_workout" and action_type in {"protein_up", "rebalance"} and protein_amount:
            return f"Antrenman sonrası {protein_amount} gram protein ekle"
        if action_type in {"protein_up", "rebalance"} and protein_amount:
            return f"{resolved_target_area} {protein_amount} gram protein ekle"
        if action_type == "calories_down":
            if timing_context == "evening" or day_progression == "late":
                return "Akşam öğününde karbonhidratı kes"
            return "Karbonhidratı burada kes"
        if action_type == "log_meal":
            if target_area == "İlk öğünde":
                return "İlk öğünü gir"
            if timing_context == "evening":
                return "Akşam öğününü gir"
            return "Öğünü gir"
        if action_type == "add_water":
            return "500 ml su iç"
        if action_type == "calories_up":
            return f"{resolved_target_area} dengeli öğün ekle"
        return normalized[0].upper() + normalized[1:]

    @staticmethod
    def _opener_for_style(style: str) -> str:
        if style == "strict":
            return "Şimdi"
        return ""

    @staticmethod
    def _closing_for_style(*, style: str, mode: str, variant: str) -> str:
        if mode == "end_of_day":
            return "Bugün bitir" if style == "firm" else "Kapat"
        if style == "calm":
            return "Eksik kalma" if variant != "cut" else "Açık bırakma"
        if style == "firm":
            return "Geciktirme" if variant != "focus" else "Erteleme"
        return ""

    @staticmethod
    def _limit_segment_words(segment: str) -> str:
        words = segment.split()
        if len(words) <= 8:
            return segment
        return " ".join(words[:8])

    @staticmethod
    def _extract_gram_target(text: str) -> str | None:
        for token in text.split():
            cleaned = token.strip(".,")
            if cleaned.isdigit():
                return cleaned
        return None
