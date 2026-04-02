function safeNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundToHundreds(value) {
  return Math.round(safeNumber(value) / 100) * 100;
}

function hashString(value) {
  return Array.from(String(value || "")).reduce((total, character) => {
    return (total * 31 + character.charCodeAt(0)) >>> 0;
  }, 7);
}

function seededPick(items, seedKey) {
  if (!Array.isArray(items) || !items.length) {
    return "";
  }
  return items[hashString(seedKey) % items.length];
}

function localDateKey(dateValue = new Date()) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function buildLastNDates(count, now = new Date()) {
  return Array.from({ length: count }, (_, index) => {
    const current = new Date(now);
    current.setHours(12, 0, 0, 0);
    current.setDate(current.getDate() - (count - index - 1));
    return localDateKey(current);
  });
}

function normalizeSessionDate(item) {
  return String(item?.date || "").slice(0, 10);
}

function completedSessions(items = []) {
  return (items || []).filter((item) => item?.completed && !item?.cancelled);
}

function completedSessionsOnDate(items = [], dateKey) {
  return completedSessions(items).filter((item) => normalizeSessionDate(item) === dateKey);
}

function buildSessionSummary(walkSessionHistory = [], dateKey, now = new Date()) {
  const sessionsToday = completedSessionsOnDate(walkSessionHistory, dateKey);
  const threshold = new Date(now);
  threshold.setHours(0, 0, 0, 0);
  threshold.setDate(threshold.getDate() - 6);
  const recentSessions = completedSessions(walkSessionHistory).filter((item) => {
    const parsed = new Date(`${normalizeSessionDate(item)}T12:00:00`);
    return !Number.isNaN(parsed.getTime()) && parsed >= threshold;
  });
  const latestSession = recentSessions[0] || null;

  return {
    completedToday: sessionsToday.length,
    totalSessions7d: recentSessions.length,
    latestSessionAt: latestSession?.startedAt || null,
  };
}

function buildMovementStreak(stepHistory = [], walkSessionHistory = [], now = new Date()) {
  const dateKeys = buildLastNDates(7, now);
  const stepMap = new Map((stepHistory || []).map((item) => [String(item?.date || ""), safeNumber(item?.stepCount)]));
  const sessionCountByDate = completedSessions(walkSessionHistory).reduce((result, item) => {
    const dateKey = normalizeSessionDate(item);
    result.set(dateKey, safeNumber(result.get(dateKey)) + 1);
    return result;
  }, new Map());

  const activeDays = dateKeys.map((dateKey) => ({
    date: dateKey,
    active: safeNumber(stepMap.get(dateKey)) >= 3000 || safeNumber(sessionCountByDate.get(dateKey)) >= 1,
  }));
  const activeDays7 = activeDays.filter((item) => item.active).length;

  let currentDays = 0;
  for (let index = activeDays.length - 1; index >= 0; index -= 1) {
    if (!activeDays[index].active) {
      break;
    }
    currentDays += 1;
  }

  let longestDays = 0;
  let currentRun = 0;
  for (const item of activeDays) {
    if (item.active) {
      currentRun += 1;
      longestDays = Math.max(longestDays, currentRun);
    } else {
      currentRun = 0;
    }
  }

  const completedToday = Boolean(activeDays[activeDays.length - 1]?.active);
  let protectionLevel = "safe";
  let protectionMessage = "Seri acik. Bugunu kapatirsan ritim korunur.";

  if (currentDays > 0 && !completedToday) {
    if (now.getHours() >= 21) {
      protectionLevel = "critical";
      protectionMessage = "Seri bozuluyor. Bugun kapanmadan son blok lazim.";
    } else if (now.getHours() >= 17) {
      protectionLevel = "watch";
      protectionMessage = "Seri riskte. Bu aksam tek blok yetebilir.";
    } else {
      protectionLevel = "safe";
      protectionMessage = "Seri korunuyor. Erken bir blok bugunu rahatlatir.";
    }
  }

  if (currentDays <= 0 && !completedToday) {
    protectionMessage = "Yeni seriyi bugun acabilirsin.";
  }

  return {
    days: currentDays,
    longestDays,
    activeDays7,
    completedToday,
    protectionLevel,
    protectionMessage,
  };
}

function buildDailyTask({ userId, dateKey, todaySteps, goalSteps, walkSessionHistory }) {
  const completedToday = completedSessionsOnDate(walkSessionHistory, dateKey).length;
  const minimumSteps = clamp(roundToHundreds(goalSteps * 0.7), 2800, Math.max(goalSteps, 2800));
  const selectedType = hashString(`${userId || "guest"}:${dateKey}`) % 2 === 0 ? "walk_session" : "step_goal";

  if (selectedType === "walk_session") {
    return {
      type: "walk_session",
      title: "Bugunun gorevi",
      subtitle: "En az 1 Walk Session tamamla",
      detail: "Tek blok bile olsa bugunun ritmini ac.",
      targetValue: 1,
      progressValue: Math.min(completedToday, 1),
      completed: completedToday >= 1,
      actionLabel: completedToday >= 1 ? "Tamamlandi" : "Walk Session Ac",
    };
  }

  return {
    type: "step_goal",
    title: "Bugunun gorevi",
    subtitle: `Minimum ${minimumSteps} adim topla`,
    detail: "Gunluk minimumu kapat, sonra bonus alana gec.",
    targetValue: minimumSteps,
    progressValue: safeNumber(todaySteps),
    completed: safeNumber(todaySteps) >= minimumSteps,
    actionLabel: safeNumber(todaySteps) >= minimumSteps ? "Tamamlandi" : "Hedefe Yuklen",
  };
}

function findNightWalk(walkSessionHistory = []) {
  return completedSessions(walkSessionHistory).find((item) => {
    const parsed = new Date(item?.startedAt || `${item?.date}T21:00:00`);
    if (Number.isNaN(parsed.getTime())) {
      return false;
    }
    const hour = parsed.getHours();
    return hour >= 20 || hour <= 4;
  }) || null;
}

function buildAchievements({ stepHistory = [], todaySteps = 0, walkSessionHistory = [], streak }) {
  const sessions = completedSessions(walkSessionHistory);
  const firstSession = sessions[sessions.length - 1] || sessions[0] || null;
  const nightWalk = findNightWalk(walkSessionHistory);
  const highestStepDay = [safeNumber(todaySteps), ...(stepHistory || []).map((item) => safeNumber(item?.stepCount))].reduce(
    (best, item) => Math.max(best, item),
    0
  );

  return [
    {
      key: "first_session",
      title: "Ilk Session",
      detail: "Walk Session sistemini ilk kez tamamladin.",
      earned: Boolean(firstSession),
      earnedAt: firstSession?.startedAt || null,
    },
    {
      key: "streak_3",
      title: "3 Gun Seri",
      detail: "Uc gun ust uste aktif kal.",
      earned: safeNumber(streak?.days) >= 3,
      earnedAt: safeNumber(streak?.days) >= 3 ? localDateKey() : null,
    },
    {
      key: "streak_7",
      title: "7 Gun Seri",
      detail: "Bir haftalik ritmi bozmadan koru.",
      earned: safeNumber(streak?.days) >= 7,
      earnedAt: safeNumber(streak?.days) >= 7 ? localDateKey() : null,
    },
    {
      key: "high_step_day",
      title: "Yuksek Step Gunu",
      detail: "10.000 adim bandini ac.",
      earned: highestStepDay >= 10000,
      earnedAt: highestStepDay >= 10000 ? localDateKey() : null,
    },
    {
      key: "night_walk",
      title: "Gece Yuruyusu",
      detail: "Aksam saatlerinde bir session kapat.",
      earned: Boolean(nightWalk),
      earnedAt: nightWalk?.startedAt || null,
    },
  ];
}

function buildLeaderboardModel(leaderboard, userId) {
  if (!leaderboard) {
    return {
      entries: [],
      currentUser: null,
      totalParticipants: 0,
      summary: "Gunluk tablo backend senkronizasyonuyla dolar.",
      gapToNext: null,
    };
  }

  const entries = (leaderboard.entries || []).map((item) => ({
    ...item,
    displayName: item.user_id === userId ? "Sen" : `Kullanici ${String(item.rank || "").padStart(2, "0")}`,
  }));
  const currentUser = leaderboard.current_user
    ? {
        ...leaderboard.current_user,
        displayName: leaderboard.current_user.user_id === userId ? "Sen" : "Sen",
      }
    : null;
  const nextAhead = currentUser
    ? entries.find((item) => safeNumber(item.rank) === safeNumber(currentUser.rank) - 1) || null
    : null;
  const gapToNext = nextAhead ? Math.max(safeNumber(nextAhead.step_count) - safeNumber(currentUser?.step_count), 0) : null;

  let summary = "Tablo bos. Ilk kaydi acan sen olabilirsin.";
  if (currentUser) {
    summary =
      currentUser.rank === 1
        ? "Bugun tabloyu sen tasiyorsun."
        : gapToNext != null
          ? `Bir ust basamak icin ${gapToNext} adim gerekiyor.`
          : `Bugun #${currentUser.rank} siradasin.`;
  } else if (safeNumber(leaderboard.total_participants) > 0) {
    summary = "Siraya girmek icin bugunku adimlarini senkronize et.";
  }

  return {
    entries,
    currentUser,
    totalParticipants: safeNumber(leaderboard.total_participants),
    summary,
    gapToNext,
  };
}

function buildFomoMessages({ streak, dailyTask, leaderboard, remainingSteps, now }) {
  const messages = [];

  if (safeNumber(streak?.days) > 0 && !streak?.completedToday && streak?.protectionLevel === "critical") {
    messages.push("Streak bozuluyor. Bugunun gorevini simdi kapat.");
  }

  if (!dailyTask?.completed && now.getHours() >= 19) {
    messages.push("Bugun gorev kapanmadi. Son blokla hala alabilirsin.");
  }

  if (safeNumber(remainingSteps) > 0 && now.getHours() >= 20) {
    messages.push("Bugun hedefe ulasmadin. Kisa bir turla fark kapanabilir.");
  }

  if (safeNumber(leaderboard?.currentUser?.rank) > 3) {
    messages.push("Tabloda geri dusuyorsun. Bir blok seni tekrar yukari iter.");
  }

  return messages.slice(0, 3);
}

const PRIME_TONE_LABELS = {
  motive: "Motive edici",
  firm: "Sert",
  challenge: "Meydan okuyan",
};

const PRIME_COPY_BANK = {
  motive: {
    start: [
      "Prime: bugun bos degil, acilmamis durumda. Ilk blokla gunu calistir.",
      "Prime: cikisi yumusak ac. Ilk adimlar tum gunu degistirir.",
    ],
    catchup: [
      "Prime: ritim kuruldu. Bir blok daha hedefe tasir.",
      "Prime: momentum var. Simdi yuklenirsen gun temiz kapanir.",
    ],
    closed: [
      "Prime: gorev tamam. Bugunu guclu bir notla kapattin.",
      "Prime: bugunluk isi aldin. Bonus adimlar artik keyif alaninda.",
    ],
  },
  firm: {
    streak_risk: [
      "Prime: seri burada kirilir. Bugunun gorevini simdi kapat.",
      "Prime: erteleme payi bitti. Son blokla bugunu kurtar.",
    ],
    catchup: [
      "Prime: tablo ve hedef geride. Simdi net bir blok lazim.",
      "Prime: bugun dagildi. Kontrolu geri almak icin yuru.",
    ],
  },
  challenge: {
    leaderboard: [
      "Prime: bir basamak yukari alinabilir. Simdi ritmi sert ac.",
      "Prime: bugun tablo acik. Bu fark kapanir, yuklen.",
    ],
    finish: [
      "Prime: az kaldi. Hedefi kapat ve bugunu sen yaz.",
      "Prime: kapanisa girdin. Son hamleyle gunu al.",
    ],
  },
};

function buildPrimeTone({ dailyTask, streak, leaderboard, remainingSteps, now }) {
  if (streak?.protectionLevel === "critical" || (!dailyTask?.completed && now.getHours() >= 20)) {
    return "firm";
  }
  if ((safeNumber(leaderboard?.currentUser?.rank) > 1 && safeNumber(leaderboard?.gapToNext) <= 1500) || remainingSteps <= 1200) {
    return "challenge";
  }
  return "motive";
}

function buildPrimeMessage({ tone, dailyTask, todaySteps, remainingSteps, leaderboard, streak, dateKey }) {
  let context = "catchup";
  if (safeNumber(todaySteps) <= 0) {
    context = "start";
  } else if (dailyTask?.completed && remainingSteps <= 0) {
    context = "closed";
  } else if (tone === "firm" && streak?.protectionLevel === "critical") {
    context = "streak_risk";
  } else if (tone === "challenge" && safeNumber(leaderboard?.currentUser?.rank) > 1) {
    context = "leaderboard";
  } else if (tone === "challenge" && remainingSteps <= 1200) {
    context = "finish";
  }

  const options = PRIME_COPY_BANK[tone]?.[context] || PRIME_COPY_BANK.motive.catchup;
  return seededPick(options, `${dateKey}:${tone}:${context}:${safeNumber(todaySteps)}:${safeNumber(remainingSteps)}`);
}

function buildSocialChallenges({ dateKey, dailyTask, streak, now }) {
  const dailyStatus = dailyTask.completed ? "completed" : streak.protectionLevel === "critical" || now.getHours() >= 20 ? "at_risk" : "active";
  const sevenDayCompleted = safeNumber(streak.activeDays7) >= 7 || safeNumber(streak.days) >= 7;
  let sevenDayStatus = "active";
  if (sevenDayCompleted) {
    sevenDayStatus = "completed";
  } else if (safeNumber(streak.activeDays7) > 0 && safeNumber(streak.days) === 0) {
    sevenDayStatus = "failed";
  } else if (streak.protectionLevel === "critical") {
    sevenDayStatus = "at_risk";
  }

  return [
    {
      challengeId: `${dateKey}-daily-mission`,
      date: dateKey,
      type: "daily_mission",
      title: dailyTask.subtitle,
      targetValue: safeNumber(dailyTask.targetValue),
      progressValue: safeNumber(dailyTask.progressValue),
      completed: Boolean(dailyTask.completed),
      status: dailyStatus,
      badgeKey: "daily_closer",
      rewardLabel: "Gunluk kapatici",
      streakGuarded: Boolean(streak.days > 0),
    },
    {
      challengeId: `${dateKey}-seven-day`,
      date: dateKey,
      type: "seven_day",
      title: "7 Gun Hareket Challenge",
      targetValue: 7,
      progressValue: safeNumber(streak.activeDays7),
      completed: sevenDayCompleted,
      status: sevenDayStatus,
      badgeKey: "week_runner",
      rewardLabel: sevenDayCompleted ? "7 gun rozeti hazir" : "Haftalik seri acik",
      streakGuarded: true,
    },
  ];
}

export function buildStepMotivationModel({
  userId,
  todaySteps,
  stepHistory = [],
  goalSteps,
  walkSessionHistory = [],
  stepActiveCoach,
  streakSummary,
  now = new Date(),
  leaderboard = null,
}) {
  const dateKey = localDateKey(now);
  const todayStepCount = safeNumber(todaySteps?.stepCount);
  const remainingSteps = Math.max(safeNumber(goalSteps) - todayStepCount, 0);
  const streak = buildMovementStreak(stepHistory, walkSessionHistory, now);
  const sessionSummary = buildSessionSummary(walkSessionHistory, dateKey, now);
  const dailyTask = buildDailyTask({
    userId,
    dateKey,
    todaySteps: todayStepCount,
    goalSteps: safeNumber(goalSteps),
    walkSessionHistory,
  });
  const achievements = buildAchievements({
    stepHistory,
    todaySteps: todayStepCount,
    walkSessionHistory,
    streak,
  });
  const leaderboardModel = buildLeaderboardModel(leaderboard, userId);
  const primeTone = buildPrimeTone({
    dailyTask,
    streak,
    leaderboard: leaderboardModel,
    remainingSteps,
    now,
  });
  const fomoMessages = buildFomoMessages({
    streak,
    dailyTask,
    leaderboard: leaderboardModel,
    remainingSteps,
    now,
  });
  const primeMessage = buildPrimeMessage({
    tone: primeTone,
    dailyTask,
    todaySteps: todayStepCount,
    remainingSteps,
    leaderboard: leaderboardModel,
    streak,
    dateKey,
  });
  const socialChallenges = buildSocialChallenges({
    dateKey,
    dailyTask,
    streak,
    now,
  });

  return {
    dateKey,
    dailyTask,
    achievements,
    earnedAchievements: achievements.filter((item) => item.earned),
    streak: {
      ...streak,
      label: streak.days > 0 ? `${streak.days} gun aktif seri` : "Bugun yeni seri ac",
      statusText: streak.completedToday ? "Bugun seri korundu" : streak.protectionMessage,
      fallbackStatus: streakSummary?.statusText || "",
    },
    leaderboard: leaderboardModel,
    fomoMessages,
    primeTone,
    primeToneLabel: PRIME_TONE_LABELS[primeTone] || PRIME_TONE_LABELS.motive,
    primeMessage,
    sessionSummary,
    socialChallenges,
  };
}

export function buildStepEngagementSyncPayload(motivationModel) {
  if (!motivationModel?.dateKey || !motivationModel?.dailyTask || !motivationModel?.streak) {
    return null;
  }

  return {
    date: motivationModel.dateKey,
    daily_task: {
      type: motivationModel.dailyTask.type,
      title: motivationModel.dailyTask.subtitle,
      detail: motivationModel.dailyTask.detail,
      target_value: safeNumber(motivationModel.dailyTask.targetValue),
      progress_value: safeNumber(motivationModel.dailyTask.progressValue),
      completed: Boolean(motivationModel.dailyTask.completed),
    },
    achievements: (motivationModel.achievements || []).map((item) => ({
      key: item.key,
      title: item.title,
      detail: item.detail,
      earned: Boolean(item.earned),
      earned_at: item.earnedAt || null,
    })),
    streak: {
      current_days: safeNumber(motivationModel.streak.days),
      longest_days: safeNumber(motivationModel.streak.longestDays),
      completed_today: Boolean(motivationModel.streak.completedToday),
      protection_level: motivationModel.streak.protectionLevel || "safe",
      protection_message: motivationModel.streak.protectionMessage || "",
    },
    prime_tone: motivationModel.primeTone || "motive",
    prime_message: motivationModel.primeMessage || "",
    fomo_messages: motivationModel.fomoMessages || [],
    leaderboard_rank: safeNumber(motivationModel.leaderboard?.currentUser?.rank) || null,
    session_summary: {
      completed_today: safeNumber(motivationModel.sessionSummary?.completedToday),
      total_sessions_7d: safeNumber(motivationModel.sessionSummary?.totalSessions7d),
      latest_session_at: motivationModel.sessionSummary?.latestSessionAt || null,
    },
  };
}

export function buildSocialChallengeSyncPayloads(motivationModel) {
  return (motivationModel?.socialChallenges || []).map((item) => ({
    challenge_id: item.challengeId,
    date: item.date,
    type: item.type,
    title: item.title,
    target_value: safeNumber(item.targetValue),
    progress_value: safeNumber(item.progressValue),
    completed: Boolean(item.completed),
    status: item.status || "active",
    badge_key: item.badgeKey || null,
    reward_label: item.rewardLabel || null,
    streak_guarded: Boolean(item.streakGuarded),
  }));
}
