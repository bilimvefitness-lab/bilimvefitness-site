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
    meal_log_path_str: str
    hydration_data_path_str: str
    steps_data_path_str: str
    step_engagement_path_str: str
    step_social_path_str: str
    step_social_events_path_str: str
    sleep_data_path_str: str
    portion_profile_path_str: str
    quick_add_profile_path_str: str
    user_profile_path_str: str
    action_tracking_path_str: str
    prime_voice_cache_dir_str: str
    max_upload_size_bytes: int
    chunk_min_words: int
    chunk_max_words: int
    chunk_overlap_words: int
    openai_api_key: str | None
    embedding_model: str
    embedding_dimension: int
    embedding_batch_size: int
    prime_tts_model: str
    prime_tts_voice: str
    expo_push_access_token: str | None

    @property
    def upload_path(self) -> Path:
        path = Path(self.upload_dir)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def meal_log_path(self) -> Path:
        path = Path(self.meal_log_path_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def hydration_data_path(self) -> Path:
        path = Path(self.hydration_data_path_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def steps_data_path(self) -> Path:
        path = Path(self.steps_data_path_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def step_engagement_path(self) -> Path:
        path = Path(self.step_engagement_path_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def step_social_path(self) -> Path:
        path = Path(self.step_social_path_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def step_social_events_path(self) -> Path:
        path = Path(self.step_social_events_path_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def sleep_data_path(self) -> Path:
        path = Path(self.sleep_data_path_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def portion_profile_path(self) -> Path:
        path = Path(self.portion_profile_path_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def quick_add_profile_path(self) -> Path:
        path = Path(self.quick_add_profile_path_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def user_profile_path(self) -> Path:
        path = Path(self.user_profile_path_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def action_tracking_path(self) -> Path:
        path = Path(self.action_tracking_path_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.parent.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def prime_voice_cache_dir(self) -> Path:
        path = Path(self.prime_voice_cache_dir_str)
        if not path.is_absolute():
            path = PROJECT_ROOT / path
        path.mkdir(parents=True, exist_ok=True)
        return path


def get_settings() -> Settings:
    return Settings(
        app_name=os.getenv("APP_NAME", "RAG Backend"),
        api_prefix=os.getenv("API_PREFIX", "/api/v1"),
        upload_dir=os.getenv("UPLOAD_DIR", "data/uploads"),
        meal_log_path_str=os.getenv("MEAL_LOG_PATH", "data/meals.json"),
        hydration_data_path_str=os.getenv("HYDRATION_DATA_PATH", "data/hydration.json"),
        steps_data_path_str=os.getenv("STEPS_DATA_PATH", "data/steps.json"),
        step_engagement_path_str=os.getenv("STEP_ENGAGEMENT_PATH", "data/step_engagement.json"),
        step_social_path_str=os.getenv("STEP_SOCIAL_PATH", "data/step_social.json"),
        step_social_events_path_str=os.getenv("STEP_SOCIAL_EVENTS_PATH", "data/step_social_events.json"),
        sleep_data_path_str=os.getenv("SLEEP_DATA_PATH", "data/sleep.json"),
        portion_profile_path_str=os.getenv("PORTION_PROFILE_PATH", "data/portion_profiles.json"),
        quick_add_profile_path_str=os.getenv("QUICK_ADD_PROFILE_PATH", "data/quick_add_profiles.json"),
        user_profile_path_str=os.getenv("USER_PROFILE_PATH", "data/user_profiles.json"),
        action_tracking_path_str=os.getenv("ACTION_TRACKING_PATH", "data/action_tracking.json"),
        prime_voice_cache_dir_str=os.getenv("PRIME_VOICE_CACHE_DIR", "data/prime_voice"),
        max_upload_size_bytes=int(os.getenv("MAX_UPLOAD_SIZE_BYTES", "10485760")),
        chunk_min_words=int(os.getenv("CHUNK_MIN_WORDS", "400")),
        chunk_max_words=int(os.getenv("CHUNK_MAX_WORDS", "700")),
        chunk_overlap_words=int(os.getenv("CHUNK_OVERLAP_WORDS", "100")),
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        embedding_model=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small"),
        embedding_dimension=int(os.getenv("EMBEDDING_DIMENSION", "1536")),
        embedding_batch_size=int(os.getenv("EMBEDDING_BATCH_SIZE", "128")),
        prime_tts_model=os.getenv("PRIME_TTS_MODEL", "gpt-4o-mini-tts"),
        prime_tts_voice=os.getenv("PRIME_TTS_VOICE", "alloy"),
        expo_push_access_token=os.getenv("EXPO_PUSH_ACCESS_TOKEN"),
    )


settings = get_settings()
settings.upload_path.mkdir(parents=True, exist_ok=True)
settings.meal_log_path.parent.mkdir(parents=True, exist_ok=True)
settings.hydration_data_path.parent.mkdir(parents=True, exist_ok=True)
settings.steps_data_path.parent.mkdir(parents=True, exist_ok=True)
settings.step_engagement_path.parent.mkdir(parents=True, exist_ok=True)
settings.step_social_path.parent.mkdir(parents=True, exist_ok=True)
settings.step_social_events_path.parent.mkdir(parents=True, exist_ok=True)
settings.sleep_data_path.parent.mkdir(parents=True, exist_ok=True)
settings.portion_profile_path.parent.mkdir(parents=True, exist_ok=True)
settings.quick_add_profile_path.parent.mkdir(parents=True, exist_ok=True)
settings.user_profile_path.parent.mkdir(parents=True, exist_ok=True)
settings.action_tracking_path.parent.mkdir(parents=True, exist_ok=True)
settings.prime_voice_cache_dir.mkdir(parents=True, exist_ok=True)
