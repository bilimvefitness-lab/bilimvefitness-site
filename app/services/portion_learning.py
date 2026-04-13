from dataclasses import dataclass
from datetime import datetime, timezone

from app.db.portion_profile_store import PortionProfileStore, StoredPortionProfile
from app.schemas.nutrition import NutritionCalculatedItem


@dataclass(slots=True)
class LearnedPortionOverride:
    average_weight_g: float
    min_weight_g: float
    max_weight_g: float
    sample_count: int


class PortionLearningService:
    def __init__(self, store: PortionProfileStore) -> None:
        self.store = store

    async def get_override(
        self,
        user_id: str | None,
        canonical_food_id: str,
        unit: str | None,
        modifiers: list[str],
    ) -> LearnedPortionOverride | None:
        if not user_id or not unit:
            return None

        profile = await self.store.get_profile(
            user_id=user_id,
            canonical_food_id=canonical_food_id,
            unit=unit,
            modifiers_key=self._modifiers_key(modifiers),
        )
        if profile is None:
            return None

        return LearnedPortionOverride(
            average_weight_g=profile.average_weight_g,
            min_weight_g=profile.min_observed_weight_g,
            max_weight_g=profile.max_observed_weight_g,
            sample_count=profile.sample_count,
        )

    async def learn_from_items(
        self,
        user_id: str | None,
        items: list[NutritionCalculatedItem],
    ) -> None:
        if not user_id:
            return

        for item in items:
            if (
                not item.canonical_food_id
                or not item.unit
                or item.estimated_weight_g is None
                or item.amount is None
                or item.amount <= 0
                or item.needs_clarification
            ):
                continue
            if item.unit in {"gram", "kilo"}:
                continue

            observed_weight = item.estimated_weight_g / item.amount
            modifiers_key = self._modifiers_key(item.modifiers)
            existing = await self.store.get_profile(
                user_id=user_id,
                canonical_food_id=item.canonical_food_id,
                unit=item.unit,
                modifiers_key=modifiers_key,
            )
            profile = self._updated_profile(
                existing=existing,
                user_id=user_id,
                canonical_food_id=item.canonical_food_id,
                unit=item.unit,
                modifiers_key=modifiers_key,
                observed_weight=observed_weight,
            )
            await self.store.save_profile(profile)

    def _updated_profile(
        self,
        existing: StoredPortionProfile | None,
        user_id: str,
        canonical_food_id: str,
        unit: str,
        modifiers_key: str,
        observed_weight: float,
    ) -> StoredPortionProfile:
        if existing is None:
            return StoredPortionProfile(
                user_id=user_id,
                canonical_food_id=canonical_food_id,
                unit=unit,
                modifiers_key=modifiers_key,
                average_weight_g=round(observed_weight, 2),
                sample_count=1,
                min_observed_weight_g=round(observed_weight, 2),
                max_observed_weight_g=round(observed_weight, 2),
                last_updated_at=datetime.now(timezone.utc).isoformat(),
            )

        new_count = existing.sample_count + 1
        new_average = ((existing.average_weight_g * existing.sample_count) + observed_weight) / new_count
        return StoredPortionProfile(
            user_id=user_id,
            canonical_food_id=canonical_food_id,
            unit=unit,
            modifiers_key=modifiers_key,
            average_weight_g=round(new_average, 2),
            sample_count=new_count,
            min_observed_weight_g=round(min(existing.min_observed_weight_g, observed_weight), 2),
            max_observed_weight_g=round(max(existing.max_observed_weight_g, observed_weight), 2),
            last_updated_at=datetime.now(timezone.utc).isoformat(),
        )

    def _modifiers_key(self, modifiers: list[str]) -> str:
        if not modifiers:
            return "-"
        return "|".join(sorted(modifiers))
