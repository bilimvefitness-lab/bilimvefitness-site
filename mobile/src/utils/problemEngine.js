/**
 * Problem Engine
 * Looks at the current state and returns ONE problem + ONE action.
 * Called every render on HomeScreen. Never shows two problems at once.
 */

export function resolveProblem({
  hasProfile,
  goals,
  dailyCoach,
  dailySummary,
  hydrationData,
  todaySteps,
  stepPermission,
  sleepData,
}) {
  const hour = new Date().getHours();

  // 1 — Profile missing → block everything
  if (!hasProfile) {
    return {
      text: "Hoş geldin! İlk adım: Profilini oluştur.",
      context: "Sana özel kalori, makro ve su hedeflerini tam isabetle belirleyebilmemiz için birkaç detaya ihtiyacımız var.",
      action: { label: "Profili Doldur", screen: "Profile" },
      priority: 0,
    };
  }

  // 2 — Protein gap (before 21:00)
  const proteinCurrent =
    dailyCoach?.actual_protein_g ?? dailySummary?.total_protein_g ?? null;
  const proteinTarget = goals?.protein_target_g ?? null;
  if (proteinCurrent !== null && proteinTarget !== null) {
    const gap = Number(proteinTarget) - Number(proteinCurrent);
    if (gap > 20 && hour < 21) {
      return {
        text: "Protein açığın var.",
        context: `${Math.round(gap)}g daha gerekiyor.`,
        action: { label: "Öğün Ekle", screen: "Daily" },
        priority: 1,
      };
    }
  }

  // 2.5 — Zero Data Onboarding (they have a profile but haven't tracked a single thing today)
  const hasNoData = 
    (!proteinCurrent || proteinCurrent === 0) && 
    (!calorieCurrent || calorieCurrent === 0) && 
    (!hydrationData?.consumed_ml || hydrationData.consumed_ml === 0);

  if (hasProfile && hasNoData && hour < 20) {
    return {
      text: "Bugün hedeflerine doğru ilk adımı at.",
      context: "Kahvaltını yedin mi? Güne bir bardak su ile mi başladın? Hemen kaydet.",
      action: { label: "Günlüğe Dön", screen: "Daily" },
      quickAction: "water",
      priority: 1.5,
    };
  }

  // 3 — Calorie running too low (late in the day)
  const calorieCurrent = dailyCoach?.actual_kcal ?? dailySummary?.total_kcal ?? null;
  const calorieTarget =
    goals?.calorie_target_kcal ?? dailyCoach?.calorie_target_kcal ?? null;
  if (calorieCurrent !== null && calorieTarget !== null && hour >= 20) {
    const remaining = Number(calorieTarget) - Number(calorieCurrent);
    if (remaining > 400) {
      return {
        text: "Gün bitiyor, kalori açığın kapanmıyor.",
        context: `${Math.round(remaining)} kcal kaldı.`,
        action: { label: "Öğün Ekle", screen: "Daily" },
        priority: 2,
      };
    }
  }

  // 4 — Water running behind (after 18:00)
  const remainingMl = hydrationData?.remaining_ml ?? null;
  if (remainingMl !== null && Number(remainingMl) > 1000 && hour >= 18) {
    const liters = (Number(remainingMl) / 1000).toFixed(1);
    return {
      text: "Bugün yeterli su içmedin.",
      context: `${liters}L kaldı.`,
      action: { label: "Su Ekle", screen: "Daily" },
      quickAction: "water",
      priority: 3,
    };
  }

  // 5 — Steps behind (after 17:00, applies to both native and fallback manual users)
  const stepCount = Number(todaySteps?.stepCount ?? 0);
  const stepGoal = 10000;
  const stepsRemaining = stepGoal - stepCount;
  const isStepPending = stepPermission?.status === "pending";

  if (!isStepPending && stepsRemaining > 2000 && hour >= 17) {
    return {
      text: "Hedefinin gerisine düştün.",
      context: `${stepsRemaining.toLocaleString("tr-TR")} adım kaldı.`,
      action: { label: "Adımlarını Gör", screen: "Daily" },
      quickAction: "steps",
      priority: 4,
    };
  }

  // 6 — All clear (meaning no urgency, profile exists, and they have SOME data logged)
  return {
    text: "Her şey yolunda görünüyor 🎯",
    context: "Şu ana kadar planı çok iyi takip ediyorsun. Motiveni koru!",
    action: { label: "Günlüğü İncele", screen: "Daily" },
    priority: 5,
  };
}
