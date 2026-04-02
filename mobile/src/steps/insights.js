export const STEP_GOAL = 10000;

const ACTIVITY_RULES = [
  { max: 2999, level: "very_low", label: "çok düşük", calorieDelta: -200, hydrationDelta: 0 },
  { max: 6999, level: "low", label: "düşük", calorieDelta: -75, hydrationDelta: 150 },
  { max: 9999, level: "moderate", label: "orta", calorieDelta: 125, hydrationDelta: 350 },
  { max: 14999, level: "good", label: "iyi", calorieDelta: 300, hydrationDelta: 600 },
  { max: Number.POSITIVE_INFINITY, level: "very_high", label: "çok yüksek", calorieDelta: 450, hydrationDelta: 900 },
];

const DAY_LABELS = ["Paz", "Pzt", "Sal", "Çar", "Per", "Cum", "Cmt"];

function safeNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function classifyStepActivity(stepCount = 0) {
  const normalizedSteps = Math.max(Number(stepCount || 0), 0);
  const matched = ACTIVITY_RULES.find((rule) => normalizedSteps <= rule.max) || ACTIVITY_RULES[ACTIVITY_RULES.length - 1];
  return {
    stepCount: normalizedSteps,
    activityLevel: matched.level,
    activityLabel: matched.label,
    calorieDelta: matched.calorieDelta,
    hydrationDelta: matched.hydrationDelta,
  };
}

export function buildStepTrend(history = []) {
  const recent = (history || []).filter((item) => item?.available).slice(-3);
  if (recent.length < 3) {
    return {
      direction: "insufficient_data",
      summary: "Son 3 gün trendi için yeterli adım verisi yok.",
    };
  }

  const delta = recent[recent.length - 1].stepCount - recent[0].stepCount;
  if (delta >= 1500) {
    return {
      direction: "up",
      summary: "Son 3 günde hareket artıyor.",
    };
  }
  if (delta <= -1500) {
    return {
      direction: "down",
      summary: "Son 3 günde hareket düşüyor.",
    };
  }
  return {
    direction: "steady",
    summary: "Son 3 günde hareket dengeli.",
  };
}

export function buildStepInsight(record, history = [], options = {}) {
  const baseCalorieTarget = safeNumber(options.baseCalorieTargetKcal);
  const weightKg = safeNumber(options.weightKg);
  const goal = safeNumber(options.stepGoal) || STEP_GOAL;

  if (!record?.available) {
    const trend = buildStepTrend(history);
    return {
      available: false,
      stepGoal: goal,
      progressPercent: 0,
      activityLevel: null,
      activityLabel: "",
      calorieDelta: 0,
      adjustedCalorieTargetKcal: baseCalorieTarget,
      hydrationDelta: 0,
      hydrationTargetMl: weightKg ? Math.round(weightKg * 35) : null,
      movementAlerts: [],
      coachHint: "Adım verisi yok. İzin ver veya manuel giriş yap.",
      trendDirection: trend.direction,
      trendSummary: trend.summary,
    };
  }

  const activity = classifyStepActivity(record.stepCount);
  const trend = buildStepTrend(history);
  const movementAlerts = [];

  if (activity.activityLevel === "very_low" || activity.activityLevel === "low") {
    movementAlerts.push(`Bugün hareket düşük (${activity.stepCount} adım). 10-15 dakikalık yürüyüş ekle.`);
  }
  if (activity.activityLevel === "good" || activity.activityLevel === "very_high") {
    movementAlerts.push("Bugün hareket yüksek. Su ve enerji takibini sıkı tut.");
  }
  if (trend.direction === "down") {
    movementAlerts.push("Son 3 günde hareket düşüyor. Uzun oturma bloklarını böl.");
  }
  if (trend.direction === "up") {
    movementAlerts.push("Son 3 günde hareket artıyor. Bu ritmi koru.");
  }

  let coachHint = "Bugünkü hareket düzeyi dengeli. Ritim bozulmasın.";
  if ((activity.activityLevel === "very_low" || activity.activityLevel === "low") && trend.direction === "down") {
    coachHint = `Bugün adım düşük (${activity.stepCount}) ve son 3 günde ritim geriliyor. Kısa yürüyüşlerle açıl.`;
  } else if (activity.activityLevel === "very_low" || activity.activityLevel === "low") {
    coachHint = `Bugün adım düşük (${activity.stepCount}). Gün içine kısa yürüyüşler serpiştir.`;
  } else if (activity.activityLevel === "good" || activity.activityLevel === "very_high") {
    coachHint = `Bugün adım yüksek (${activity.stepCount}). Suyu ve enerjiyi geciktirme.`;
  } else if (trend.direction === "up") {
    coachHint = "Son 3 gündür hareket artıyor. Aynı ritmi koru.";
  }

  return {
    available: true,
    stepGoal: goal,
    progressPercent: Number(((activity.stepCount / goal) * 100).toFixed(1)),
    activityLevel: activity.activityLevel,
    activityLabel: activity.activityLabel,
    calorieDelta: activity.calorieDelta,
    adjustedCalorieTargetKcal: baseCalorieTarget == null ? null : Number((baseCalorieTarget + activity.calorieDelta).toFixed(1)),
    hydrationDelta: activity.hydrationDelta,
    hydrationTargetMl: weightKg ? Math.round(weightKg * 35) + activity.hydrationDelta : null,
    movementAlerts,
    coachHint,
    trendDirection: trend.direction,
    trendSummary: trend.summary,
  };
}

export function formatStepSourceLabel(source) {
  if (source === "ios_pedometer") {
    return "iPhone hareket sensörü";
  }
  if (source === "android_health_connect") {
    return "Health Connect";
  }
  if (source === "manual") {
    return "Manuel giriş";
  }
  return "Veri yok";
}

export function formatStepPermissionLabel(status) {
  if (status === "granted") {
    return "İzin verildi";
  }
  if (status === "denied") {
    return "İzin reddedildi";
  }
  if (status === "unavailable") {
    return "Kullanılamıyor";
  }
  return "İzin bekleniyor";
}

export function dayLabelFromDateKey(dateKey) {
  try {
    const parsed = new Date(`${dateKey}T12:00:00`);
    return DAY_LABELS[parsed.getDay()] || dateKey.slice(5);
  } catch {
    return dateKey.slice(5);
  }
}
