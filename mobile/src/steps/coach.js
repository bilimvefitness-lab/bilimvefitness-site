import { classifyStepActivity } from "./insights";
import { STEP_COACH_DEFAULT_GOAL } from "./config";

export const STEP_CHECKPOINTS = [
  { hour: 12, share: 0.3, label: "12:00" },
  { hour: 15, share: 0.5, label: "15:00" },
  { hour: 18, share: 0.75, label: "18:00" },
  { hour: 20, share: 0.9, label: "20:00" },
];

const MIN_ADAPTIVE_GOAL = 4500;
const MAX_ADAPTIVE_GOAL = 14000;
const DAY_END_HOUR = 23;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function safeNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function roundToNearestHundred(value) {
  return Math.round(value / 100) * 100;
}

function sumStepCounts(items = []) {
  return (items || []).reduce((total, item) => total + safeNumber(item?.stepCount), 0);
}

function averageStepCounts(items = []) {
  if (!items.length) {
    return 0;
  }
  return sumStepCounts(items) / items.length;
}

function localHourLabel(hour) {
  return `${String(hour).padStart(2, "0")}:00`;
}

function classifyCheckpointGap(gap) {
  if (gap <= -700) {
    return "behind";
  }
  if (gap >= 700) {
    return "ahead";
  }
  return "on_track";
}

function formatSigned(value) {
  const normalized = safeNumber(value);
  return `${normalized > 0 ? "+" : ""}${Math.round(normalized)}`;
}

export function formatNotificationPermissionLabel(status) {
  if (status === "granted") {
    return "Bildirim acik";
  }
  if (status === "denied") {
    return "Bildirim kapali";
  }
  if (status === "unavailable") {
    return "Bildirim yok";
  }
  return "Bildirim bekliyor";
}

export function buildAdaptiveStepGoal(history = [], fallbackGoal = STEP_COACH_DEFAULT_GOAL) {
  const availableHistory = (history || []).filter((item) => item?.available);
  if (!availableHistory.length) {
    return fallbackGoal;
  }

  const average = averageStepCounts(availableHistory);
  let nextGoal = average;

  if (average < 3000) {
    nextGoal = average + 1200;
  } else if (average < 7000) {
    nextGoal = average + 1500;
  } else if (average < 10000) {
    nextGoal = average + 1000;
  } else if (average < 12000) {
    nextGoal = average + 600;
  }

  return clamp(roundToNearestHundred(nextGoal), MIN_ADAPTIVE_GOAL, MAX_ADAPTIVE_GOAL);
}

export function buildStepTrendSignals(history = []) {
  const availableHistory = (history || []).filter((item) => item?.available);
  const latest = availableHistory[availableHistory.length - 1] || null;
  const threeDaysAgo = availableHistory.length >= 3 ? availableHistory[availableHistory.length - 3] : null;
  const sevenDaysAgo = availableHistory.length >= 7 ? availableHistory[availableHistory.length - 7] : availableHistory[0] || null;
  const delta3 = latest && threeDaysAgo ? latest.stepCount - threeDaysAgo.stepCount : 0;
  const delta7 = latest && sevenDaysAgo ? latest.stepCount - sevenDaysAgo.stepCount : 0;

  const recent3Average = averageStepCounts(availableHistory.slice(-3));
  const early3Average = averageStepCounts(availableHistory.slice(0, 3));
  const sevenDayAverage = averageStepCounts(availableHistory.slice(-7));

  let direction3 = "steady";
  let direction7 = "steady";
  if (delta3 <= -1500) {
    direction3 = "down";
  } else if (delta3 >= 1500) {
    direction3 = "up";
  }
  if (delta7 <= -2500) {
    direction7 = "down";
  } else if (delta7 >= 2500) {
    direction7 = "up";
  }

  let coachMessage = "Prime: son gunlerde ritim dengede. Bugunku plani dagit.";
  if (direction3 === "down" || direction7 === "down") {
    coachMessage = "Prime: son gunlerde adim dusuyor. Bugun seriyi bir kisa yuruyusle cevir.";
  } else if (direction3 === "up" || direction7 === "up") {
    coachMessage = "Prime: adim trendi yukari gidiyor. Bu ivmeyi bugun de koru.";
  }

  return {
    delta3,
    delta7,
    direction3,
    direction7,
    recent3Average,
    early3Average,
    sevenDayAverage,
    coachMessage,
  };
}

export function buildHourlyDistribution(hourlySteps = [], now = new Date()) {
  const normalized = Array.from({ length: 24 }, (_, hour) => {
    const item = (hourlySteps || []).find((entry) => Number(entry?.hour) === hour);
    const isFuture = hour > now.getHours();
    return {
      hour,
      label: localHourLabel(hour),
      stepCount: safeNumber(item?.stepCount),
      available: Boolean(item?.available) && !isFuture,
      isFuture,
    };
  });

  const completedHours = normalized.filter((item) => !item.isFuture);
  const activeHours = completedHours.filter((item) => item.stepCount > 0);
  const peakHour = activeHours.sort((left, right) => right.stepCount - left.stepCount)[0] || null;

  const morning = sumStepCounts(normalized.filter((item) => item.hour < 12));
  const afternoon = sumStepCounts(normalized.filter((item) => item.hour >= 12 && item.hour < 18));
  const evening = sumStepCounts(normalized.filter((item) => item.hour >= 18 && item.hour <= 23));

  let dominantWindow = "gun icine yayiliyor";
  if (morning >= afternoon && morning >= evening && morning > 0) {
    dominantWindow = "sabah saatlerinde geliyor";
  } else if (afternoon >= morning && afternoon >= evening && afternoon > 0) {
    dominantWindow = "ogleden sonra geliyor";
  } else if (evening > 0) {
    dominantWindow = "aksama yigiliyor";
  }

  return {
    available: activeHours.length > 0,
    items: normalized,
    peakHour,
    dominantWindow,
    summary: peakHour
      ? `Adimlarin en guclu saati ${peakHour.label}. Ritim daha cok ${dominantWindow}.`
      : "Saatlik dagilim icin yeterli bugun verisi yok.",
  };
}

function cumulativeStepsUntil(hourlyDistribution, targetHour) {
  return sumStepCounts(
    (hourlyDistribution?.items || []).filter((item) => item.available && item.hour < targetHour)
  );
}

function buildCheckpointMessage(checkpoint, status, expectedSteps, actualSteps, pacePerHour) {
  if (status === "ahead") {
    return `${checkpoint.label} icin onde gidiyorsun. Ritim iyi, suyu unutma.`;
  }
  if (status === "behind") {
    return `${checkpoint.label} bandi geride. Saatte ${Math.max(Math.round(pacePerHour), 250)} adim ekle.`;
  }
  if (actualSteps > 0) {
    return `${checkpoint.label} kontrolu dengede. ${Math.max(Math.round(expectedSteps - actualSteps), 0)} adim kaldi.`;
  }
  return `${checkpoint.label} oncesi ritmi ac. Saatte ${Math.max(Math.round(pacePerHour), 250)} adim topla.`;
}

function buildDeadlineMessage(hoursLeft, remainingSteps, requiredPerHour) {
  if (remainingSteps <= 0) {
    return "Prime: bugunun hedefi tamam. Kalan saatlerde tempoyu sakince koru.";
  }
  if (hoursLeft <= 1.5) {
    return `Prime: ${Math.max(Math.round(hoursLeft), 1)} saat kaldi, ${remainingSteps} adim gerekiyor. Simdi yuru.`;
  }
  return `Prime: ${Math.ceil(hoursLeft)} saat kaldi, ${remainingSteps} adim gerekiyor. Saatte ${requiredPerHour} adim hedefle.`;
}

export function buildActiveStepCoach({
  todayRecord,
  history = [],
  hourlySteps = [],
  now = new Date(),
  defaultGoal = STEP_COACH_DEFAULT_GOAL,
}) {
  const adaptiveGoal = buildAdaptiveStepGoal(history, defaultGoal);
  const currentSteps = safeNumber(todayRecord?.stepCount);
  const progressPercent = Number(((currentSteps / adaptiveGoal) * 100).toFixed(1));
  const remainingSteps = Math.max(adaptiveGoal - currentSteps, 0);

  const dayEnd = new Date(now);
  dayEnd.setHours(DAY_END_HOUR, 59, 59, 999);
  const hoursLeft = Math.max((dayEnd.getTime() - now.getTime()) / 3600000, 0);
  const requiredPerHour = remainingSteps > 0 ? Math.max(Math.ceil(remainingSteps / Math.max(hoursLeft, 1)), 250) : 0;

  const hourlyDistribution = buildHourlyDistribution(hourlySteps, now);
  const trendSignals = buildStepTrendSignals(history);
  const activity = classifyStepActivity(currentSteps);

  const checkpointStatuses = STEP_CHECKPOINTS.map((checkpoint) => {
    const expectedSteps = Math.round(adaptiveGoal * checkpoint.share);
    const actualSteps =
      hourlyDistribution.available && now.getHours() >= checkpoint.hour
        ? cumulativeStepsUntil(hourlyDistribution, checkpoint.hour)
        : currentSteps;
    const gap = actualSteps - expectedSteps;
    const status =
      now.getHours() >= checkpoint.hour
        ? classifyCheckpointGap(gap)
        : remainingSteps <= 0
          ? "ahead"
          : "upcoming";
    const hoursToCheckpoint = Math.max(checkpoint.hour - (now.getHours() + now.getMinutes() / 60), 1);
    const pacePerHour = Math.max(Math.ceil(Math.max(expectedSteps - currentSteps, 0) / hoursToCheckpoint), 250);

    return {
      ...checkpoint,
      expectedSteps,
      actualSteps,
      gap,
      status,
      pacePerHour,
      message: buildCheckpointMessage(checkpoint, status, expectedSteps, actualSteps, pacePerHour),
      isUpcoming: now.getHours() < checkpoint.hour,
    };
  });

  const nextCheckpoint =
    checkpointStatuses.find((item) => item.isUpcoming) || checkpointStatuses[checkpointStatuses.length - 1] || null;
  const activeGap = nextCheckpoint ? nextCheckpoint.actualSteps - nextCheckpoint.expectedSteps : 0;

  let notificationScenario = "steady";
  if (remainingSteps <= 0 || activity.activityLevel === "good" || activity.activityLevel === "very_high") {
    notificationScenario = "high_activity";
  } else if (activeGap <= -700 || trendSignals.direction3 === "down" || trendSignals.direction7 === "down") {
    notificationScenario = "low_activity";
  }

  let realtimeMessage = buildDeadlineMessage(hoursLeft, remainingSteps, requiredPerHour);
  if (remainingSteps <= 0) {
    realtimeMessage = "Prime: hedef tamam. Aksam rutini icin sadece ritmi koru.";
  } else if (notificationScenario === "low_activity" && nextCheckpoint) {
    realtimeMessage = `Prime: ${nextCheckpoint.label} oncesi geridesin. Her saate ${nextCheckpoint.pacePerHour} adim bol.`;
  } else if (notificationScenario === "high_activity") {
    realtimeMessage = `Prime: ritim iyi. Kalan ${remainingSteps} adimi sakin tempoda kapat, suyu unutma.`;
  }

  return {
    available: Boolean(todayRecord?.available),
    adaptiveGoal,
    progressPercent,
    remainingSteps,
    hoursLeft: Number(hoursLeft.toFixed(1)),
    requiredPerHour,
    deadlineMessage: buildDeadlineMessage(hoursLeft, remainingSteps, requiredPerHour),
    realtimeMessage,
    trendSignals,
    hourlyDistribution,
    checkpointStatuses,
    nextCheckpoint,
    notificationScenario,
    summaryLine:
      remainingSteps <= 0
        ? "Prime aktif koc: hedef kapandi."
        : `${Math.ceil(hoursLeft || 0)} saat kaldi, ${remainingSteps} adim gerekiyor.`,
    rewardMessage:
      trendSignals.direction3 === "up" || trendSignals.direction7 === "up"
        ? `Prime: trend yukari. Son 3 gunde ${formatSigned(trendSignals.delta3)} adim fark var.`
        : trendSignals.direction3 === "down" || trendSignals.direction7 === "down"
          ? `Prime: trend asagi. Son 7 gunde ${formatSigned(trendSignals.delta7)} adim fark var.`
          : "Prime: trend dengede. Bugunu temiz kapat.",
  };
}

export function buildStepNotificationCopy(coachState, checkpoint) {
  if (!coachState || !checkpoint) {
    return {
      title: "Prime aktif koc",
      body: "Bugunku adim durumunu kontrol et ve ritmini koru.",
    };
  }

  if (coachState.notificationScenario === "high_activity") {
    return {
      title: `Prime ${checkpoint.label}`,
      body: `Ritim iyi. Kalan ${coachState.remainingSteps} adimi sakin tempoda kapat, suyu unutma.`,
    };
  }

  if (coachState.notificationScenario === "low_activity") {
    return {
      title: `Prime ${checkpoint.label}`,
      body: `${coachState.remainingSteps} adim kaldi. Saatte ${checkpoint.pacePerHour} adim ekleyip acigi kapat.`,
    };
  }

  return {
    title: `Prime ${checkpoint.label}`,
    body: `Hedefe ${coachState.remainingSteps} adim var. Ritmi dagit ve saatte ${checkpoint.pacePerHour} adim hedefle.`,
  };
}
