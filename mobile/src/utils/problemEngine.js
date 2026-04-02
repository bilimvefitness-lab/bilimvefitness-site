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
      text: "Sistemi başlatmak için profilini doldur.",
      context: "Hedefler ve koç kişiselleşir.",
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
      priority: 3,
    };
  }

  // 5 — Steps behind (after 17:00, permission granted)
  const stepCount = Number(todaySteps?.stepCount ?? 0);
  const stepGoal = 10000;
  const stepsRemaining = stepGoal - stepCount;
  if (
    stepPermission?.status === "granted" &&
    todaySteps?.available &&
    stepsRemaining > 2000 &&
    hour >= 17
  ) {
    return {
      text: "Hedefinin gerisine düştün.",
      context: `${stepsRemaining.toLocaleString("tr-TR")} adım kaldı.`,
      action: { label: "Adımlarını Gör", screen: "Daily" },
      priority: 4,
    };
  }

  // 6 — All clear
  return {
    text: "Bugün iyi gidiyor.",
    context: "Planı bozmadan devam et.",
    action: null,
    priority: 5,
  };
}
