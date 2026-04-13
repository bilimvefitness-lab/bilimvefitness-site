from datetime import datetime, timezone

from app.db.action_tracking_store import ActionTrackingStore, StoredDailyActionRecord
from app.schemas.nutrition import (
    DailyActionResponse,
    DailyActionTrackRequest,
    DailyActionTrackResponse,
    ExecutableAction,
    ExecutableActionPayload,
    PrimeVoiceResponse,
)
from app.services.meal_logging import MealLoggingService
from app.services.prime_voice_service import PrimeVoiceService


class DailyActionService:
    def __init__(
        self,
        meal_logging_service: MealLoggingService,
        action_tracking_store: ActionTrackingStore,
        prime_voice_service: PrimeVoiceService,
    ) -> None:
        self.meal_logging_service = meal_logging_service
        self.action_tracking_store = action_tracking_store
        self.prime_voice_service = prime_voice_service

    async def build_daily_action(
        self,
        date: str,
        protein_target_g: float,
        calorie_target_kcal: float,
        user_id: str | None = None,
    ) -> DailyActionResponse:
        summary = await self.meal_logging_service.get_daily_summary(date=date, user_id=user_id)
        actual_protein = float(summary.total_protein_g)
        actual_kcal = float(summary.total_kcal)
        protein_gap_g = round(max(protein_target_g - actual_protein, 0.0), 2)
        calorie_difference_kcal = round(actual_kcal - calorie_target_kcal, 2)

        action_type = self.determine_action_type(
            protein_gap_g=protein_gap_g,
            calorie_difference_kcal=calorie_difference_kcal,
        )
        ignored_count = await self._count_ignored_actions(
            user_id=user_id,
            date=date,
            action_type=action_type,
        )
        pressure_level = self._determine_pressure_level(ignored_count)
        risk_level = self._determine_risk_level(
            action_type=action_type,
            protein_gap_g=protein_gap_g,
            calorie_difference_kcal=calorie_difference_kcal,
            pressure_level=pressure_level,
        )
        actions = self.build_actions(
            action_type=action_type,
            protein_gap_g=protein_gap_g,
            calorie_difference_kcal=calorie_difference_kcal,
        )
        voice_context = self._build_voice_context(meal_count=summary.meal_count)
        primary_action = self.build_primary_action(
            action_type=action_type,
            protein_gap_g=protein_gap_g,
            calorie_difference_kcal=calorie_difference_kcal,
            pressure_level=pressure_level,
        )
        action_states = await self._ensure_action_state(
            user_id=user_id,
            date=date,
            action_type=action_type,
            actions=actions,
        )

        priority = self.determine_priority(
            action_type=action_type,
            protein_gap_g=protein_gap_g,
            calorie_difference_kcal=calorie_difference_kcal,
            pressure_level=pressure_level,
        )
        voice = self.build_voice_response(
            summary_meal_count=summary.meal_count,
            pressure_level=pressure_level,
            ignored_count=ignored_count,
            priority=priority,
            risk_level=risk_level,
            action_type=action_type,
            protein_gap_g=protein_gap_g,
            calorie_difference_kcal=calorie_difference_kcal,
        )
        if voice and voice.enabled:
            voice.audio_url = await self.prime_voice_service.get_or_create_audio_url(
                message=self._voice_message(primary_action=primary_action),
                mode=voice.mode,
                pressure_level=pressure_level,
                variation_seed=f"{date}:{voice.reason}:{primary_action}",
                action_type=action_type,
                target_area=voice_context["target_area"],
                timing_context=voice_context["timing_context"],
                day_progression=voice_context["day_progression"],
                training_status=voice_context["training_status"],
            )

        return DailyActionResponse(
            date=date,
            primary_action=primary_action,
            quick_fix=self.build_quick_fix(
                action_type=action_type,
                protein_gap_g=protein_gap_g,
                calorie_difference_kcal=calorie_difference_kcal,
            ),
            secondary_note=self.build_secondary_note(
                action_type=action_type,
                calorie_difference_kcal=calorie_difference_kcal,
                pressure_level=pressure_level,
            ),
            priority=priority,
            risk_level=risk_level,
            action_type=action_type,
            protein_gap_g=protein_gap_g,
            calorie_difference_kcal=calorie_difference_kcal,
            pressure_level=pressure_level,
            ignored_action_count=ignored_count,
            actions=actions,
            pending_actions=action_states["pending_actions"],
            completed_actions=action_states["completed_actions"],
            voice=voice,
        )

    async def track_action(self, payload: DailyActionTrackRequest) -> DailyActionTrackResponse:
        records = list(await self.action_tracking_store.get_actions_for_date(payload.date, payload.user_id))
        target = next((record for record in records if record.action_id == payload.action_id), None)
        if target is None:
            raise ValueError("Aksiyon bulunamadi.")

        now = datetime.now(timezone.utc).isoformat()
        if payload.event_type == "action_clicked":
            target.clicked_count += 1
            target.last_clicked_at = now
        if payload.event_type == "action_completed":
            target.completed_count += 1
            target.last_completed_at = now

        await self.action_tracking_store.upsert_action(target)

        refreshed_records = list(
            await self.action_tracking_store.get_actions_for_date(payload.date, payload.user_id)
        )
        completed_actions = [
            record.action_id for record in refreshed_records if record.completed_count > 0
        ]
        pending_actions = [
            record.action_id for record in refreshed_records if record.completed_count <= 0
        ]
        ignored_count = await self._count_ignored_actions(
            user_id=payload.user_id,
            date=payload.date,
            action_type=target.action_type,
        )
        return DailyActionTrackResponse(
            action_id=payload.action_id,
            event_type=payload.event_type,
            status="completed" if target.completed_count > 0 else "pending",
            pending_actions=pending_actions,
            completed_actions=completed_actions,
            pressure_level=self._determine_pressure_level(ignored_count),
        )

    def determine_action_type(
        self,
        protein_gap_g: float,
        calorie_difference_kcal: float,
    ) -> str:
        protein_low = protein_gap_g >= 20
        protein_moderately_low = protein_gap_g >= 10
        calorie_surplus = calorie_difference_kcal >= 150
        calorie_deficit = calorie_difference_kcal <= -150
        near_target = abs(calorie_difference_kcal) < 150 and protein_gap_g < 10

        if protein_low and calorie_surplus:
            return "rebalance"
        if protein_low and not calorie_surplus:
            return "protein_up"
        if calorie_surplus and protein_gap_g < 10:
            return "calories_down"
        if calorie_deficit and protein_gap_g < 20:
            return "calories_up"
        if near_target:
            return "maintain"
        if protein_moderately_low and calorie_surplus:
            return "rebalance"
        if protein_moderately_low:
            return "protein_up"
        if calorie_surplus:
            return "calories_down"
        if calorie_deficit:
            return "calories_up"
        return "maintain"

    def determine_priority(
        self,
        action_type: str,
        protein_gap_g: float,
        calorie_difference_kcal: float,
        pressure_level: int = 1,
    ) -> str:
        magnitude = max(protein_gap_g, abs(calorie_difference_kcal))
        if pressure_level >= 3:
            return "high"
        if action_type in {"protein_up", "rebalance"} and protein_gap_g >= 20:
            return "high"
        if action_type in {"calories_down", "calories_up"} and abs(calorie_difference_kcal) >= 250:
            return "high"
        if action_type == "maintain":
            return "low"
        if magnitude >= 10:
            return "medium"
        return "low"

    def _determine_risk_level(
        self,
        *,
        action_type: str,
        protein_gap_g: float,
        calorie_difference_kcal: float,
        pressure_level: int,
    ) -> str:
        if pressure_level >= 2 and action_type in {"protein_up", "rebalance", "calories_down"}:
            return "high"
        if protein_gap_g > 35:
            return "high"
        if abs(calorie_difference_kcal) >= 350:
            return "high"
        if action_type in {"protein_up", "rebalance"} and protein_gap_g >= 20:
            return "high"
        if action_type in {"calories_down", "calories_up"} and abs(calorie_difference_kcal) >= 200:
            return "medium"
        return "low"

    def build_primary_action(
        self,
        action_type: str,
        protein_gap_g: float,
        calorie_difference_kcal: float,
        pressure_level: int = 1,
    ) -> str:
        rounded_protein_gap = self._recommended_protein_action_gap(protein_gap_g)

        if action_type == "protein_up":
            if pressure_level >= 3:
                return f"Disiplin dusuyor. Simdi {rounded_protein_gap:.0f} g protein ekle"
            if pressure_level == 2:
                return f"Protein yine sarkiyor. Bu ogune {rounded_protein_gap:.0f} g ekle"
            return f"Bir sonraki ogune {rounded_protein_gap:.0f} g protein ekle"
        if action_type == "calories_down":
            if pressure_level >= 3:
                return "Disiplin dusuyor. Aksam karbonhidrati simdi kis"
            if calorie_difference_kcal >= 300:
                return "Aksam karbonhidrat ve yagli ekleri azalt"
            return "Bugunu kapat, ekstra atistirma ekleme"
        if action_type == "calories_up":
            if pressure_level >= 3:
                return "Disiplin dusuyor. Dengeli bir ogun simdi ekle"
            if protein_gap_g >= 10:
                return "Bir ara ogune proteinli dengeli bir ek yap"
            return "Bugune dengeli bir ara ogun ekle"
        if action_type == "rebalance":
            if pressure_level >= 3:
                return f"Disiplin yok. Simdi {rounded_protein_gap:.0f} g yagisiz protein ekle"
            if pressure_level == 2:
                return f"Hala eksik. Bu aksam {rounded_protein_gap:.0f} g yagisiz protein ekle"
            return f"Aksam ogunune {rounded_protein_gap:.0f} g yagisiz protein ekle"
        return "Bugunku duzeni koru, ekstra atistirma acma"

    def build_quick_fix(
        self,
        action_type: str,
        protein_gap_g: float,
        calorie_difference_kcal: float,
    ) -> str | None:
        if action_type == "protein_up":
            if protein_gap_g >= 35:
                return "150 g tavuk + 1 olcek whey"
            if protein_gap_g >= 20:
                return "1 olcek whey + 200 g yogurt"
            return "200 g yogurt veya 100 g lor"
        if action_type == "calories_down":
            if calorie_difference_kcal >= 300:
                return "Pilav, ekmek ve kuruyemis eklerini kis"
            return "Tatli veya ikinci atistirmayi atla"
        if action_type == "calories_up":
            if protein_gap_g >= 10:
                return "200 g yogurt + 1 muz"
            return "1 tost + 1 ayran"
        if action_type == "rebalance":
            return "150 g tavuk veya 1 olcek whey + 200 g yogurt"
        if abs(calorie_difference_kcal) < 100 and protein_gap_g < 5:
            return "Plan disi atistirma ekleme"
        return None

    def build_secondary_note(
        self,
        action_type: str,
        calorie_difference_kcal: float,
        pressure_level: int = 1,
    ) -> str | None:
        if action_type == "rebalance":
            return "Kalori fazlasi buyumeden yagli ekleri kis"
        if action_type == "protein_up" and calorie_difference_kcal >= 100:
            return "Proteini yagli sos veya ekstra ekmekle tamamlama"
        if action_type == "calories_up" and calorie_difference_kcal <= -300:
            return "Uzayan acik toparlanmayi zorlastirabilir"
        if action_type == "maintain":
            return "Bugunu burada tutmak yeterli"
        if pressure_level >= 3 and action_type == "calories_down":
            return "Ayni tasma tekrar ediyor. Aksam eklerini sade tut"
        return None

    def build_actions(
        self,
        *,
        action_type: str,
        protein_gap_g: float,
        calorie_difference_kcal: float,
    ) -> list[ExecutableAction]:
        protein_target = self._recommended_protein_action_gap(protein_gap_g)
        protein_quick_text = self._protein_quick_text(protein_gap_g)
        actions: list[ExecutableAction] = []

        if action_type in {"protein_up", "rebalance"}:
            actions.append(
                ExecutableAction(
                    action_id=f"{action_type}-add-protein",
                    label=f"{protein_target:.0f} g protein ekle",
                    type="add_food",
                    payload=ExecutableActionPayload(
                        suggested_foods=["tavuk", "yogurt", "whey"],
                        protein_target=protein_target,
                        quick_text=protein_quick_text,
                        meal_type_hint="akşam yemeği",
                        focus_field="nutrition_input",
                    ),
                    ui_trigger="quick_add",
                )
            )

        if action_type in {"calories_down", "rebalance"}:
            actions.append(
                ExecutableAction(
                    action_id=f"{action_type}-reduce-carbs",
                    label="Karbonhidrati kis",
                    type="reduce_carbs",
                    payload=ExecutableActionPayload(
                        quick_text="200 g yogurt",
                        avoid_foods=["pilav", "ekmek", "tatli"],
                        focus_field="nutrition_input",
                        meal_type_hint="akşam yemeği",
                    ),
                    ui_trigger="quick_add",
                )
            )

        if action_type in {"calories_up", "maintain"}:
            quick_text = "200 g yogurt + 1 muz" if action_type == "calories_up" else "1 yogurt"
            actions.append(
                ExecutableAction(
                    action_id=f"{action_type}-log-meal",
                    label="Ogunu logla",
                    type="log_meal",
                    payload=ExecutableActionPayload(
                        quick_text=quick_text,
                        meal_type_hint="ara öğün" if action_type == "calories_up" else "akşam yemeği",
                        focus_field="nutrition_input",
                    ),
                    ui_trigger="focus_meal_input",
                )
            )

        actions.append(
            ExecutableAction(
                action_id=f"{action_type}-water",
                label="500 ml su ekle",
                type="add_water",
                payload=ExecutableActionPayload(water_amount_ml=500),
                ui_trigger="log_water",
            )
        )

        if action_type not in {"calories_up", "maintain"}:
            actions.append(
                ExecutableAction(
                    action_id=f"{action_type}-log-meal",
                    label="Ogunu hizli logla",
                    type="log_meal",
                    payload=ExecutableActionPayload(
                        quick_text=protein_quick_text if action_type == "protein_up" else "150 g tavuk gogsu",
                        meal_type_hint="akşam yemeği",
                        focus_field="nutrition_input",
                    ),
                    ui_trigger="focus_meal_input",
                )
            )

        return actions[:3]

    async def _ensure_action_state(
        self,
        *,
        user_id: str | None,
        date: str,
        action_type: str,
        actions: list[ExecutableAction],
    ) -> dict[str, list[str]]:
        if not user_id:
            return {
                "pending_actions": [action.action_id for action in actions],
                "completed_actions": [],
            }

        existing_records = {
            record.action_id: record
            for record in await self.action_tracking_store.get_actions_for_date(date, user_id)
        }
        now = datetime.now(timezone.utc).isoformat()
        pending_actions: list[str] = []
        completed_actions: list[str] = []

        for action in actions:
            record = existing_records.get(action.action_id)
            if record is None:
                record = StoredDailyActionRecord(
                    user_id=user_id,
                    date=date,
                    action_id=action.action_id,
                    action_type=action_type,
                    label=action.label,
                    shown_at=now,
                )
                await self.action_tracking_store.upsert_action(record)
            if record.completed_count > 0:
                action.status = "completed"
                completed_actions.append(action.action_id)
            else:
                action.status = "pending"
                pending_actions.append(action.action_id)
        return {
            "pending_actions": pending_actions,
            "completed_actions": completed_actions,
        }

    async def _count_ignored_actions(
        self,
        *,
        user_id: str | None,
        date: str,
        action_type: str,
    ) -> int:
        if not user_id:
            return 0
        recent_actions = await self.action_tracking_store.get_recent_actions(
            user_id=user_id,
            before_date=date,
            action_type=action_type,
            limit=7,
        )
        return sum(1 for action in recent_actions if action.completed_count <= 0)

    def _determine_pressure_level(self, ignored_count: int) -> int:
        if ignored_count >= 2:
            return 3
        if ignored_count >= 1:
            return 2
        return 1

    def _round_to_nearest_five(self, value: float) -> float:
        return round(value / 5) * 5

    def _recommended_protein_action_gap(self, protein_gap_g: float) -> float:
        rounded_gap = self._round_to_nearest_five(max(protein_gap_g, 20.0))
        return min(rounded_gap, 40.0)

    def _protein_quick_text(self, protein_gap_g: float) -> str:
        if protein_gap_g >= 35:
            return "150 g tavuk gogsu\n1 olcek whey"
        if protein_gap_g >= 20:
            return "1 olcek whey\n200 g yogurt"
        return "200 g yogurt"

    def build_voice_response(
        self,
        *,
        summary_meal_count: int,
        pressure_level: int,
        ignored_count: int,
        priority: str,
        risk_level: str,
        action_type: str,
        protein_gap_g: float,
        calorie_difference_kcal: float,
    ) -> PrimeVoiceResponse | None:
        protein_crisis = protein_gap_g > 35
        calorie_crisis = abs(calorie_difference_kcal) >= 350
        repeated_ignore = ignored_count >= 2
        late_skipped_meals = self._is_end_of_day() and summary_meal_count < 2
        crisis = risk_level == "high" and (
            pressure_level >= 2
            or repeated_ignore
            or protein_crisis
            or calorie_crisis
            or late_skipped_meals
        )

        if crisis:
            reason_parts: list[str] = ["high_risk"]
            if pressure_level >= 2:
                reason_parts.append("pressure")
            if repeated_ignore:
                reason_parts.append("repeated_ignore")
            if protein_crisis:
                reason_parts.append("protein_gap")
            if calorie_crisis:
                reason_parts.append("critical_calories")
            if late_skipped_meals:
                reason_parts.append("late_skipped_meals")
            return PrimeVoiceResponse(
                enabled=True,
                auto_play=True,
                mode="crisis",
                priority=priority,
                audio_url="",
                reason=" + ".join(reason_parts),
            )

        if self._is_end_of_day() and risk_level == "high" and action_type != "maintain":
            return PrimeVoiceResponse(
                enabled=True,
                auto_play=False,
                mode="end_of_day",
                priority=priority,
                audio_url="",
                reason="end_of_day_review",
            )

        if risk_level != "high":
            return None
        return None

    def _is_end_of_day(self) -> bool:
        return datetime.now().hour >= 20

    @staticmethod
    def _voice_message(*, primary_action: str) -> str:
        first_sentence = str(primary_action or "").strip().split(".")[0].strip()
        return f"{first_sentence}." if first_sentence else ""

    def _build_voice_context(self, *, meal_count: int) -> dict[str, str | None]:
        current_hour = datetime.now().hour
        if current_hour < 12:
            timing_context = "morning"
        elif current_hour < 17:
            timing_context = "afternoon"
        else:
            timing_context = "evening"

        day_progression = "late" if current_hour >= 17 else "early"
        if meal_count <= 0:
            meal_index = "first_meal"
        elif day_progression == "late":
            meal_index = "last_meal"
        else:
            meal_index = "next_meal"

        if meal_index == "first_meal":
            target_area = "İlk öğünde"
        elif timing_context == "evening":
            target_area = "Akşam öğününde"
        else:
            target_area = "Bu öğünde"

        return {
            "timing_context": timing_context,
            "day_progression": day_progression,
            "meal_index": meal_index,
            "target_area": target_area,
            "training_status": None,
        }
