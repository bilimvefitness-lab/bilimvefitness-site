from functools import lru_cache

from app.core.config import settings
from app.db.action_tracking_store import JsonActionTrackingStore
from app.db.document_store import InMemoryDocumentStore
from app.db.hydration_store import JsonHydrationStore
from app.db.meal_store import JsonMealStore
from app.db.portion_profile_store import JsonPortionProfileStore
from app.db.quick_add_store import JsonQuickAddStore
from app.db.sleep_store import JsonSleepStore
from app.db.step_engagement_store import JsonStepEngagementStore
from app.db.step_social_event_store import JsonStepSocialEventStore
from app.db.step_social_store import JsonStepSocialStore
from app.db.step_store import JsonStepStore
from app.db.user_profile_store import JsonUserProfileStore
from app.db.vector_store import InMemoryVectorStore
from app.services.adaptive_coach_engine import AdaptiveCoachEngine
from app.services.behavior_engine import BehaviorEngine
from app.services.daily_command_service import DailyCommandService
from app.services.daily_action_service import DailyActionService
from app.services.decision_engine import DecisionEngine
from app.services.document_catalog import DocumentCatalogService
from app.services.document_ingestion import DocumentIngestionService
from app.services.embeddings import OpenAIEmbeddingService
from app.services.expo_push_service import ExpoPushService
from app.services.goal_engine import GoalEngine
from app.services.hydration_service import HydrationService
from app.services.meal_logging import MealLoggingService
from app.services.nutrition_calculator_v3 import NutritionCalculationServiceV3
from app.services.nutrition_food_catalog_v2 import FoodCatalog
from app.services.nutrition_parser_v5 import NutritionParserServiceV5
from app.services.nutrition_suggestions import NutritionSuggestionService
from app.services.pdf_extractor import PDFExtractor
from app.services.prime_voice_service import PrimeVoiceService
from app.services.portion_learning import PortionLearningService
from app.services.progress_engine import ProgressEngine
from app.services.quick_add_service import QuickAddService
from app.services.rag_pipeline import RAGPipelineService
from app.services.sleep_service import SleepService
from app.services.step_engagement_service import StepEngagementService
from app.services.step_social_runtime_service import StepSocialService
from app.services.step_service import StepService


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
def get_meal_store() -> JsonMealStore:
    return JsonMealStore(file_path=settings.meal_log_path)


@lru_cache
def get_hydration_store() -> JsonHydrationStore:
    return JsonHydrationStore(file_path=settings.hydration_data_path)


@lru_cache
def get_step_store() -> JsonStepStore:
    return JsonStepStore(file_path=settings.steps_data_path)


@lru_cache
def get_step_engagement_store() -> JsonStepEngagementStore:
    return JsonStepEngagementStore(file_path=settings.step_engagement_path)


@lru_cache
def get_step_social_store() -> JsonStepSocialStore:
    return JsonStepSocialStore(file_path=settings.step_social_path)


@lru_cache
def get_step_social_event_store() -> JsonStepSocialEventStore:
    return JsonStepSocialEventStore(file_path=settings.step_social_events_path)


@lru_cache
def get_sleep_store() -> JsonSleepStore:
    return JsonSleepStore(file_path=settings.sleep_data_path)


@lru_cache
def get_portion_profile_store() -> JsonPortionProfileStore:
    return JsonPortionProfileStore(file_path=settings.portion_profile_path)

@lru_cache
def get_portion_learning_service() -> PortionLearningService:
    return PortionLearningService(store=get_portion_profile_store())


@lru_cache
def get_quick_add_store() -> JsonQuickAddStore:
    return JsonQuickAddStore(file_path=settings.quick_add_profile_path)


@lru_cache
def get_user_profile_store() -> JsonUserProfileStore:
    return JsonUserProfileStore(file_path=settings.user_profile_path)


@lru_cache
def get_action_tracking_store() -> JsonActionTrackingStore:
    return JsonActionTrackingStore(file_path=settings.action_tracking_path)


@lru_cache
def get_hydration_service() -> HydrationService:
    return HydrationService(
        hydration_store=get_hydration_store(),
        user_profile_store=get_user_profile_store(),
        step_service=get_step_service(),
    )


@lru_cache
def get_goal_engine() -> GoalEngine:
    return GoalEngine()


@lru_cache
def get_progress_engine() -> ProgressEngine:
    return ProgressEngine()


@lru_cache
def get_decision_engine() -> DecisionEngine:
    return DecisionEngine()


@lru_cache
def get_step_service() -> StepService:
    return StepService(step_store=get_step_store())


@lru_cache
def get_step_engagement_service() -> StepEngagementService:
    return StepEngagementService(engagement_store=get_step_engagement_store())


@lru_cache
def get_step_social_service() -> StepSocialService:
    return StepSocialService(
        social_store=get_step_social_store(),
        step_store=get_step_store(),
        event_store=get_step_social_event_store(),
        push_service=ExpoPushService(access_token=settings.expo_push_access_token),
    )


@lru_cache
def get_sleep_service() -> SleepService:
    return SleepService(sleep_store=get_sleep_store())


@lru_cache
def get_behavior_engine() -> BehaviorEngine:
    return BehaviorEngine()


@lru_cache
def get_adaptive_coach_engine() -> AdaptiveCoachEngine:
    return AdaptiveCoachEngine()


@lru_cache
def get_prime_voice_service() -> PrimeVoiceService:
    return PrimeVoiceService(
        api_key=settings.openai_api_key,
        cache_dir=settings.prime_voice_cache_dir,
        model_name=settings.prime_tts_model,
        voice_name=settings.prime_tts_voice,
    )


@lru_cache
def get_food_catalog() -> FoodCatalog:
    return FoodCatalog()


@lru_cache
def get_nutrition_parser_service() -> NutritionParserServiceV5:
    return NutritionParserServiceV5(
        food_catalog=get_food_catalog(),
        portion_learning_service=get_portion_learning_service(),
    )


@lru_cache
def get_nutrition_calculation_service() -> NutritionCalculationServiceV3:
    return NutritionCalculationServiceV3(food_catalog=get_food_catalog())

@lru_cache
def get_nutrition_suggestion_service() -> NutritionSuggestionService:
    return NutritionSuggestionService(
        food_catalog=get_food_catalog(),
        meal_store=get_meal_store(),
    )


@lru_cache
def get_meal_logging_service() -> MealLoggingService:
    return MealLoggingService(
        meal_store=get_meal_store(),
        portion_learning_service=get_portion_learning_service(),
        adaptive_coach_engine=get_adaptive_coach_engine(),
        behavior_engine=get_behavior_engine(),
    )


@lru_cache
def get_daily_action_service() -> DailyActionService:
    return DailyActionService(
        meal_logging_service=get_meal_logging_service(),
        action_tracking_store=get_action_tracking_store(),
        prime_voice_service=get_prime_voice_service(),
    )


@lru_cache
def get_daily_command_service() -> DailyCommandService:
    return DailyCommandService(
        meal_logging_service=get_meal_logging_service(),
        hydration_service=get_hydration_service(),
        user_profile_store=get_user_profile_store(),
        goal_engine=get_goal_engine(),
    )


@lru_cache
def get_quick_add_service() -> QuickAddService:
    return QuickAddService(
        meal_store=get_meal_store(),
        quick_add_store=get_quick_add_store(),
    )


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
