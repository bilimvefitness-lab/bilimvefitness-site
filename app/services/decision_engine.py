from app.schemas.nutrition import DailyCoachResponse, DailyDecisionOutput
from app.schemas.sleep import SleepCoachContext
from app.schemas.steps import StepActivityContext
from app.schemas.user_profile import GoalType, ProgressResponse


class DecisionEngine:
    def build_decision(
        self,
        *,
        coach: DailyCoachResponse,
        progress: ProgressResponse,
        goal: GoalType,
        sleep_context: SleepCoachContext | None = None,
        step_activity: StepActivityContext | None = None,
    ) -> DailyDecisionOutput:
        protein_needed_g = max(round(coach.protein_target_g - coach.actual_protein_g, 1), 0.0)
        calorie_difference = coach.calorie_difference_kcal
        behavior_codes = {signal.code for signal in coach.behavior_signals}
        risk_codes = {risk.code for risk in progress.risks}
        behavior_score = coach.behavior_score
        streaks = coach.streaks
        confidence_overview = coach.confidence_overview

        today_actions: list[str] = []
        next_meal_action = self._next_meal_action(
            protein_needed_g=protein_needed_g,
            calorie_difference=calorie_difference,
            goal=goal,
            behavior_codes=behavior_codes,
            risk_codes=risk_codes,
            confidence_overview=confidence_overview,
        )
        risk_control = self._risk_control(
            calorie_difference=calorie_difference,
            goal=goal,
            behavior_codes=behavior_codes,
            risk_codes=risk_codes,
            confidence_overview=confidence_overview,
        )
        priority = self._priority(
            protein_needed_g=protein_needed_g,
            calorie_difference=calorie_difference,
            goal=goal,
            behavior_codes=behavior_codes,
            risk_codes=risk_codes,
            behavior_score=behavior_score,
            streaks=streaks,
            confidence_overview=confidence_overview,
        )

        if behavior_score and behavior_score.total < 45 and behavior_score.priority_component == "logging":
            today_actions.append("Sonraki ogunu simdi kaydet. Bugunu logsuz birakma.")
        elif protein_needed_g >= 20 and calorie_difference >= 150:
            today_actions.append(
                f"Simdi {self._protein_bucket(protein_needed_g):.0f} g protein ekle. Kaloriyi tasirma."
            )
        elif protein_needed_g >= 20:
            today_actions.append(f"Simdi {self._protein_bucket(protein_needed_g):.0f} g protein ekle.")
        elif calorie_difference >= 200:
            today_actions.append("Bugun karbonhidrati kes. Proteine ve sebzeye kal.")
        elif calorie_difference <= -300 and goal != "fat_loss":
            today_actions.append("Bugun acigi kapat. Sonraki ogune dengeli kalori ekle.")
        else:
            today_actions.append("Plani bozma. Bugunu temiz kapat.")

        if confidence_overview and confidence_overview.score < 70:
            today_actions.append("Sonraki girisi gramla yap. Goz karari birak.")
        elif behavior_score and behavior_score.priority_component == "logging" and (streaks is None or streaks.logging.count == 0):
            today_actions.append("Log serisini simdi yeniden baslat. Sonraki ogunu bekletme.")
        elif "fat_loss_plateau" in risk_codes or "goal_direction_mismatch" in risk_codes:
            today_actions.append("Bugun sosu, tatliyi ve ekmegi kes.")
        elif "aggressive_weight_loss" in risk_codes or "underfueling_pattern" in behavior_codes:
            today_actions.append("Bugun acigi buyutme. Toparlanacak kadar ye.")
        elif "protein_consistency_low" in behavior_codes:
            today_actions.append("Her ana ogune protein koy: yumurta, yogurt, tavuk veya kofte.")

        if sleep_context and sleep_context.available:
            if sleep_context.recovery_signal == "low":
                today_actions.insert(0, "Son uyku kisa gorunuyor. Bugun plani sade tut ve plansiz atistirma acma.")
                if calorie_difference >= 0:
                    risk_control = "Yorgunlukla acligi karistirma. Bugun plansiz atistirma acma."
                if protein_needed_g < 20 and abs(calorie_difference) < 200:
                    priority = "Bugun toparlanmayi koru. Duzenli ve sade kal."
            elif sleep_context.recovery_signal == "moderate":
                today_actions.append("Uyku hedef bandinin altinda. Bugun ogun ritmini ve suyu aksatma.")
            if sleep_context.sleep_consistency_flag == "delayed":
                risk_control = "Geceyi daha da geciktirme. Aksam rutinini biraz erkene cek."

        if step_activity and step_activity.available:
            if step_activity.activity_level in {"very_low", "low"}:
                today_actions.insert(0, "Bugun hareket dusuk. Simdi 10-15 dakikalik yuruyus ekle.")
            if step_activity.activity_level in {"good", "very_high"}:
                today_actions.append("Bugun hareket yuksek. Suyu ve enerjiyi geciktirme.")
            if step_activity.trend_direction == "down":
                today_actions.append("Son 3 gunde adim dusuyor. Oturma bloklarini bol.")

            if step_activity.activity_level == "very_high":
                risk_control = "Bugun suyu geciktirme ve uzun saatler ac kalma."
            elif step_activity.activity_level == "very_low" and calorie_difference >= 0:
                risk_control = "Tum gun oturarak kalma. En az iki kisa yuruyus ekle."

            if step_activity.activity_level in {"very_low", "low"} and protein_needed_g < 20 and abs(calorie_difference) < 200:
                priority = "Simdi kisa bir yuruyus ekle."
            elif step_activity.activity_level in {"good", "very_high"} and protein_needed_g < 20:
                priority = "Bugun hareket yuksek. Su ve toparlanmayi tamamla."

        return DailyDecisionOutput(
            today_decision=today_actions[:2],
            next_meal_action=next_meal_action,
            risk_control=risk_control,
            priority=priority,
        )

    def _next_meal_action(
        self,
        *,
        protein_needed_g: float,
        calorie_difference: float,
        goal: GoalType,
        behavior_codes: set[str],
        risk_codes: set[str],
        confidence_overview,
    ) -> str:
        confidence_note = ""
        if confidence_overview and confidence_overview.score < 70:
            confidence_note = " ve porsiyonu gramla gir"
        if calorie_difference >= 250:
            if protein_needed_g >= 20:
                return f"Sonraki ogunde 150 g tavuk veya 1 olcek whey + salata al{confidence_note}."
            return f"Sonraki ogunde 150 g tavuk veya ton baligi + salata al. Pilav ekleme{confidence_note}."
        if "aggressive_weight_loss" in risk_codes or calorie_difference <= -350:
            if protein_needed_g >= 15:
                return f"Sonraki ogunde 200 g yogurt + 1 muz + 1 olcek whey al{confidence_note}."
            return f"Sonraki ogunde 1 tost + 1 ayran veya 200 g yogurt + 1 muz al{confidence_note}."
        if "meal_skipping_pattern" in behavior_codes:
            return f"Sonraki ogune 200 g yogurt veya 100 g lor ekle. Ogun atlamayi kir{confidence_note}."
        if protein_needed_g >= 35:
            return f"Sonraki ogunde 150 g tavuk veya 1 olcek whey + 200 g yogurt al{confidence_note}."
        if protein_needed_g >= 20:
            return f"Sonraki ogunde 150 g tavuk veya 200 g yogurt + 1 olcek whey al{confidence_note}."
        if protein_needed_g >= 10:
            return f"Sonraki ogunde 200 g yogurt veya 100 g lor ekle{confidence_note}."
        if goal == "fat_loss":
            return f"Sonraki ogunde 150 g tavuk, kofte veya ton baligi sec. Proteini koru{confidence_note}."
        return f"Sonraki ogunde tavuk, yogurt veya yumurta ekle{confidence_note}."

    def _risk_control(
        self,
        *,
        calorie_difference: float,
        goal: GoalType,
        behavior_codes: set[str],
        risk_codes: set[str],
        confidence_overview,
    ) -> str:
        if "fat_loss_plateau" in risk_codes or "goal_direction_mismatch" in risk_codes:
            return "Bugun tatli, ekmek, pilav ve kuruyemisi kes."
        if "aggressive_weight_loss" in risk_codes or "underfueling_pattern" in behavior_codes:
            return "Bugun ogun atlama. Sadece kahveyle gecistirme yapma."
        if calorie_difference >= 200:
            return "Bugun ekstra karbonhidrat, sos ve gece atistirmasini kes."
        if calorie_difference <= -300 and goal != "fat_loss":
            return "Bugun acigi buyutme. Ogun atlama yapma."
        if confidence_overview and confidence_overview.score < 70:
            return "Bugun goz karari pilav, makarna ve kuruyemis girme."
        return "Bugun plan disi atistirma acma."

    def _priority(
        self,
        *,
        protein_needed_g: float,
        calorie_difference: float,
        goal: GoalType,
        behavior_codes: set[str],
        risk_codes: set[str],
        behavior_score,
        streaks,
        confidence_overview,
    ) -> str:
        if behavior_score and behavior_score.total < 45 and behavior_score.priority_component == "logging":
            return "Simdi kayda don. Sonraki ogunu eksiksiz logla."
        if streaks and streaks.logging.count == 0 and behavior_score and behavior_score.priority_component == "logging":
            return "Seriyi bugun yeniden baslat. Sonraki ogunu aninda kaydet."
        if "goal_direction_mismatch" in risk_codes:
            return "Hedefe don. Bugun ekstra kaloriyi kes."
        if "fat_loss_plateau" in risk_codes:
            return "Plateauyu kir. Bugun gereksiz kaloriyi sifirla."
        if "aggressive_weight_loss" in risk_codes:
            return "Toparlanmayi koru. Bugun acigi buyutme."
        if protein_needed_g >= 25 and calorie_difference >= 150:
            return "Simdi protein ekle. Kaloriyi tasirma."
        if protein_needed_g >= 20:
            return "Simdi protein acigini kapat."
        if calorie_difference >= 200:
            return "Simdi fazla kaloriyi durdur."
        if confidence_overview and confidence_overview.score < 70:
            return "Simdi porsiyonu net gir. Kaydi temiz tut."
        if behavior_score and behavior_score.priority_component == "logging" and (streaks is None or streaks.logging.count == 0):
            return "Simdi sonraki ogunu eksiksiz logla."
        if "protein_consistency_low" in behavior_codes:
            return "Her ana ogune protein koy. Bunu bugun sabitle."
        if goal == "fat_loss" and calorie_difference <= -300:
            return "Acigi kontrol et. Gereksiz yere daha da dusme."
        return "Plani bozma. Bugunu temiz kapat."

    def _protein_bucket(self, protein_needed_g: float) -> float:
        if protein_needed_g >= 35:
            return 40.0
        if protein_needed_g >= 20:
            return 30.0
        if protein_needed_g >= 10:
            return 20.0
        return 15.0
