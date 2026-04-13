from fastapi import APIRouter

from app.api.routes import chat, dashboard, documents, friends, health, hydration, meals, nutrition, posture, rag, sleep, social, step_social, steps, training, user, voice


api_router = APIRouter()
api_router.include_router(health.router)
api_router.include_router(friends.router)
api_router.include_router(social.router)
api_router.include_router(documents.router)
api_router.include_router(chat.router)
api_router.include_router(rag.router)
api_router.include_router(training.router)
api_router.include_router(nutrition.router)
api_router.include_router(meals.router)
api_router.include_router(user.router)
api_router.include_router(dashboard.router)
api_router.include_router(hydration.router)
api_router.include_router(steps.router)
api_router.include_router(step_social.router)
api_router.include_router(sleep.router)
api_router.include_router(voice.router)
api_router.include_router(posture.router)
