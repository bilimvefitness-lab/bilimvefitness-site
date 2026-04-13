from collections import Counter
from datetime import datetime, timezone
from uuid import uuid4

from app.db.meal_store import MealStore
from app.db.quick_add_store import (
    JsonQuickAddStore,
    StoredFavoriteFood,
    StoredFavoriteMeal,
)
from app.schemas.nutrition import (
    FavoriteFoodRequest,
    FavoriteMealRequest,
    QuickAddFood,
    QuickAddMeal,
    QuickAddResponse,
)


class QuickAddService:
    def __init__(self, meal_store: MealStore, quick_add_store: JsonQuickAddStore) -> None:
        self.meal_store = meal_store
        self.quick_add_store = quick_add_store

    async def get_quick_adds(self, user_id: str) -> QuickAddResponse:
        profile = await self.quick_add_store.get_profile(user_id)
        meals = await self.meal_store.get_all_meals(user_id)

        return QuickAddResponse(
            user_id=user_id,
            last_10_foods=self._build_recent_foods(meals),
            favorite_foods=[
                QuickAddFood(
                    quick_add_id=item.quick_add_id,
                    label=item.display_name_tr,
                    quick_text=item.quick_text,
                    canonical_food_id=item.canonical_food_id,
                    meal_type_hint=item.meal_type_hint,
                    source="favorite",
                    last_used_at=item.updated_at,
                    usage_count=0,
                )
                for item in sorted(profile.favorite_foods, key=lambda food: food.updated_at, reverse=True)
            ],
            favorite_meals=[
                QuickAddMeal(
                    template_id=item.template_id,
                    title=item.title,
                    quick_text=item.quick_text,
                    meal_type=item.meal_type,
                    item_count=item.item_count,
                    source="favorite",
                    last_used_at=item.updated_at,
                )
                for item in sorted(profile.favorite_meals, key=lambda meal: meal.updated_at, reverse=True)
            ],
        )

    async def save_favorite_food(self, payload: FavoriteFoodRequest) -> QuickAddFood:
        profile = await self.quick_add_store.get_profile(payload.user_id)
        normalized_text = payload.quick_text.strip()
        now = datetime.now(timezone.utc).isoformat()

        existing = next(
            (
                item
                for item in profile.favorite_foods
                if item.quick_text.casefold() == normalized_text.casefold()
                and (item.canonical_food_id or "") == (payload.canonical_food_id or "")
            ),
            None,
        )

        if payload.active:
            if existing is None:
                existing = StoredFavoriteFood(
                    quick_add_id=str(uuid4()),
                    canonical_food_id=payload.canonical_food_id,
                    display_name_tr=payload.display_name_tr,
                    quick_text=normalized_text,
                    meal_type_hint=payload.meal_type_hint,
                    created_at=now,
                    updated_at=now,
                )
                profile.favorite_foods.append(existing)
            else:
                existing.display_name_tr = payload.display_name_tr
                existing.meal_type_hint = payload.meal_type_hint
                existing.updated_at = now
        else:
            profile.favorite_foods = [
                item for item in profile.favorite_foods if item.quick_add_id != (existing.quick_add_id if existing else "")
            ]

        await self.quick_add_store.save_profile(profile)

        if not payload.active:
            return QuickAddFood(
                quick_add_id=existing.quick_add_id if existing else "",
                label=payload.display_name_tr,
                quick_text=normalized_text,
                canonical_food_id=payload.canonical_food_id,
                meal_type_hint=payload.meal_type_hint,
                source="favorite",
                last_used_at=now,
                usage_count=0,
            )

        return QuickAddFood(
            quick_add_id=existing.quick_add_id,
            label=existing.display_name_tr,
            quick_text=existing.quick_text,
            canonical_food_id=existing.canonical_food_id,
            meal_type_hint=existing.meal_type_hint,
            source="favorite",
            last_used_at=existing.updated_at,
            usage_count=0,
        )

    async def save_favorite_meal(self, payload: FavoriteMealRequest) -> QuickAddMeal:
        profile = await self.quick_add_store.get_profile(payload.user_id)
        normalized_text = payload.quick_text.strip()
        now = datetime.now(timezone.utc).isoformat()

        existing = next(
            (
                item
                for item in profile.favorite_meals
                if item.quick_text.casefold() == normalized_text.casefold()
                and (item.meal_type or "") == (payload.meal_type or "")
            ),
            None,
        )

        if payload.active:
            if existing is None:
                existing = StoredFavoriteMeal(
                    template_id=str(uuid4()),
                    title=payload.title.strip(),
                    quick_text=normalized_text,
                    meal_type=payload.meal_type,
                    item_count=payload.item_count,
                    created_at=now,
                    updated_at=now,
                )
                profile.favorite_meals.append(existing)
            else:
                existing.title = payload.title.strip()
                existing.item_count = payload.item_count
                existing.updated_at = now
        else:
            profile.favorite_meals = [
                item for item in profile.favorite_meals if item.template_id != (existing.template_id if existing else "")
            ]

        await self.quick_add_store.save_profile(profile)

        if not payload.active:
            return QuickAddMeal(
                template_id=existing.template_id if existing else "",
                title=payload.title.strip(),
                quick_text=normalized_text,
                meal_type=payload.meal_type,
                item_count=payload.item_count,
                source="favorite",
                last_used_at=now,
            )

        return QuickAddMeal(
            template_id=existing.template_id,
            title=existing.title,
            quick_text=existing.quick_text,
            meal_type=existing.meal_type,
            item_count=existing.item_count,
            source="favorite",
            last_used_at=existing.updated_at,
        )

    def _build_recent_foods(self, meals: list) -> list[QuickAddFood]:
        usage_counter: Counter[str] = Counter()
        for meal in meals:
            for item in meal.items:
                usage_counter[self._recent_key(item.raw_text, item.canonical_food_id)] += 1

        recent_items: list[QuickAddFood] = []
        seen_keys: set[str] = set()
        for meal in meals:
            for item in meal.items:
                quick_text = item.raw_text.strip()
                if not quick_text:
                    continue
                key = self._recent_key(quick_text, item.canonical_food_id)
                if key in seen_keys:
                    continue
                seen_keys.add(key)
                recent_items.append(
                    QuickAddFood(
                        quick_add_id=key,
                        label=quick_text,
                        quick_text=quick_text,
                        canonical_food_id=item.canonical_food_id or None,
                        meal_type_hint=meal.meal_type,
                        source="recent",
                        last_used_at=meal.consumed_at,
                        usage_count=usage_counter[key],
                    )
                )
                if len(recent_items) >= 10:
                    return recent_items
        return recent_items

    @staticmethod
    def _recent_key(raw_text: str, canonical_food_id: str | None) -> str:
        return f"{(canonical_food_id or '').strip().casefold()}::{raw_text.strip().casefold()}"
