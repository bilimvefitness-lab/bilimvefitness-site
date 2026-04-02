import AsyncStorage from "@react-native-async-storage/async-storage";

import { stepWarn } from "./debug";
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

export async function loadActiveStepDashboardData() {
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
        lastErrorMessage: providerError?.message || "Adim verisi alinamadi.",
      });
    }

    try {
      hourly = await provider.getHourlySteps(buildDateKeys(1)[0]);
    } catch (providerError) {
      stepWarn("step_hourly_fetch_failed", {
        provider: permission.provider,
        permissionStatus: permission.status,
        lastErrorCode: providerError?.code || "step_hourly_fetch_failed",
        lastErrorMessage: providerError?.message || "Saatlik adim dagilimi alinamadi.",
      });
    }
  }

  const dateKeys = buildDateKeys(7);
  const records = mergeStepRecords(automaticRecords, manualRecords, dateKeys);
  const lastSync = await readSyncMeta();

  return {
    permission,
    records,
    hourly,
    today: records[records.length - 1] || emptyStepRecord(dateKeys[dateKeys.length - 1]),
    yesterday: records[records.length - 2] || emptyStepRecord(dateKeys[dateKeys.length - 2]),
    error,
    lastSync,
  };
}
