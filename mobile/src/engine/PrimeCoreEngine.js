/**
 * PRIME CORE — Unified Daily Decision Engine
 *
 * Combines sleep, nutrition, and hydration signals into a single directive.
 *
 * Output contract:
 *   readiness       — "high" | "moderate" | "low" | "unknown"
 *   readinessScore  — 0–100 integer, or null when inputs are insufficient
 *   priority        — "critical" | "high" | "medium" | "low"
 *   commandCode     — i18n key suffix: home.coach.<commandCode>.command
 *   supportCode     — i18n key suffix: home.coach.<supportCode>.support (empty = no support text)
 *   commandMeta     — interpolation values for command string
 *   supportMeta     — interpolation values for support string
 *   dataConfidence  — "full" | "partial" | "minimal"
 *   targetScreen    — navigation target string
 *   actionType      — machine-readable tag for analytics / CTA key
 *
 * Rules enforced here:
 *   - One command only. No compound instructions.
 *   - No medical claims. No fake metrics.
 *   - Confidence-aware: partial/minimal data softens positive messaging.
 *   - No silent fallback: missing data surfaces explicitly in output fields.
 *   - sleepMinutes === 0 is treated as null (not "slept zero hours").
 *   - No target → no gap-based priority branch (avoid false alarms).
 *   - All text production happens in the UI layer via i18n — engine emits codes only.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Scoring helpers
// Each domain returns { score, hasData } where score is the raw contribution.
// hasData is true only when a real measured value exists — it drives dataConfidence.
// ─────────────────────────────────────────────────────────────────────────────

function scoreSleep(sleepMinutes) {
  // 0 minutes is treated as "not recorded" — same as null.
  const mins = sleepMinutes > 0 ? sleepMinutes : null;
  if (mins == null) return { score: 20, hasData: false }; // neutral contribution
  if (mins >= 480) return { score: 40, hasData: true };
  if (mins >= 420) return { score: 34, hasData: true };
  if (mins >= 360) return { score: 25, hasData: true };
  if (mins >= 300) return { score: 13, hasData: true };
  return { score: 5, hasData: true };
}

function scoreNutrition(proteinCurrent, proteinTarget, kcalCurrent, kcalTarget) {
  let score = 0;
  let hasData = false;

  // Protein component — 0 to 20 points.
  if (proteinTarget > 0 && proteinCurrent != null && proteinCurrent > 0) {
    hasData = true;
    const pct = (proteinCurrent / proteinTarget) * 100;
    if (pct >= 90) score += 20;
    else if (pct >= 70) score += 15;
    else if (pct >= 50) score += 10;
    else if (pct >= 30) score += 6;
    else score += 3;
  } else {
    score += 10; // neutral — no data or no target
  }

  // Kcal component — 0 to 15 points.
  if (kcalTarget > 0 && kcalCurrent != null && kcalCurrent > 0) {
    hasData = true;
    const diff = kcalCurrent - kcalTarget;
    if (diff >= -200 && diff <= 200) score += 15;
    else if (diff >= -400 && diff <= 400) score += 11;
    else if (diff >= -600 && diff <= 600) score += 7;
    else score += 3;
  } else {
    score += 8; // neutral
  }

  return { score: Math.min(score, 35), hasData };
}

function scoreHydration(consumedMl, targetMl) {
  if (consumedMl == null || consumedMl <= 0 || targetMl == null || targetMl <= 0) {
    return { score: 12, hasData: false }; // neutral
  }
  const pct = (consumedMl / targetMl) * 100;
  if (pct >= 80) return { score: 25, hasData: true };
  if (pct >= 60) return { score: 18, hasData: true };
  if (pct >= 40) return { score: 10, hasData: true };
  if (pct >= 20) return { score: 5, hasData: true };
  return { score: 2, hasData: true };
}

function classifyReadiness(score, dataConfidence) {
  if (dataConfidence === "minimal") return "unknown";
  if (score >= 75) return "high";
  if (score >= 55) return "moderate";
  if (score >= 35) return "low";
  return "low";
}

function computeDataConfidence(sleepHasData, nutritionHasData, hydrationHasData) {
  const known = [sleepHasData, nutritionHasData, hydrationHasData].filter(Boolean).length;
  if (known === 3) return "full";
  if (known >= 1) return "partial";
  return "minimal";
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function resolvePrimeCore({
  hasProfile,
  goals,
  dailyCoach,
  dailySummary,
  hydrationData,
  sleepData,
  postureSignal = null,
  isLoading = false,
  currentHour = new Date().getHours(),
}) {
  const hour = currentHour;

  // ── LOADING GUARD ────────────────────────────────────────────────────────
  if (isLoading) {
    return {
      readiness: "unknown",
      readinessScore: null,
      priority: "low",
      commandCode: "loading",
      supportCode: "",
      commandMeta: {},
      supportMeta: {},
      dataConfidence: "minimal",
      targetScreen: "Home",
      actionType: "loading",
    };
  }

  // ── PROFILE GUARD ────────────────────────────────────────────────────────
  const hasMeals = (dailySummary?.meal_count ?? 0) > 0;
  const hasHydration = (hydrationData?.consumed_ml ?? 0) > 0;
  const isFirstSession = !hasProfile && !hasMeals && !hasHydration;

  if (!hasProfile) {
    return {
      readiness: "unknown",
      readinessScore: null,
      priority: "high",
      commandCode: isFirstSession ? "profile_first" : "profile",
      supportCode: isFirstSession ? "profile_first" : "profile",
      commandMeta: {},
      supportMeta: {},
      dataConfidence: "minimal",
      targetScreen: "Profile",
      actionType: "profile",
    };
  }

  // ── FIRST LOG PRAISE ─────────────────────────────────────────────────────
  const totalLogs = (dailySummary?.meal_count ?? 0) + (hasHydration ? 1 : 0);
  if (totalLogs === 1 && hour < 22) {
    return {
      readiness: "unknown",
      readinessScore: null,
      priority: "medium",
      commandCode: "first_log",
      supportCode: "first_log",
      commandMeta: {},
      supportMeta: {},
      dataConfidence: "minimal",
      targetScreen: "Nutrition",
      actionType: "first_log",
    };
  }

  // ── DERIVE SIGNALS ───────────────────────────────────────────────────────
  const sleepMinutes = (sleepData?.total_sleep_minutes > 0)
    ? sleepData.total_sleep_minutes
    : null;

  const proteinCurrent = dailyCoach?.actual_protein_g ?? dailySummary?.total_protein_g ?? null;
  const proteinTarget  = goals?.protein_target_g ?? dailyCoach?.protein_target_g ?? 0;
  const proteinGap = (proteinTarget > 0 && proteinCurrent != null)
    ? Math.max(proteinTarget - proteinCurrent, 0)
    : null;

  const kcalCurrent = dailyCoach?.actual_kcal ?? dailySummary?.total_kcal ?? null;
  const kcalTarget  = goals?.calorie_target_kcal ?? dailyCoach?.calorie_target_kcal ?? 0;
  // kcalDiff: positive = over target, negative = under target.
  const kcalDiff = (kcalTarget > 0 && kcalCurrent != null) ? kcalCurrent - kcalTarget : null;

  const consumedMl = hydrationData?.consumed_ml ?? null;
  const targetMl   = hydrationData?.target_ml ?? goals?.water_target_ml ?? 2500;
  const hydPct = (consumedMl != null && targetMl > 0)
    ? (consumedMl / targetMl) * 100
    : null;

  // ── READINESS SCORE ──────────────────────────────────────────────────────
  const sleepScore       = scoreSleep(sleepMinutes);
  const nutritionScore   = scoreNutrition(proteinCurrent, proteinTarget, kcalCurrent, kcalTarget);
  const hydrationScore   = scoreHydration(consumedMl, targetMl);

  const readinessScore   = sleepScore.score + nutritionScore.score + hydrationScore.score;
  const dataConfidence   = computeDataConfidence(
    sleepScore.hasData,
    nutritionScore.hasData,
    hydrationScore.hasData,
  );
  const readiness        = classifyReadiness(readinessScore, dataConfidence);

  // ── PRIORITY WATERFALL ───────────────────────────────────────────────────
  // Each branch returns a complete result object. First match wins.

  // ── CRITICAL: Severe dehydration (< 25%) during active hours ────────────
  if (hydPct !== null && hydPct < 25 && hour >= 10 && hour < 22) {
    return {
      readiness,
      readinessScore,
      priority: "critical",
      commandCode: "hydration_critical",
      supportCode: "hydration_critical",
      commandMeta: {},
      supportMeta: { pct: Math.round(hydPct) },
      dataConfidence,
      targetScreen: "Hydration",
      actionType: "hydration_critical",
    };
  }

  // ── CRITICAL: Very short sleep (< 5h) in the first half of the day ───────
  if (sleepMinutes !== null && sleepMinutes < 300 && hour >= 6 && hour < 16) {
    return {
      readiness,
      readinessScore,
      priority: "critical",
      commandCode: "sleep_critical",
      supportCode: "sleep_critical",
      commandMeta: {},
      supportMeta: { hours: Math.floor(sleepMinutes / 60), mins: sleepMinutes % 60 },
      dataConfidence,
      targetScreen: "Sleep",
      actionType: "sleep_critical",
    };
  }

  // ── HIGH: Severe protein gap (> 50g) before late evening ────────────────
  if (proteinGap !== null && proteinGap > 50 && hour < 20) {
    return {
      readiness,
      readinessScore,
      priority: "high",
      commandCode: "protein_critical",
      supportCode: "protein_critical",
      commandMeta: { gap: Math.round(proteinGap) },
      supportMeta: {},
      dataConfidence,
      targetScreen: "Nutrition",
      actionType: "protein_critical",
    };
  }

  // ── HIGH: Low hydration (< 40%) after midday ────────────────────────────
  if (hydPct !== null && hydPct < 40 && hour >= 12 && hour < 22) {
    return {
      readiness,
      readinessScore,
      priority: "high",
      commandCode: "hydration_low",
      supportCode: "hydration_low",
      commandMeta: {},
      supportMeta: { pct: Math.round(hydPct) },
      dataConfidence,
      targetScreen: "Hydration",
      actionType: "hydration_low",
    };
  }

  // ── MEDIUM: Moderate protein gap (30–50g) before late evening ───────────
  if (proteinGap !== null && proteinGap > 30 && hour < 21) {
    return {
      readiness,
      readinessScore,
      priority: "medium",
      commandCode: "protein_gap",
      supportCode: "protein_gap",
      commandMeta: { gap: Math.round(proteinGap) },
      supportMeta: {},
      dataConfidence,
      targetScreen: "Nutrition",
      actionType: "protein_gap",
    };
  }

  // ── MEDIUM: Calorie over (> 500 kcal) after 14:00 ───────────────────────
  if (kcalDiff !== null && kcalDiff > 500 && hour >= 14) {
    return {
      readiness,
      readinessScore,
      priority: "medium",
      commandCode: "kcal_over",
      supportCode: "kcal_over",
      commandMeta: {},
      supportMeta: { diff: Math.round(kcalDiff) },
      dataConfidence,
      targetScreen: "Nutrition",
      actionType: "kcal_over",
    };
  }

  // ── MEDIUM: Calorie under (> 500 kcal below) after 14:00 ────────────────
  if (kcalDiff !== null && kcalDiff < -500 && hour >= 14) {
    return {
      readiness,
      readinessScore,
      priority: "medium",
      commandCode: "kcal_under",
      supportCode: "kcal_under",
      commandMeta: { diff: Math.abs(Math.round(kcalDiff)) },
      supportMeta: {},
      dataConfidence,
      targetScreen: "Nutrition",
      actionType: "kcal_under",
    };
  }

  // ── MEDIUM: Short sleep (5–6h) in working hours ─────────────────────────
  if (sleepMinutes !== null && sleepMinutes < 360 && hour >= 6 && hour < 20) {
    return {
      readiness,
      readinessScore,
      priority: "medium",
      commandCode: "sleep_low",
      supportCode: "sleep_low",
      commandMeta: {},
      supportMeta: { hours: Math.floor(sleepMinutes / 60), mins: sleepMinutes % 60 },
      dataConfidence,
      targetScreen: "Sleep",
      actionType: "sleep_low",
    };
  }

  // ── LOW POSITIVE: Sleep not yet checked, morning window ─────────────────
  // Nudge user to open Sleep screen — not an alarm, just a morning check-in.
  if (sleepMinutes === null && hour >= 7 && hour < 11) {
    return {
      readiness,
      readinessScore,
      priority: "low",
      commandCode: "sleep_check",
      supportCode: "sleep_check",
      commandMeta: {},
      supportMeta: {},
      dataConfidence,
      targetScreen: "Sleep",
      actionType: "sleep_check",
    };
  }

  // ── LOW POSITIVE: High readiness in morning / midday ────────────────────
  if (readiness === "high" && hour >= 6 && hour < 15) {
    return {
      readiness,
      readinessScore,
      priority: "low",
      commandCode: "readiness_high",
      supportCode: dataConfidence === "full" ? "readiness_high_full" : "readiness_high",
      commandMeta: {},
      supportMeta: {},
      dataConfidence,
      targetScreen: "Home",
      actionType: "readiness_high",
    };
  }

  // ── LOW: Posture Guidance (when no other focus is present) ───────────────
  if (
    postureSignal?.kind === "support" &&
    postureSignal.priorityTag === "medium" &&
    hour >= 8 &&
    hour < 22
  ) {
    return {
      readiness,
      readinessScore,
      priority: "medium",
      commandCode: postureSignal.directive ? null : `posture_${postureSignal.commandKey}`,
      supportCode: postureSignal.directive ? null : `posture_${postureSignal.supportKey}`,
      commandMeta: {},
      supportMeta: {},
      directive: postureSignal.directive,
      dataConfidence,
      targetScreen: postureSignal.targetScreen,
      actionType: "posture",
    };
  }

  // ── LOW POSITIVE: Good sleep signal in the morning ──────────────────────
  if (sleepMinutes !== null && sleepMinutes >= 420 && hour >= 6 && hour < 13) {
    return {
      readiness,
      readinessScore,
      priority: "low",
      commandCode: "sleep_good",
      supportCode: "sleep_good",
      commandMeta: {},
      supportMeta: {},
      dataConfidence,
      targetScreen: "Home",
      actionType: "sleep_good",
    };
  }

  // ── MAINTAIN: All signals within acceptable range ────────────────────────
  const allOnTrack =
    (hydPct === null || hydPct >= 60) &&
    (proteinGap === null || proteinGap < 20) &&
    (kcalDiff === null || Math.abs(kcalDiff) < 300);

  if (allOnTrack) {
    return {
      readiness,
      readinessScore,
      priority: "low",
      commandCode: "maintain_good",
      supportCode: "maintain_good",
      commandMeta: {},
      supportMeta: {},
      dataConfidence,
      targetScreen: "Nutrition",
      actionType: "maintain_good",
    };
  }

  // ── DEFAULT MAINTAIN / POSTURE ──────────────────────────────────────────
  if (postureSignal?.kind === "support" && hour >= 8 && hour < 22) {
    return {
      readiness,
      readinessScore,
      priority: "low",
      commandCode: postureSignal.directive ? null : `posture_${postureSignal.commandKey}`,
      supportCode: postureSignal.directive ? null : `posture_${postureSignal.supportKey}`,
      commandMeta: {},
      supportMeta: {},
      directive: postureSignal.directive,
      dataConfidence,
      targetScreen: postureSignal.targetScreen,
      actionType: "posture",
    };
  }

  return {
    readiness,
    readinessScore,
    priority: "low",
    commandCode: "maintain",
    supportCode: "maintain",
    commandMeta: {},
    supportMeta: {},
    dataConfidence,
    targetScreen: "Nutrition",
    actionType: "maintain",
  };
}
