import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  buildWalkSessionPrimeMessage,
  buildWalkSessionSummary,
  createIdleWalkSession,
} from "./walkSession";

const ACTIVE_WALK_SESSION_KEY_PREFIX = "fitness-notebook-mobile-walk-session-active";
const WALK_SESSION_HISTORY_KEY_PREFIX = "fitness-notebook-mobile-walk-session-history";
const MAX_HISTORY_ITEMS = 40;
const STALE_SESSION_HOURS = 8;

function safeNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function buildActiveSessionKey(userId) {
  return `${ACTIVE_WALK_SESSION_KEY_PREFIX}-${userId || "guest"}`;
}

function buildHistoryKey(userId) {
  return `${WALK_SESSION_HISTORY_KEY_PREFIX}-${userId || "guest"}`;
}

function normalizeSession(value) {
  if (!value || typeof value !== "object") {
    return createIdleWalkSession();
  }

  return {
    ...createIdleWalkSession(),
    ...value,
    presetMinutes: Math.max(safeNumber(value.presetMinutes) || 10, 1),
    baselineSteps: Math.max(safeNumber(value.baselineSteps), 0),
    liveSteps: Math.max(safeNumber(value.liveSteps), 0),
    sessionSteps: Math.max(safeNumber(value.sessionSteps), 0),
    elapsedSeconds: Math.max(Math.floor(safeNumber(value.elapsedSeconds)), 0),
    firedTriggers: Array.isArray(value.firedTriggers) ? value.firedTriggers : [],
  };
}

function normalizeHistoryItem(item) {
  if (!item || typeof item !== "object") {
    return null;
  }

  return {
    id: String(item.id || `${item.date || new Date().toISOString()}-${item.startedAt || "session"}`),
    date: String(item.date || new Date().toISOString().slice(0, 10)),
    startedAt: item.startedAt || null,
    durationSeconds: Math.max(Math.floor(safeNumber(item.durationSeconds)), 0),
    sessionSteps: Math.max(Math.floor(safeNumber(item.sessionSteps)), 0),
    contributionPercent: Number((safeNumber(item.contributionPercent) || 0).toFixed(1)),
    completed: item.completed !== false,
    cancelled: Boolean(item.cancelled),
    paceLabel: item.paceLabel || "",
    todayRank: item.todayRank ?? null,
    feedback: item.feedback || "",
    totalSteps: Math.max(Math.floor(safeNumber(item.totalSteps)), 0),
  };
}

export async function persistActiveWalkSession(userId, session) {
  if (!userId) {
    return;
  }

  if (!session || session.status !== "active") {
    await AsyncStorage.removeItem(buildActiveSessionKey(userId));
    return;
  }

  await AsyncStorage.setItem(buildActiveSessionKey(userId), JSON.stringify(normalizeSession(session)));
}

export async function clearPersistedActiveWalkSession(userId) {
  if (!userId) {
    return;
  }
  await AsyncStorage.removeItem(buildActiveSessionKey(userId));
}

export async function restoreActiveWalkSession(userId, options = {}) {
  if (!userId) {
    return null;
  }

  const rawValue = await AsyncStorage.getItem(buildActiveSessionKey(userId));
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = normalizeSession(JSON.parse(rawValue));
    if (parsed.status !== "active" || !parsed.startedAt) {
      return null;
    }

    const now = options.now ? new Date(options.now) : new Date();
    const startedAt = new Date(parsed.startedAt);
    if (Number.isNaN(startedAt.getTime())) {
      return null;
    }

    const ageHours = (now.getTime() - startedAt.getTime()) / 3600000;
    if (ageHours >= STALE_SESSION_HOURS) {
      return {
        session: null,
        stale: true,
        staleRecord: normalizeHistoryItem({
          id: `${parsed.startedAt}-stale`,
          date: String(parsed.startedAt).slice(0, 10),
          startedAt: parsed.startedAt,
          durationSeconds: parsed.elapsedSeconds,
          sessionSteps: parsed.sessionSteps,
          contributionPercent: 0,
          completed: false,
          cancelled: true,
          paceLabel: "",
          todayRank: null,
          feedback: "Uzun sure yarim kalan session kapatildi.",
          totalSteps: parsed.liveSteps,
        }),
      };
    }

    const liveSteps = Math.max(safeNumber(options.liveSteps), safeNumber(parsed.liveSteps), safeNumber(parsed.baselineSteps));
    const sessionSteps = Math.max(liveSteps - safeNumber(parsed.baselineSteps), safeNumber(parsed.sessionSteps));
    const elapsedSeconds = Math.max(
      Math.floor((now.getTime() - startedAt.getTime()) / 1000),
      safeNumber(parsed.elapsedSeconds)
    );

    return {
      session: {
        ...parsed,
        liveSteps,
        sessionSteps,
        elapsedSeconds,
        targetReached: elapsedSeconds >= parsed.presetMinutes * 60,
        primeMessage: buildWalkSessionPrimeMessage({
          elapsedSeconds,
          sessionSteps,
          presetMinutes: parsed.presetMinutes,
        }),
      },
      stale: false,
      staleRecord: null,
    };
  } catch {
    return null;
  }
}

export async function loadWalkSessionHistory(userId) {
  if (!userId) {
    return [];
  }

  const rawValue = await AsyncStorage.getItem(buildHistoryKey(userId));
  if (!rawValue) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map(normalizeHistoryItem).filter(Boolean);
  } catch {
    return [];
  }
}

export async function persistWalkSessionHistory(userId, history) {
  if (!userId) {
    return;
  }

  await AsyncStorage.setItem(
    buildHistoryKey(userId),
    JSON.stringify((history || []).map(normalizeHistoryItem).filter(Boolean).slice(0, MAX_HISTORY_ITEMS))
  );
}

export function buildWalkSessionHistoryEntry(summary, options = {}) {
  const normalizedSummary = buildWalkSessionSummary({
    durationSeconds: summary?.durationSeconds,
    sessionSteps: summary?.sessionSteps,
    baselineSteps: 0,
    totalSteps: summary?.totalSteps,
    goalSteps: options.goalSteps,
    todayRank: summary?.todayRank,
  });

  return normalizeHistoryItem({
    id: `${options.startedAt || new Date().toISOString()}-${options.completed ? "done" : "cancelled"}`,
    date: options.date || new Date().toISOString().slice(0, 10),
    startedAt: options.startedAt || null,
    durationSeconds: normalizedSummary.durationSeconds,
    sessionSteps: normalizedSummary.sessionSteps,
    contributionPercent: normalizedSummary.contributionPercent,
    completed: options.completed !== false,
    cancelled: Boolean(options.cancelled),
    paceLabel: normalizedSummary.paceLabel,
    todayRank: normalizedSummary.todayRank,
    feedback: normalizedSummary.feedback,
    totalSteps: normalizedSummary.totalSteps,
  });
}

export function buildWalkSessionHistorySummary(history = [], dateKey) {
  const sameDayHistory = (history || []).filter((item) => item?.date === dateKey);
  const sorted = [...sameDayHistory].sort((left, right) => safeNumber(right?.sessionSteps) - safeNumber(left?.sessionSteps));

  return {
    sameDayHistory,
    nextRank(stepCount) {
      return sorted.filter((item) => safeNumber(item?.sessionSteps) > safeNumber(stepCount)).length + 1;
    },
  };
}

export async function appendWalkSessionHistory(userId, entry) {
  const history = await loadWalkSessionHistory(userId);
  const nextHistory = [normalizeHistoryItem(entry), ...history].filter(Boolean).slice(0, MAX_HISTORY_ITEMS);
  await persistWalkSessionHistory(userId, nextHistory);
  return nextHistory;
}
