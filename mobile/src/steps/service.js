import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiRequest } from "../api";
import { createStepError, stepInfo, stepWarn } from "./debug";
import { buildStepInsight } from "./insights";
import { createStepProvider } from "./provider";

const MANUAL_STEP_STORAGE_KEY = "fitness-notebook-mobile-manual-steps";
const STEP_SYNC_META_STORAGE_KEY = "fitness-notebook-mobile-step-sync-meta";

function buildDateKeys(count) {
  const dates = [];
  const today = new Date();
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const current = new Date(today);
    current.setHours(12, 0, 0, 0);
    current.setDate(today.getDate() - offset);
    dates.push(current.toISOString().slice(0, 10));
  }
  return dates;
}

function emptyStepRecord(dateKey) {
  return {
    date: dateKey,
    stepCount: 0,
    source: "unknown",
    available: false,
  };
}

function normalizeStepRecord(record) {
  if (!record) {
    return null;
  }
  return {
    date: record.date,
    stepCount: Math.max(Number(record.stepCount || record.step_count || 0), 0),
    source: record.source || "unknown",
    available: record.available !== false,
  };
}

async function readManualSteps() {
  const rawValue = await AsyncStorage.getItem(MANUAL_STEP_STORAGE_KEY);
  if (!rawValue) {
    return {};
  }

  try {
    const parsed = JSON.parse(rawValue);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeManualSteps(records) {
  await AsyncStorage.setItem(MANUAL_STEP_STORAGE_KEY, JSON.stringify(records));
}

async function readSyncMeta() {
  const rawValue = await AsyncStorage.getItem(STEP_SYNC_META_STORAGE_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

async function writeSyncMeta(value) {
  await AsyncStorage.setItem(STEP_SYNC_META_STORAGE_KEY, JSON.stringify(value));
}

function mergeStepRecords(autoRecords, manualRecords, dateKeys) {
  const autoMap = new Map((autoRecords || []).map((item) => [item.date, normalizeStepRecord(item)]));
  const manualMap = new Map(
    Object.entries(manualRecords || {}).map(([dateKey, item]) => [
      dateKey,
      {
        date: dateKey,
        stepCount: Math.max(Number(item?.stepCount || 0), 0),
        source: "manual",
        available: true,
      },
    ])
  );

  return dateKeys.map((dateKey) => {
    if (autoMap.has(dateKey)) {
      return autoMap.get(dateKey);
    }
    if (manualMap.has(dateKey)) {
      return manualMap.get(dateKey);
    }
    return emptyStepRecord(dateKey);
  });
}

export async function getStepPermissionState() {
  const provider = createStepProvider();
  return provider.getPermissionState();
}

export async function requestStepPermission() {
  const provider = createStepProvider();
  return provider.requestPermission();
}

export async function openStepPermissionSettings() {
  const provider = createStepProvider();
  return provider.openSettings();
}

export async function loadStepDashboardData() {
  const provider = createStepProvider();
  const permission = await provider.getPermissionState();
  const manualRecords = await readManualSteps();
  let error = null;
  let automaticRecords = [];
  let hourly = [];

  if (permission.status === "granted") {
    try {
      automaticRecords = await provider.getLast7DaysSteps();
    } catch (providerError) {
      error = providerError;
      stepWarn("step_auto_fetch_failed", {
        provider: permission.provider,
        permissionStatus: permission.status,
        lastErrorCode: providerError?.code || "step_auto_fetch_failed",
        lastErrorMessage: providerError?.message || "Adım verisi alınamadı.",
      });
    }
  }

  const dateKeys = buildDateKeys(7);
  const records = mergeStepRecords(automaticRecords, manualRecords, dateKeys);
  const lastSync = await readSyncMeta();

  return {
    permission,
    records,
    today: records[records.length - 1] || emptyStepRecord(dateKeys[dateKeys.length - 1]),
    yesterday: records[records.length - 2] || emptyStepRecord(dateKeys[dateKeys.length - 2]),
    error,
    lastSync,
  };
}

export async function getTodaySteps() {
  const provider = createStepProvider();
  const permission = await provider.getPermissionState();
  const manualRecords = await readManualSteps();
  const todayKey = buildDateKeys(1)[0];

  if (permission.status === "granted") {
    try {
      return normalizeStepRecord(await provider.getDaySteps(todayKey));
    } catch (providerError) {
      stepWarn("step_today_fetch_failed", {
        provider: permission.provider,
        permissionStatus: permission.status,
        lastErrorCode: providerError?.code || "step_today_fetch_failed",
        lastErrorMessage: providerError?.message || "Bugun adim verisi alinamadi.",
      });
    }
  }

  if (manualRecords?.[todayKey]) {
    return {
      date: todayKey,
      stepCount: Math.max(Number(manualRecords[todayKey]?.stepCount || 0), 0),
      source: "manual",
      available: true,
    };
  }

  return emptyStepRecord(todayKey);
}

export async function getYesterdaySteps() {
  const provider = createStepProvider();
  const permission = await provider.getPermissionState();
  const manualRecords = await readManualSteps();
  const dateKeys = buildDateKeys(2);
  const yesterdayKey = dateKeys[0];

  if (permission.status === "granted") {
    try {
      return normalizeStepRecord(await provider.getDaySteps(yesterdayKey));
    } catch (providerError) {
      stepWarn("step_yesterday_fetch_failed", {
        provider: permission.provider,
        permissionStatus: permission.status,
        lastErrorCode: providerError?.code || "step_yesterday_fetch_failed",
        lastErrorMessage: providerError?.message || "Dun adim verisi alinamadi.",
      });
    }
  }

  if (manualRecords?.[yesterdayKey]) {
    return {
      date: yesterdayKey,
      stepCount: Math.max(Number(manualRecords[yesterdayKey]?.stepCount || 0), 0),
      source: "manual",
      available: true,
    };
  }

  return emptyStepRecord(yesterdayKey);
}

export async function getLast7DaysSteps() {
  const dashboard = await loadStepDashboardData();
  return dashboard.records;
}

export async function saveManualSteps(dateKey, stepCount, note = "") {
  const normalizedStepCount = Number(stepCount);
  if (!dateKey || Number.isNaN(normalizedStepCount) || normalizedStepCount < 0) {
    throw createStepError("step_manual_invalid", "Manuel adım girişi geçersiz.");
  }

  const manualRecords = await readManualSteps();
  manualRecords[dateKey] = {
    stepCount: Math.round(normalizedStepCount),
    note: String(note || "").trim(),
    savedAt: new Date().toISOString(),
  };
  await writeManualSteps(manualRecords);
  stepInfo("manual_steps_saved", {
    provider: "manual",
    permissionStatus: "manual",
  });
  return {
    date: dateKey,
    stepCount: Math.round(normalizedStepCount),
    source: "manual",
    available: true,
  };
}

export async function syncStepsToBackend(userId) {
  if (!userId) {
    throw createStepError("step_sync_missing_user", "Adım verisini senkronize etmek için kullanıcı kimliği gerekli.");
  }

  const dashboard = await loadStepDashboardData();
  const syncableRecords = (dashboard.records || []).filter((item) => item?.available).map((item) => ({
    date: item.date,
    step_count: Math.round(Number(item.stepCount || 0)),
    source: item.source || "unknown",
    last_synced_at: new Date().toISOString(),
  }));

  if (!syncableRecords.length) {
    throw createStepError("step_no_data", "Senkronize edilecek adım verisi bulunamadı.");
  }

  const response = await apiRequest("/steps/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      records: syncableRecords,
    }),
  });

  const syncMeta = {
    syncedAt: new Date().toISOString(),
    count: syncableRecords.length,
  };
  await writeSyncMeta(syncMeta);
  stepInfo("steps_synced", {
    provider: dashboard.permission?.provider || null,
    permissionStatus: dashboard.permission?.status || null,
    lastSyncAt: syncMeta.syncedAt,
  });

  return {
    ...response,
    syncedAt: syncMeta.syncedAt,
    count: syncableRecords.length,
  };
}

export async function syncStepEngagementToBackend(userId, snapshot) {
  if (!userId) {
    throw createStepError("step_engagement_missing_user", "Motivasyon verisini yazmak icin kullanici kimligi gerekli.");
  }

  if (!snapshot?.date || !snapshot?.daily_task || !snapshot?.streak) {
    throw createStepError("step_engagement_invalid", "Motivasyon anlik goruntusu eksik.");
  }

  return apiRequest("/steps/engagement/sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      user_id: userId,
      snapshot,
    }),
  });
}

export async function getDailyStepLeaderboard(userId, dateKey, limit = 5) {
  if (!userId) {
    throw createStepError("step_leaderboard_missing_user", "Gunluk leaderboard icin kullanici kimligi gerekli.");
  }

  const params = new URLSearchParams({
    user_id: userId,
    date: String(dateKey || buildDateKeys(1)[0]),
    limit: String(Math.max(Number(limit || 5), 1)),
  });

  return apiRequest(`/steps/leaderboard/daily?${params.toString()}`);
}

export async function getLastStepSyncMeta() {
  return readSyncMeta();
}

export function buildLocalStepInsight(record, history, options = {}) {
  return buildStepInsight(record, history, options);
}
