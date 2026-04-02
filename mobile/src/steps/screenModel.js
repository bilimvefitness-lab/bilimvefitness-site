import { classifyStepActivity } from "./insights";
import { STEP_COACH_DEFAULT_GOAL, STEP_MILESTONE_RULES } from "./config";
import { buildSessionMiniGoals } from "./walkSession";

function safeNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function roundToHundreds(value) {
  return Math.round(safeNumber(value) / 100) * 100;
}

function averageStepCounts(items = []) {
  const available = (items || []).filter((item) => item?.available);
  if (!available.length) {
    return 0;
  }
  return available.reduce((total, item) => total + safeNumber(item?.stepCount), 0) / available.length;
}

function buildScreenState(stepState, permissionStatus, manualMode) {
  if (stepState?.tone === "loading") {
    return "loading";
  }
  if (manualMode) {
    return "manual_mode";
  }
  if (permissionStatus === "granted") {
    return "active_tracking";
  }
  if (permissionStatus === "denied") {
    return "permission_denied";
  }
  if (permissionStatus === "unavailable") {
    return "unavailable";
  }
  return "permission_pending";
}

function buildPrimeMessage({ steps, goalSteps, remainingSteps, hoursLeft, now }) {
  if (remainingSteps <= 0) {
    return "Hedef tamam. Istersen bonus adimlar ekleyebilirsin.";
  }
  if (steps <= 0) {
    return "Bugun yavas basladin. Ilk 500 adimla ritmi ac.";
  }
  if (steps < 3000) {
    return "Baslangic yapildi. Biraz daha tempo lazim.";
  }
  if (steps < goalSteps) {
    if (now.getHours() >= 21) {
      return "Az kaldi. Son bir kisa yuruyusle hedef kapanir.";
    }
    return "Iyi gidiyorsun. Hedef yakin.";
  }
  if (steps >= goalSteps && steps < goalSteps + 2000) {
    return "Hedef tamam. Istersen bugunu bonus adimlarla guclendir.";
  }
  return "Bugun guclu gidiyorsun. Ritmi koru, suyu geciktirme.";
}

function buildSuggestedSteps({ remainingSteps, hoursLeft, now }) {
  if (remainingSteps <= 0) {
    return {
      steps: 500,
      message: "Istersen bonus icin 500 adimlik kisa bir tur ekleyebilirsin.",
    };
  }

  if (now.getHours() < 18) {
    const suggestion = Math.min(remainingSteps, Math.max(500, roundToHundreds(remainingSteps * 0.45)));
    return {
      steps: suggestion,
      message: `Aksamdan once en az ${suggestion} adim ekle.`,
    };
  }

  if (now.getHours() < 21) {
    const suggestion = Math.min(remainingSteps, Math.max(700, roundToHundreds(remainingSteps * 0.7)));
    return {
      steps: suggestion,
      message: `Bugunu kurtarmak icin en az ${suggestion} adim daha gerekli.`,
    };
  }

  return {
    steps: remainingSteps,
    message:
      hoursLeft <= 1.5
        ? `${remainingSteps} adimlik son bir tur bugunu kapatir.`
        : `${remainingSteps} adimi kalan saatlere bol ve kapanisi yap.`,
  };
}

function buildHeroModel({ steps, goalSteps, remainingSteps, suggestedSteps }) {
  if (steps <= 0) {
    return {
      eyebrow: "Bugun henuz baslamadin",
      title: "Ilk 500",
      label: "adimla ritmi ac",
      summary: `Hedef: ${goalSteps} adim`,
      support: "Kucuk bir yuruyusle baslayabilirsin.",
      progressLabel: "Hazirlik modu",
    };
  }

  if (remainingSteps <= 0) {
    return {
      eyebrow: "Bugun hedef kapandi",
      title: `${steps}`,
      label: "adim",
      summary: `Hedefin uzerindesin. Bonus alan ${Math.max(steps - goalSteps, 0)} adim.`,
      support: "Bugun guclu gidiyorsun. Kalan saatleri hafif tempoda koru.",
      progressLabel: "Bonus ritim",
    };
  }

  return {
    eyebrow: "Bugun harekettesin",
    title: `${steps}`,
    label: "adim",
    summary: `Hedefe kalan ${remainingSteps} adim`,
    support: `Sonraki blok icin onerilen minimum ${suggestedSteps} adim.`,
    progressLabel: "Gunluk ilerleme",
  };
}

function buildPermissionCard(permissionStatus) {
  if (permissionStatus === "denied") {
    return {
      title: "Otomatik takip su an kapali",
      body: "Adimlarini otomatik takip etmek icin fiziksel aktivite izni gerekli. Izin vermezsen manuel olarak da adim ekleyebilirsin.",
      primaryLabel: "Izin Ver",
      secondaryLabel: "Simdilik Manuel Kullan",
      tertiaryLabel: "Ayarlari Ac",
    };
  }

  if (permissionStatus === "unavailable") {
    return {
      title: "Bu cihazda otomatik takip hazir degil",
      body: "Adimlarini otomatik takip etmek icin uygun kaynak bulunamadi. Istersen manuel olarak devam edebilirsin.",
      primaryLabel: "",
      secondaryLabel: "Simdilik Manuel Kullan",
      tertiaryLabel: "",
    };
  }

  return {
    title: "Adimlarini otomatik takip etmek icin fiziksel aktivite izni gerekli",
    body: "Izin vermezsen manuel olarak da adim ekleyebilirsin.",
    primaryLabel: "Izin Ver",
    secondaryLabel: "Simdilik Manuel Kullan",
    tertiaryLabel: "",
  };
}

function buildReport(history = [], trendSignals = {}) {
  const available = (history || []).filter((item) => item?.available);
  const bestDay = available.reduce((best, item) => {
    if (!best || safeNumber(item?.stepCount) > safeNumber(best?.stepCount)) {
      return item;
    }
    return best;
  }, null);

  let trendTitle = "Ritim dengede";
  if (trendSignals.direction3 === "down" || trendSignals.direction7 === "down") {
    trendTitle = "Ritim dusuyor";
  } else if (trendSignals.direction3 === "up" || trendSignals.direction7 === "up") {
    trendTitle = "Ritim yukseliyor";
  }

  return {
    sevenDayAverage: roundToHundreds(trendSignals.sevenDayAverage || averageStepCounts(available)),
    bestDay,
    trendTitle,
    trendSummary:
      trendSignals.direction3 === "down" || trendSignals.direction7 === "down"
        ? "Son gunlerde hareket geri cekiliyor. Bugun seriyi tekrar yukari cevirmek icin kisa bloklar kullan."
        : trendSignals.direction3 === "up" || trendSignals.direction7 === "up"
          ? "Son gunlerde hareket yukari tasiniyor. Ayni ritmi bugun de koruyorsun."
          : "Son gunler dengede. Bugunu temiz kapatirsan ritim bozulmaz.",
  };
}

function buildMilestones(stepCount) {
  const current = safeNumber(stepCount);
  return STEP_MILESTONE_RULES.map((milestone) => ({
    ...milestone,
    reached: current >= milestone.threshold,
  }));
}

function buildMomentum(history = [], streakDays = 0) {
  const available = (history || []).filter((item) => item?.available);
  const activeDays7 = available.filter((item) => safeNumber(item?.stepCount) >= 3000).length;
  const totalSteps7 = available.reduce((total, item) => total + safeNumber(item?.stepCount), 0);

  return {
    streakDays: Math.max(safeNumber(streakDays), 0),
    activeDays7,
    totalSteps7,
  };
}

export function buildStepScreenModel({
  todaySteps,
  stepHistory = [],
  stepPermission,
  stepState,
  stepInsight,
  stepActiveCoach,
  stepGoal = STEP_COACH_DEFAULT_GOAL,
  manualMode = false,
  streakDays = 0,
  now = new Date(),
}) {
  const todayStepCount = safeNumber(todaySteps?.available ? todaySteps?.stepCount : 0);
  const goalSteps = Math.max(safeNumber(stepGoal), STEP_COACH_DEFAULT_GOAL);
  const remainingSteps = Math.max(goalSteps - todayStepCount, 0);
  const hoursLeft = safeNumber(stepActiveCoach?.hoursLeft);
  const progressPercent = Number(((todayStepCount / goalSteps) * 100).toFixed(1));
  const activity = stepInsight?.activityLabel ? stepInsight : classifyStepActivity(todayStepCount);
  const suggested = buildSuggestedSteps({
    remainingSteps,
    hoursLeft,
    now,
  });
  const hero = buildHeroModel({
    steps: todayStepCount,
    goalSteps,
    remainingSteps,
    suggestedSteps: suggested.steps,
  });
  const report = buildReport(stepHistory, stepActiveCoach?.trendSignals);
  const momentum = buildMomentum(stepHistory, streakDays);
  const screenState = buildScreenState(stepState, stepPermission?.status, manualMode);

  return {
    today_steps: todayStepCount,
    goal_steps: goalSteps,
    remaining_steps: remainingSteps,
    activity_level: activity?.activityLevel || null,
    activity_label: activity?.activityLabel || "",
    prime_message: buildPrimeMessage({
      steps: todayStepCount,
      goalSteps,
      remainingSteps,
      hoursLeft,
      now,
    }),
    trend_summary: report.trendSummary,
    permission_state: stepPermission?.status || "pending",
    manual_entry_enabled: true,
    screen_state: screenState,
    progress_percent: progressPercent,
    hero,
    suggested_steps: suggested.steps,
    suggested_message: suggested.message,
    starter: {
      title: "Bugun henuz hareket etmedin",
      body: "Kucuk bir yuruyusle baslayabilirsin.",
      actionLabel: "Harekete Basla",
    },
    permission_card: buildPermissionCard(stepPermission?.status),
    report: {
      activityLabel: activity?.activityLabel || "-",
      sevenDayAverage: report.sevenDayAverage,
      bestDay: report.bestDay,
      trendTitle: report.trendTitle,
      trendSummary: report.trendSummary,
      primeNote: stepActiveCoach?.rewardMessage || report.trendSummary,
      last3Delta: safeNumber(stepActiveCoach?.trendSignals?.delta3),
      last7Delta: safeNumber(stepActiveCoach?.trendSignals?.delta7),
    },
    mini_goals: buildSessionMiniGoals(todayStepCount, goalSteps),
    momentum,
    milestones: buildMilestones(todayStepCount),
  };
}
