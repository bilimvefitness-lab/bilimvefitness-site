import type { SleepDailySummary } from "../../domain/models/SleepDailySummary";
import type { SleepSession } from "../../domain/models/SleepSession";
import { getLocalDateString, parseToLocalDay } from "../../utils/sleepDay";

export type SleepDayRange = {
  referenceDay: string;
  startDay: string;
  endDay: string;
  startAt: string;
  endAt: string;
};

function normalizeReferenceDate(referenceDay?: string | null) {
  if (referenceDay) {
    return new Date(`${referenceDay}T12:00:00`);
  }
  const resolved = new Date();
  resolved.setHours(12, 0, 0, 0);
  return resolved;
}

export function dayFromIso(value?: string | null) {
  return parseToLocalDay(value);
}

export function buildSleepDayRange(days = 14, referenceDay?: string | null): SleepDayRange {
  const safeDays = Math.max(Math.round(Number(days || 14)), 1);
  const endDate = normalizeReferenceDate(referenceDay);
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - (safeDays - 1));
  startDate.setHours(0, 0, 0, 0);

  const inclusiveEndDate = new Date(endDate);
  inclusiveEndDate.setHours(23, 59, 59, 999);

  return {
    referenceDay: getLocalDateString(endDate),          // LOCAL date
    startDay: getLocalDateString(startDate),            // LOCAL date
    endDay: getLocalDateString(inclusiveEndDate),        // LOCAL date
    startAt: startDate.toISOString(),                   // UTC ISO for health-source queries
    endAt: inclusiveEndDate.toISOString(),              // UTC ISO for health-source queries
  };
}

export function isSleepDayInRange(sleepDay: string | null | undefined, startDay: string, endDay: string) {
  if (!sleepDay) {
    return false;
  }
  return sleepDay >= startDay && sleepDay <= endDay;
}

export function filterSessionsByRange(sessions: SleepSession[], startDay: string, endDay: string) {
  return (sessions || []).filter((session) => isSleepDayInRange(session.sleepDay, startDay, endDay));
}

export function filterSummariesByRange(summaries: SleepDailySummary[], startDay: string, endDay: string) {
  return (summaries || []).filter((summary) => isSleepDayInRange(summary.sleepDay, startDay, endDay));
}

export function groupSessionsBySleepDay(sessions: SleepSession[]) {
  const grouped = new Map<string, SleepSession[]>();

  for (const session of sessions || []) {
    const existing = grouped.get(session.sleepDay) || [];
    existing.push(session);
    grouped.set(session.sleepDay, existing);
  }

  return grouped;
}

export function pickSummaryForDay(summaries: SleepDailySummary[], sleepDay?: string | null) {
  if (!summaries.length) {
    return null;
  }
  if (sleepDay) {
    return summaries.find((item) => item.sleepDay === sleepDay) || null;
  }
  return [...summaries].sort((left, right) => right.sleepDay.localeCompare(left.sleepDay))[0] || null;
}
