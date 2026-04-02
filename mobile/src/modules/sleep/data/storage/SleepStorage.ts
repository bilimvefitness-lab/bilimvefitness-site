import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SleepDailySummary } from "../../domain/models/SleepDailySummary";
import type { SleepRawSegment, SleepSourceType } from "../../domain/models/SleepRawSegment";
import type { SleepManualEntry, SleepSession } from "../../domain/models/SleepSession";
import { dayFromIso, isSleepDayInRange } from "./SleepQueries";

const RAW_SEGMENTS_STORAGE_KEY = "fitness-notebook-mobile-sleep-raw-segments";
const SESSIONS_STORAGE_KEY = "fitness-notebook-mobile-sleep-sessions";
const SUMMARIES_STORAGE_KEY = "fitness-notebook-mobile-sleep-daily-summaries";
const MANUAL_ENTRIES_STORAGE_KEY = "fitness-notebook-mobile-sleep-manual-entries";
const SYNC_META_STORAGE_KEY = "fitness-notebook-mobile-sleep-sync-meta";

type TableRecord<T> = Record<string, T>;

export type SleepSyncMeta = {
  lastSuccessfulSyncAt: string | null;
  lastAttemptedSyncAt: string | null;
  backendSyncedAt: string | null;
  lastSource: SleepSourceType | null;
  lastWindowDays: number | null;
  lastStatus: string | null;
  lastErrorCode: string | null;
};

const DEFAULT_SYNC_META: SleepSyncMeta = {
  lastSuccessfulSyncAt: null,
  lastAttemptedSyncAt: null,
  backendSyncedAt: null,
  lastSource: null,
  lastWindowDays: null,
  lastStatus: null,
  lastErrorCode: null,
};

async function readTable<T>(storageKey: string): Promise<TableRecord<T>> {
  const rawValue = await AsyncStorage.getItem(storageKey);
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

async function writeTable<T>(storageKey: string, value: TableRecord<T>) {
  await AsyncStorage.setItem(storageKey, JSON.stringify(value));
}

function sortBySleepDay<T extends { sleepDay: string }>(items: T[]) {
  return [...items].sort((left, right) => left.sleepDay.localeCompare(right.sleepDay));
}

export class SleepStorage {
  async getRawSegments() {
    return Object.values(await readTable<SleepRawSegment>(RAW_SEGMENTS_STORAGE_KEY));
  }

  async replaceSourceRawSegmentsInRange(
    source: SleepSourceType,
    startDay: string,
    endDay: string,
    segments: SleepRawSegment[]
  ) {
    const table = await readTable<SleepRawSegment>(RAW_SEGMENTS_STORAGE_KEY);
    for (const [segmentId, segment] of Object.entries(table)) {
      const sleepDay = dayFromIso(segment.endAt) || dayFromIso(segment.startAt);
      if (segment.source === source && isSleepDayInRange(sleepDay, startDay, endDay)) {
        delete table[segmentId];
      }
    }
    for (const segment of segments || []) {
      table[segment.id] = segment;
    }
    await writeTable(RAW_SEGMENTS_STORAGE_KEY, table);
    return Object.values(table);
  }

  async getSessions() {
    return sortBySleepDay(Object.values(await readTable<SleepSession>(SESSIONS_STORAGE_KEY)));
  }

  async getSessionsInRange(startDay: string, endDay: string) {
    const sessions = await this.getSessions();
    return sessions.filter((session) => isSleepDayInRange(session.sleepDay, startDay, endDay));
  }

  async replaceSourceSessionsInRange(
    source: SleepSourceType,
    startDay: string,
    endDay: string,
    sessions: SleepSession[]
  ) {
    const table = await readTable<SleepSession>(SESSIONS_STORAGE_KEY);
    for (const [sessionId, session] of Object.entries(table)) {
      if (session.source === source && isSleepDayInRange(session.sleepDay, startDay, endDay)) {
        delete table[sessionId];
      }
    }
    for (const session of sessions || []) {
      table[session.id] = session;
    }
    await writeTable(SESSIONS_STORAGE_KEY, table);
    return sortBySleepDay(Object.values(table));
  }

  async getDailySummaries() {
    return sortBySleepDay(Object.values(await readTable<SleepDailySummary>(SUMMARIES_STORAGE_KEY)));
  }

  async getDailySummariesInRange(startDay: string, endDay: string) {
    const summaries = await this.getDailySummaries();
    return summaries.filter((summary) => isSleepDayInRange(summary.sleepDay, startDay, endDay));
  }

  async replaceDailySummariesInRange(startDay: string, endDay: string, summaries: SleepDailySummary[]) {
    const table = await readTable<SleepDailySummary>(SUMMARIES_STORAGE_KEY);
    for (const [sleepDay] of Object.entries(table)) {
      if (isSleepDayInRange(sleepDay, startDay, endDay)) {
        delete table[sleepDay];
      }
    }
    for (const summary of summaries || []) {
      table[summary.sleepDay] = summary;
    }
    await writeTable(SUMMARIES_STORAGE_KEY, table);
    return sortBySleepDay(Object.values(table));
  }

  async getManualEntries() {
    return Object.values(await readTable<SleepManualEntry>(MANUAL_ENTRIES_STORAGE_KEY)).sort((left, right) =>
      left.wakeTime.localeCompare(right.wakeTime)
    );
  }

  async getManualEntriesInRange(startDay: string, endDay: string) {
    const entries = await this.getManualEntries();
    return entries.filter((entry) => isSleepDayInRange(dayFromIso(entry.wakeTime), startDay, endDay));
  }

  async saveManualEntry(entry: SleepManualEntry) {
    const table = await readTable<SleepManualEntry>(MANUAL_ENTRIES_STORAGE_KEY);
    table[entry.id] = entry;
    await writeTable(MANUAL_ENTRIES_STORAGE_KEY, table);
    return entry;
  }

  async deleteManualEntry(entryId: string) {
    const table = await readTable<SleepManualEntry>(MANUAL_ENTRIES_STORAGE_KEY);
    delete table[entryId];
    await writeTable(MANUAL_ENTRIES_STORAGE_KEY, table);
  }

  async getSyncMeta() {
    const rawValue = await AsyncStorage.getItem(SYNC_META_STORAGE_KEY);
    if (!rawValue) {
      return DEFAULT_SYNC_META;
    }

    try {
      return { ...DEFAULT_SYNC_META, ...JSON.parse(rawValue) } as SleepSyncMeta;
    } catch {
      return DEFAULT_SYNC_META;
    }
  }

  async saveSyncMeta(meta: Partial<SleepSyncMeta>) {
    const current = await this.getSyncMeta();
    const nextValue = { ...current, ...meta };
    await AsyncStorage.setItem(SYNC_META_STORAGE_KEY, JSON.stringify(nextValue));
    return nextValue;
  }
}
