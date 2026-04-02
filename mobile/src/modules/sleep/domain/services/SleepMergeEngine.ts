import { SleepConfidence, type SleepSession } from "../models/SleepSession";
import { SleepSource } from "../models/SleepRawSegment";

const DUPLICATE_WINDOW_MINUTES = 90;

function minutesBetween(left: string, right: string) {
  return Math.abs(new Date(left).getTime() - new Date(right).getTime()) / 60000;
}

function areDuplicateSessions(left: SleepSession, right: SleepSession) {
  if (left.source !== right.source || left.sleepDay !== right.sleepDay) {
    return false;
  }
  return (
    minutesBetween(left.sessionStartAt, right.sessionStartAt) <= DUPLICATE_WINDOW_MINUTES &&
    minutesBetween(left.sessionEndAt, right.sessionEndAt) <= DUPLICATE_WINDOW_MINUTES
  );
}

function maxNullable(left?: number | null, right?: number | null) {
  if (left == null) {
    return right ?? null;
  }
  if (right == null) {
    return left;
  }
  return Math.max(left, right);
}

function mergeNotes(left?: string | null, right?: string | null) {
  const items = [left, right].map((item) => String(item || "").trim()).filter(Boolean);
  return items.length ? Array.from(new Set(items)).join(" | ") : null;
}

function mergeConfidence(left: SleepSession, right: SleepSession) {
  if ([left.confidenceLevel, right.confidenceLevel].includes(SleepConfidence.HIGH)) {
    return SleepConfidence.HIGH;
  }
  if ([left.confidenceLevel, right.confidenceLevel].includes(SleepConfidence.STANDARD)) {
    return SleepConfidence.STANDARD;
  }
  return SleepConfidence.LOW;
}

function mergeDuplicateSessionGroup(sessions: SleepSession[]) {
  const ordered = [...sessions].sort((left, right) => left.sessionStartAt.localeCompare(right.sessionStartAt));
  return ordered.reduce<SleepSession[]>((accumulator, session) => {
    const previous = accumulator[accumulator.length - 1];
    if (!previous || !areDuplicateSessions(previous, session)) {
      accumulator.push(session);
      return accumulator;
    }

    accumulator[accumulator.length - 1] = {
      ...previous,
      id: previous.id,
      rawSessionId: previous.rawSessionId,
      sessionStartAt: previous.sessionStartAt < session.sessionStartAt ? previous.sessionStartAt : session.sessionStartAt,
      sessionEndAt: previous.sessionEndAt > session.sessionEndAt ? previous.sessionEndAt : session.sessionEndAt,
      totalSleepMinutes: Math.max(previous.totalSleepMinutes, session.totalSleepMinutes),
      timeInBedMinutes: maxNullable(previous.timeInBedMinutes, session.timeInBedMinutes),
      awakeMinutes: maxNullable(previous.awakeMinutes, session.awakeMinutes),
      remMinutes: maxNullable(previous.remMinutes, session.remMinutes),
      coreMinutes: maxNullable(previous.coreMinutes, session.coreMinutes),
      deepMinutes: maxNullable(previous.deepMinutes, session.deepMinutes),
      awakeningsCount: maxNullable(previous.awakeningsCount, session.awakeningsCount),
      manualQualityScore: maxNullable(previous.manualQualityScore, session.manualQualityScore),
      notes: mergeNotes(previous.notes, session.notes),
      isStageDataAvailable: previous.isStageDataAvailable || session.isStageDataAvailable,
      confidenceLevel: mergeConfidence(previous, session),
      createdAt: previous.createdAt < session.createdAt ? previous.createdAt : session.createdAt,
      updatedAt: previous.updatedAt > session.updatedAt ? previous.updatedAt : session.updatedAt,
    };
    return accumulator;
  }, []);
}

function sortMergedSessions(sessions: SleepSession[]) {
  return [...sessions].sort((left, right) => {
    if (left.source !== right.source) {
      if (left.source === SleepSource.MANUAL) {
        return 1;
      }
      if (right.source === SleepSource.MANUAL) {
        return -1;
      }
    }
    if (right.totalSleepMinutes !== left.totalSleepMinutes) {
      return right.totalSleepMinutes - left.totalSleepMinutes;
    }
    return left.sessionStartAt.localeCompare(right.sessionStartAt);
  });
}

export function mergeSleepSessions(sessions: SleepSession[]) {
  const groupedByDay = new Map<string, SleepSession[]>();

  for (const session of sessions || []) {
    const existing = groupedByDay.get(session.sleepDay) || [];
    existing.push(session);
    groupedByDay.set(session.sleepDay, existing);
  }

  return new Map(
    Array.from(groupedByDay.entries()).map(([sleepDay, daySessions]) => {
      const groupedBySource = new Map<string, SleepSession[]>();
      for (const session of daySessions) {
        const existing = groupedBySource.get(session.source) || [];
        existing.push(session);
        groupedBySource.set(session.source, existing);
      }

      const merged = Array.from(groupedBySource.values())
        .flatMap((group) => mergeDuplicateSessionGroup(group))
        .filter((session) => session.totalSleepMinutes > 0);

      return [sleepDay, sortMergedSessions(merged)] as const;
    })
  );
}
