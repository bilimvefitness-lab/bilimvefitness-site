export const WALK_SESSION_PRESETS = [5, 10, 15];

function safeNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

export function formatWalkSessionDuration(totalSeconds = 0) {
  const normalized = Math.max(Math.floor(safeNumber(totalSeconds)), 0);
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function createIdleWalkSession() {
  return {
    status: "idle",
    presetMinutes: 10,
    startedAt: null,
    baselineSteps: 0,
    liveSteps: 0,
    sessionSteps: 0,
    elapsedSeconds: 0,
    primeMessage: "Yuruyusu baslat, adimlar canli takipte acilsin.",
    summary: null,
    targetReached: false,
    firedTriggers: [],
  };
}

export function buildWalkSessionPrimeMessage({
  elapsedSeconds = 0,
  sessionSteps = 0,
  presetMinutes = 10,
}) {
  const targetSeconds = Math.max(safeNumber(presetMinutes) * 60, 60);
  const progress = Math.min(elapsedSeconds / targetSeconds, 1.5);

  if (elapsedSeconds < 45) {
    return "Prime: baslangic iyi. Ilk dakikada ritmi sakin ama net kur.";
  }

  if (sessionSteps <= 50 && elapsedSeconds >= 90) {
    return "Prime: adim sayisi yavas geliyor. Telefonunun seninle oldugundan emin ol ve tempoyu hafif artir.";
  }

  if (progress < 0.45) {
    return "Prime: ritim kuruluyor. Bir sonraki blokta adimlari tek parcada topla.";
  }

  if (progress < 0.9) {
    return "Prime: orta bolumdesin. Omuzlari rahat tut, tempoyu dagitma.";
  }

  if (progress < 1) {
    return "Prime: bitirise giriyorsun. Son dakikayi biraz daha canli gec.";
  }

  return "Prime: preset tamam. Istersen bitir ya da biraz daha bonus adim topla.";
}

function resolvePaceLabel(sessionSteps, durationSeconds) {
  const minutes = Math.max(safeNumber(durationSeconds) / 60, 1);
  const stepsPerMinute = safeNumber(sessionSteps) / minutes;

  if (stepsPerMinute >= 115) {
    return "cok guclu tempo";
  }
  if (stepsPerMinute >= 85) {
    return "net tempo";
  }
  if (stepsPerMinute >= 55) {
    return "rahat tempo";
  }
  return "hafif tempo";
}

export function buildWalkSessionSummary({
  durationSeconds = 0,
  sessionSteps = 0,
  baselineSteps = 0,
  totalSteps = 0,
  goalSteps = 6000,
  todayRank = null,
}) {
  const contributionPercent = Math.min(
    Number((((safeNumber(sessionSteps) / Math.max(safeNumber(goalSteps), 1)) * 100) || 0).toFixed(1)),
    100
  );
  const afterTotal = Math.max(safeNumber(totalSteps), safeNumber(baselineSteps));
  const remainingSteps = Math.max(safeNumber(goalSteps) - afterTotal, 0);

  let title = "Yuruyus tamam";
  let feedback = "Kisa blok tamam. Bugunun yonunu hareket tarafina cevirdin.";

  if (sessionSteps >= 1800) {
    title = "Cok guclu blok";
    feedback = "Bu session gunu ciddi sekilde yukari tasidi. Ritim sende.";
  } else if (sessionSteps >= 900) {
    title = "Temiz is";
    feedback = "Guclu bir blok kapattin. Hedefe dogrudan katkisi var.";
  } else if (sessionSteps <= 150) {
    title = "Blok kaydi alindi";
    feedback = "Sure tamamlandi. Bir sonraki blokta telefonu yaninda tutup tempoyu biraz daha ac.";
  }

  return {
    title,
    feedback,
    contributionPercent,
    remainingSteps,
    durationSeconds: Math.max(Math.floor(safeNumber(durationSeconds)), 0),
    sessionSteps: Math.max(Math.floor(safeNumber(sessionSteps)), 0),
    totalSteps: afterTotal,
    paceLabel: resolvePaceLabel(sessionSteps, durationSeconds),
    todayRank,
  };
}

export function buildSessionMiniGoals(currentSteps = 0, goalSteps = 6000) {
  const normalizedCurrent = safeNumber(currentSteps);
  const normalizedGoal = Math.max(safeNumber(goalSteps), 6000);

  return [
    {
      key: "mini-1000",
      label: "1000 adim",
      reached: normalizedCurrent >= 1000,
    },
    {
      key: "mini-3000",
      label: "3000 adim",
      reached: normalizedCurrent >= 3000,
    },
    {
      key: "mini-goal",
      label: `Gunluk hedef ${Math.round(normalizedGoal)}`,
      reached: normalizedCurrent >= normalizedGoal,
    },
  ];
}

export function buildWalkSessionRewardMessage(summary) {
  if (!summary) {
    return "";
  }

  if (summary.sessionSteps >= 1800) {
    return summary.todayRank === 1
      ? "Bugunun en guclu sessioni geldi. Bu hissi koru."
      : "Bugunu tasiyan blok geldi. Bu hissi koru.";
  }
  if (summary.sessionSteps >= 900) {
    return `Kisa ama etkili. ${summary.paceLabel} ile gunluk ritim tekrar sende.`;
  }
  if (summary.sessionSteps > 0) {
    return "Hareket basladi. Devami bugunu toparlar.";
  }
  return "Sureyi kapattin. Sonraki blokta adimlari daha gorunur hale getirelim.";
}

export function buildWalkSessionTriggers(session) {
  if (!session || session.status !== "active") {
    return [];
  }

  const elapsedSeconds = Math.max(Math.floor(safeNumber(session.elapsedSeconds)), 0);
  const sessionSteps = Math.max(Math.floor(safeNumber(session.sessionSteps)), 0);
  const presetSeconds = Math.max(Math.round(safeNumber(session.presetMinutes) * 60), 60);
  const halfPoint = Math.floor(presetSeconds / 2);

  const triggers = [];
  if (elapsedSeconds >= 60) {
    triggers.push({
      key: "time_60",
      tone: "success",
      message: "Prime: ilk dakika tamam. Simdi ritmi tek parcada koru.",
    });
  }
  if (elapsedSeconds >= halfPoint) {
    triggers.push({
      key: "time_half",
      tone: "success",
      message: "Prime: session ortasindasin. Omuzlari rahat birak ve tempoyu dagitma.",
    });
  }
  if (presetSeconds - elapsedSeconds <= 60 && elapsedSeconds < presetSeconds) {
    triggers.push({
      key: "time_last_minute",
      tone: "success",
      message: "Prime: son 1 dakika. Bitirisi biraz daha canli gec.",
    });
  }
  if (sessionSteps >= 300) {
    triggers.push({
      key: "steps_300",
      tone: "success",
      message: "Prime: 300 session adimi geldi. Blok acildi.",
    });
  }
  if (sessionSteps >= 700) {
    triggers.push({
      key: "steps_700",
      tone: "success",
      message: "Prime: 700 adim oldu. Session agirligini hissettirmeye basladi.",
    });
  }
  if (sessionSteps >= 1000) {
    triggers.push({
      key: "steps_1000",
      tone: "success",
      message: "Prime: 1000 session adimi tamam. Bu blok bugunu ciddi sekilde tasiyor.",
    });
  }

  return triggers;
}

export function consumeWalkSessionTriggers(session) {
  const knownTriggers = new Set(session?.firedTriggers || []);
  const nextTrigger = buildWalkSessionTriggers(session).find((trigger) => !knownTriggers.has(trigger.key)) || null;

  return {
    nextTrigger,
    firedTriggers: nextTrigger ? [...knownTriggers, nextTrigger.key] : [...knownTriggers],
  };
}
