/**
 * Posture Streak System
 *
 * Tracks daily posture task completion streaks.
 * Soft reset: a missed day halves the streak instead of zeroing it.
 *
 * Storage: single AsyncStorage key holding { count, lastDateKey }.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const STREAK_STORAGE_KEY = "posture_coaching_streak";

function localDateKey(dateValue = new Date()) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function daysBetween(dateKeyA, dateKeyB) {
  const a = new Date(`${dateKeyA}T12:00:00`).getTime();
  const b = new Date(`${dateKeyB}T12:00:00`).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
  return Math.round(Math.abs(a - b) / (24 * 60 * 60 * 1000));
}

function sanitizeStreak(raw) {
  if (!raw || typeof raw !== "object") {
    return { count: 0, lastDateKey: null };
  }
  return {
    count: Math.max(0, Number(raw.count) || 0),
    lastDateKey: raw.lastDateKey ? String(raw.lastDateKey).slice(0, 10) : null,
  };
}

export async function getPostureStreak() {
  try {
    const raw = await AsyncStorage.getItem(STREAK_STORAGE_KEY);
    if (!raw) return { count: 0, lastDateKey: null };
    return sanitizeStreak(JSON.parse(raw));
  } catch (_) {
    return { count: 0, lastDateKey: null };
  }
}

export async function recordStreakCompletion(now = Date.now()) {
  const todayKey = localDateKey(now);
  const current = await getPostureStreak();

  // Already recorded today
  if (current.lastDateKey === todayKey) {
    return current;
  }

  let nextCount;
  const gap = current.lastDateKey ? daysBetween(todayKey, current.lastDateKey) : Infinity;

  if (gap === 1) {
    // Consecutive day → increment
    nextCount = current.count + 1;
  } else if (gap === 2) {
    // One missed day → soft reset (keep half, but at least 1)
    nextCount = Math.max(1, Math.floor(current.count / 2)) + 1;
  } else if (gap <= 4) {
    // 2-3 missed days → softer reset
    nextCount = 1;
  } else {
    // Long gap → full reset
    nextCount = 1;
  }

  const next = { count: nextCount, lastDateKey: todayKey };

  try {
    await AsyncStorage.setItem(STREAK_STORAGE_KEY, JSON.stringify(next));
  } catch (_) {}

  return next;
}

export function resolveStreakMessage(streakCount) {
  if (streakCount >= 7) return "posture.coaching.streak.weekStrong";
  if (streakCount >= 5) return "posture.coaching.streak.consistent";
  if (streakCount >= 3) return "posture.coaching.streak.strong";
  if (streakCount >= 1) return "posture.coaching.streak.building";
  return null;
}

export function resolveStreakView(streak) {
  if (!streak || streak.count <= 0) {
    return null;
  }

  return {
    count: streak.count,
    messageKey: resolveStreakMessage(streak.count),
    isHot: streak.count >= 3,
  };
}
