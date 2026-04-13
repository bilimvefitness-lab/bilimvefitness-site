/**
 * Daily Orchestrator — Product Intelligence System.
 * Analyzes health data from all modules and outputs exactly ONE prioritized action.
 * Optimized for reliability and null-safety.
 */

export function resolveDailyAction({
  hasProfile,
  goals,
  dailyCoach,
  dailySummary,
  hydrationData,
  todaySteps,
  sleepData,
  isLoading = false,
  stepGoal = 10000,
  currentHour = new Date().getHours(),
}) {
  const hour = currentHour;

  // ── PRIORITY 0: LOADING GUARD ──────────────────────────────────────────────
  // If modules are still fetching (Profile excluded as it blocks everything anyway),
  // return a neutral loading state. This avoids flickering instructions.
  if (isLoading) {
    return {
      action_type: "loading",
      message: "Analiz ediliyor...", // Direct and simple
      priority: "neutral",
      target_screen: "Home",
    };
  }

  // ── PRIORITY 1: PROFILE INCOMPLETE / NEW USER ─────────────────────────────────
  const hasMeals = (dailySummary?.meal_count ?? 0) > 0;
  const hasHydration = (hydrationData?.consumed_ml ?? 0) > 0;
  const isFirstSession = !hasProfile && !hasMeals && !hasHydration;

  if (!hasProfile) {
    if (isFirstSession) {
      return {
        action_type: "profile",
        message: "Hoş geldin. Bugün birlikte yeni bir başlangıç yapıyoruz. Profilini oluşturup başlayalım mı?",
        priority: "high",
        target_screen: "Profile",
      };
    }
    return {
      action_type: "profile",
      message: "Şimdi. Profilini doldur ve yol haritanı çiz.",
      priority: "high",
      target_screen: "Profile",
    };
  }

  // ── PRIORITY 1.5: FIRST SUCCESS PRAISE ─────────────────────────────────────
  // If user just added their first ever meal/water and hasn't seen praise yet
  const totalLogs = (dailySummary?.meal_count ?? 0) + (hasHydration ? 1 : 0);
  if (totalLogs === 1 && hour < 22) {
    return {
      action_type: "maintain",
      message: "Harika başlangıç! İlk adım tamamlandı. Şimdi günü disiplinle takip edelim.",
      priority: "high",
      target_screen: "Home",
    };
  }

  // ── Derived Data (Safe Defaults based on AppContext) ───────────────────────
  const proteinCurrent = dailyCoach?.actual_protein_g ?? dailySummary?.total_protein_g ?? 0;
  const proteinTarget = goals?.protein_target_g ?? dailyCoach?.protein_target_g ?? 0;
  const proteinGap = proteinTarget > 0 ? Math.max(proteinTarget - proteinCurrent, 0) : 0;

  const calorieCurrent = dailyCoach?.actual_kcal ?? dailySummary?.total_kcal ?? 0;
  const calorieTarget = goals?.calorie_target_kcal ?? dailyCoach?.calorie_target_kcal ?? 0;
  const calorieDiff = calorieTarget > 0 ? Math.abs(calorieTarget - calorieCurrent) : 0;

  const hydConsumed = hydrationData?.consumed_ml ?? 0;
  const hydTarget = hydrationData?.target_ml ?? 2500;
  const hydPct = hydTarget > 0 ? (hydConsumed / hydTarget) * 100 : 100;

  const stepCount = Number(todaySteps?.stepCount ?? 0);
  const effectiveStepGoal = Number(stepGoal || 10000);
  
  // Inactivity: < 20% of goal and after 10:00 AM
  const isSeverelyInactive = stepCount < (effectiveStepGoal * 0.2) && hour > 10;

  // ── PRIORITY 2: SEVERE PROTEIN GAP (>30g) ──────────────────────────────────
  if (proteinGap > 30 && hour < 22) {
    return {
      action_type: "protein_up",
      message: `İyi. Ama bu öğünde ${Math.min(40, Math.round(proteinGap))}g protein eklemelisin.`,
      priority: "high",
      target_screen: "Nutrition",
    };
  }

  // ── PRIORITY 3: CRITICAL HYDRATION (<40%) ──────────────────────────────────
  if (hydPct < 40 && hour > 7 && hour < 22) {
    return {
      action_type: "hydration",
      message: "İyi. Şimdi 500 ml su içerek devam et.",
      priority: "medium",
      target_screen: "Hydration",
    };
  }

  // ── PRIORITY 4: SEVERE CALORIE DRIFT (>500kcal) ────────────────────────────
  if (calorieDiff > 500 && hour > 8 && hour < 23) {
    const calorieMessage = calorieCurrent < calorieTarget 
      ? `Tamam. Bugün ${Math.round(calorieTarget - calorieCurrent)} kcal daha gerekiyor.`
      : "İyi. Ama kalori limitini aştın, günü hafif bitir.";
    return {
      action_type: "nutrition",
      message: calorieMessage,
      priority: "medium",
      target_screen: "Nutrition",
    };
  }

  // ── PRIORITY 5: INACTIVITY ─────────────────────────────────────────────────
  if (isSeverelyInactive && hour < 20) {
    return {
      action_type: "steps",
      message: "İyi. Şimdi 10 dakika yürü ve tazelen.",
      priority: "medium",
      target_screen: "Steps",
    };
  }

  // ── PRIORITY 6: SLEEP AWARENESS ────────────────────────────────────────────
  // sleepData comes from AppContext backend response — snake_case fields.
  if (!sleepData && hour >= 7 && hour < 11) {
    return {
      action_type: "sleep",
      message: "Günaydın. Dün akşamki uykuna bir bakalım mı?",
      priority: "low",
      target_screen: "Sleep",
    };
  }

  const sleepMinutes = sleepData?.total_sleep_minutes ?? null;

  // Low sleep: under 6 hours → recovery suggestion, reduce intensity.
  if (sleepMinutes !== null && sleepMinutes < 360 && hour >= 7 && hour < 20) {
    return {
      action_type: "sleep_recovery",
      message: "Dün az uyudun. Bugün antrenman yoğunluğunu düşür, vücuduna dinlenme fırsatı ver.",
      priority: "medium",
      target_screen: "Sleep",
    };
  }

  // Good sleep: 7+ hours in morning window → performance readiness signal.
  if (sleepMinutes !== null && sleepMinutes >= 420 && hour >= 7 && hour < 14) {
    return {
      action_type: "sleep_performance",
      message: "İyi uyku, güçlü gün. Bugün yüksek yoğunluklu antrenman için hazırsın.",
      priority: "low",
      target_screen: "Home",
    };
  }

  // ── PRIORITY 7: MAINTAIN STATE (Encouragement) ─────────────────────────────
  const isHealthy = proteinGap < 20 && hydPct > 80 && calorieDiff < 300;
  
  return {
    action_type: "maintain",
    message: isHealthy 
      ? "Harika. Bugün çizgi mükemmel ilerliyor." 
      : "İyi. Her şey yolunda, disiplini koru.",
    priority: "low",
    target_screen: "Nutrition",
  };
}
