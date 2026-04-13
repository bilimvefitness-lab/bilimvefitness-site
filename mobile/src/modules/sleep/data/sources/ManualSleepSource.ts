import { normalizeManualEntryToSession } from "../../domain/services/SleepNormalizer";
import type { SleepManualEntry } from "../../domain/models/SleepSession";
import { SleepStorage } from "../storage/SleepStorage";
import { buildSleepDayRange } from "../storage/SleepQueries";

export type SaveManualSleepInput = {
  bedtime: string;
  wakeTime: string;
  awakeningsCount?: number | null;
  manualQualityScore?: number | null;
  notes?: string | null;
  timezone?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function inferTimezone(value?: string | null) {
  const normalized = String(value || "").trim();
  if (normalized) {
    return normalized;
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function validateEntry(input: SaveManualSleepInput) {
  const bedtime = new Date(input.bedtime);
  const wakeTime = new Date(input.wakeTime);
  if (Number.isNaN(bedtime.getTime()) || Number.isNaN(wakeTime.getTime())) {
    throw new Error("INVALID_DATETIME");
  }
  if (wakeTime <= bedtime) {
    throw new Error("WAKE_BEFORE_BEDTIME");
  }

  const durationMinutes = Math.round((wakeTime.getTime() - bedtime.getTime()) / 60000);
  if (durationMinutes < 30) {
    throw new Error("DURATION_TOO_SHORT");
  }
  if (durationMinutes > 20 * 60) {
    throw new Error("DURATION_TOO_LONG");
  }

  if (
    input.manualQualityScore != null &&
    (Number(input.manualQualityScore) < 1 || Number(input.manualQualityScore) > 5)
  ) {
    throw new Error("QUALITY_OUT_OF_RANGE");
  }
}

export class ManualSleepSource {
  constructor(private readonly storage = new SleepStorage()) {}

  async saveEntry(input: SaveManualSleepInput) {
    validateEntry(input);
    const timestamp = nowIso();
    const entry: SleepManualEntry = {
      id: `manual-${timestamp}-${Math.random().toString(36).slice(2, 8)}`,
      bedtime: new Date(input.bedtime).toISOString(),
      wakeTime: new Date(input.wakeTime).toISOString(),
      awakeningsCount: input.awakeningsCount != null ? Math.max(Number(input.awakeningsCount), 0) : null,
      manualQualityScore:
        input.manualQualityScore != null ? Math.min(Math.max(Number(input.manualQualityScore), 1), 5) : null,
      notes: String(input.notes || "").trim() || null,
      timezone: inferTimezone(input.timezone),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await this.storage.saveManualEntry(entry);
    return normalizeManualEntryToSession(entry);
  }

  async listEntries(days = 30, referenceDay?: string | null) {
    const range = buildSleepDayRange(days, referenceDay);
    return this.storage.getManualEntriesInRange(range.startDay, range.endDay);
  }

  async listSessions(days = 30, referenceDay?: string | null) {
    const entries = await this.listEntries(days, referenceDay);
    return entries.map((entry) => normalizeManualEntryToSession(entry));
  }
}
