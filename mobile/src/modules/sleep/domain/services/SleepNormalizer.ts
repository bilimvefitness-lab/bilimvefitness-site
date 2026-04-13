import { SleepBedtimeTrend } from "../models/SleepDailySummary";
import { SleepRawSegment, SleepSegmentType, SleepSource } from "../models/SleepRawSegment";
import { SleepConfidence, SleepManualEntry, SleepSession } from "../models/SleepSession";
import { getLocalDateString } from "../../utils/sleepDay";

type HealthConnectStage = {
  startTime: string;
  endTime: string;
  stage: number;
};

type HealthConnectSleepRecord = {
  startTime: string;
  endTime: string;
  stages?: HealthConnectStage[];
  notes?: string;
  title?: string;
  metadata?: {
    id?: string;
    dataOrigin?: string;
    clientRecordId?: string | null;
  };
};

type HealthKitSleepSample = {
  id?: string;
  startDate: string;
  endDate: string;
  value: string;
  sourceId?: string;
  sourceName?: string;
};

const HEALTH_CONNECT_STAGE_MAP: Record<number, keyof typeof SleepSegmentType> = {
  0: "UNKNOWN",
  1: "AWAKE",
  2: "ASLEEP",
  3: "OUT_OF_BED",
  4: "CORE",
  5: "DEEP",
  6: "REM",
};

const HEALTH_KIT_VALUE_MAP: Record<string, keyof typeof SleepSegmentType> = {
  INBED: "IN_BED",
  ASLEEP: "ASLEEP",
  AWAKE: "AWAKE",
  REM: "REM",
  CORE: "CORE",
  DEEP: "DEEP",
  UNKNOWN: "UNKNOWN",
};

function nowIso() {
  return new Date().toISOString();
}

function minutesBetween(startAt: string, endAt: string) {
  return Math.max(Math.round((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000), 0);
}

function safeTimezone(value: string) {
  const matchedOffset = String(value || "").match(/([+-]\d{2}:?\d{2}|Z)$/);
  if (matchedOffset?.[1]) {
    return matchedOffset[1] === "Z" ? "+00:00" : matchedOffset[1].replace(/(\d{2})(\d{2})$/, "$1:$2");
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function sleepDayFromWakeTime(startAt: string, endAt: string): string;
function sleepDayFromWakeTime(endAt: string): string;
function sleepDayFromWakeTime(wakeTime: string): string {
  const date = new Date(wakeTime);
  if (Number.isNaN(date.getTime())) {
    return wakeTime.slice(0, 10);
  }
  return getLocalDateString(date);
}

function buildSessionId(source: string, rawSessionId: string, startAt: string, endAt: string) {
  return `${source}:${rawSessionId}:${startAt}:${endAt}`;
}

function mergeIntervals(segments: SleepRawSegment[]) {
  const ordered = [...segments].sort((left, right) => left.startAt.localeCompare(right.startAt));
  const merged: Array<{ startAt: string; endAt: string }> = [];

  for (const segment of ordered) {
    const last = merged[merged.length - 1];
    if (!last || segment.startAt > last.endAt) {
      merged.push({ startAt: segment.startAt, endAt: segment.endAt });
      continue;
    }
    if (segment.endAt > last.endAt) {
      last.endAt = segment.endAt;
    }
  }

  return merged.reduce((total, item) => total + minutesBetween(item.startAt, item.endAt), 0);
}

function countAwakenings(segments: SleepRawSegment[]) {
  const count = segments.filter((segment) => segment.segmentType === SleepSegmentType.AWAKE).length;
  return count || null;
}

function summarizeSegmentsToSession(
  source: typeof SleepSource[keyof typeof SleepSource],
  rawSessionId: string,
  segments: SleepRawSegment[],
  fallbackStartAt: string,
  fallbackEndAt: string,
  notes?: string | null
): SleepSession {
  const importedAt = nowIso();
  const ordered = [...segments].sort((left, right) => left.startAt.localeCompare(right.startAt));
  const sessionStartAt = ordered[0]?.startAt || fallbackStartAt;
  const sessionEndAt = ordered[ordered.length - 1]?.endAt || fallbackEndAt;
  const stageSegments = ordered.filter((segment) =>
    ([SleepSegmentType.REM, SleepSegmentType.CORE, SleepSegmentType.DEEP, SleepSegmentType.AWAKE] as SleepSegmentType[]).includes(segment.segmentType)
  );
  const asleepSegments = ordered.filter((segment) => segment.segmentType === SleepSegmentType.ASLEEP);
  const inBedSegments = ordered.filter((segment) => segment.segmentType === SleepSegmentType.IN_BED);
  const stageSleepSegments = stageSegments.filter((segment) => segment.segmentType !== SleepSegmentType.AWAKE);
  const totalSleepBase = stageSleepSegments.length ? stageSleepSegments : asleepSegments;

  const totalSleepMinutes = totalSleepBase.length
    ? mergeIntervals(totalSleepBase)
    : minutesBetween(sessionStartAt, sessionEndAt);

  const remMinutes = mergeIntervals(ordered.filter((segment) => segment.segmentType === SleepSegmentType.REM)) || null;
  const coreMinutes = mergeIntervals(ordered.filter((segment) => segment.segmentType === SleepSegmentType.CORE)) || null;
  const deepMinutes = mergeIntervals(ordered.filter((segment) => segment.segmentType === SleepSegmentType.DEEP)) || null;
  const awakeMinutes = mergeIntervals(ordered.filter((segment) => segment.segmentType === SleepSegmentType.AWAKE)) || null;
  const timeInBedMinutes = inBedSegments.length ? mergeIntervals(inBedSegments) : minutesBetween(sessionStartAt, sessionEndAt);
  const isStageDataAvailable = stageSegments.length > 0;

  return {
    id: buildSessionId(source, rawSessionId, sessionStartAt, sessionEndAt),
    source,
    rawSessionId,
    sessionStartAt,
    sessionEndAt,
    sleepDay: sleepDayFromWakeTime(sessionEndAt),
    totalSleepMinutes,
    timeInBedMinutes,
    awakeMinutes,
    remMinutes,
    coreMinutes,
    deepMinutes,
    awakeningsCount: countAwakenings(ordered),
    manualQualityScore: null,
    notes: notes || null,
    isStageDataAvailable,
    isManual: false,
    confidenceLevel: isStageDataAvailable ? SleepConfidence.HIGH : SleepConfidence.STANDARD,
    createdAt: importedAt,
    updatedAt: importedAt,
  };
}

export function normalizeHealthConnectRecords(records: HealthConnectSleepRecord[]) {
  const importedAt = nowIso();
  const rawSegments: SleepRawSegment[] = [];
  const sessions: SleepSession[] = [];

  for (const record of records || []) {
    const rawSessionId =
      record.metadata?.id ||
      record.metadata?.clientRecordId ||
      `${record.startTime}:${record.endTime}`;
    const timezone = safeTimezone(record.endTime || record.startTime);

    for (const stage of record.stages || []) {
      const stageKey = HEALTH_CONNECT_STAGE_MAP[stage.stage] || "UNKNOWN";
      rawSegments.push({
        id: `${rawSessionId}:${stage.startTime}:${stage.endTime}:${stage.stage}`,
        source: SleepSource.HEALTH_CONNECT,
        rawSourceId: rawSessionId,
        segmentType: SleepSegmentType[stageKey],
        startAt: stage.startTime,
        endAt: stage.endTime,
        timezone,
        metadataJson: JSON.stringify({
          stageCode: stage.stage,
          dataOrigin: record.metadata?.dataOrigin || null,
        }),
        importedAt,
      });
    }

    sessions.push(
      summarizeSegmentsToSession(
        SleepSource.HEALTH_CONNECT,
        rawSessionId,
        rawSegments.filter((segment) => segment.rawSourceId === rawSessionId),
        record.startTime,
        record.endTime,
        record.notes || record.title || null
      )
    );
  }

  return { rawSegments, sessions };
}

export function normalizeHealthKitSamples(samples: HealthKitSleepSample[]) {
  const importedAt = nowIso();
  const grouped = new Map<string, SleepRawSegment[]>();

  for (const sample of samples || []) {
    const rawSessionId = sample.id || `${sample.startDate}:${sample.endDate}:${sample.value}`;
    const segmentKey = HEALTH_KIT_VALUE_MAP[String(sample.value || "").toUpperCase()] || "UNKNOWN";
    const segment: SleepRawSegment = {
      id: `${rawSessionId}:${sample.startDate}:${sample.endDate}`,
      source: SleepSource.APPLE_HEALTH,
      rawSourceId: rawSessionId,
      segmentType: SleepSegmentType[segmentKey],
      startAt: sample.startDate,
      endAt: sample.endDate,
      timezone: safeTimezone(sample.endDate || sample.startDate),
      metadataJson: JSON.stringify({
        value: sample.value,
        sourceId: sample.sourceId || null,
        sourceName: sample.sourceName || null,
      }),
      importedAt,
    };
    const sessionGroupKey = `${sleepDayFromWakeTime(sample.endDate)}:${sample.sourceId || "healthkit"}`;
    const existing = grouped.get(sessionGroupKey) || [];
    existing.push(segment);
    grouped.set(sessionGroupKey, existing);
  }

  const rawSegments = Array.from(grouped.values()).flat();
  const sessions = Array.from(grouped.entries()).map(([groupKey, segments]) => {
    const ordered = [...segments].sort((left, right) => left.startAt.localeCompare(right.startAt));
    return summarizeSegmentsToSession(
      SleepSource.APPLE_HEALTH,
      groupKey,
      ordered,
      ordered[0]?.startAt || importedAt,
      ordered[ordered.length - 1]?.endAt || importedAt
    );
  });

  return { rawSegments, sessions };
}

export function normalizeManualEntryToSession(entry: SleepManualEntry): SleepSession {
  const totalSleepMinutes = minutesBetween(entry.bedtime, entry.wakeTime);
  return {
    id: `manual:${entry.id}`,
    source: SleepSource.MANUAL,
    rawSessionId: entry.id,
    sessionStartAt: entry.bedtime,
    sessionEndAt: entry.wakeTime,
    sleepDay: sleepDayFromWakeTime(entry.wakeTime),
    totalSleepMinutes,
    timeInBedMinutes: totalSleepMinutes,
    awakeMinutes: null,
    remMinutes: null,
    coreMinutes: null,
    deepMinutes: null,
    awakeningsCount: entry.awakeningsCount || null,
    manualQualityScore: entry.manualQualityScore || null,
    notes: entry.notes || null,
    isStageDataAvailable: false,
    isManual: true,
    confidenceLevel: SleepConfidence.LOW,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt,
  };
}

export function deriveBedtimeTrend(bedtimes: string[]) {
  const bedtimeMinutes = bedtimes
    .map((item) => {
      const parsed = new Date(item);
      if (Number.isNaN(parsed.getTime())) {
        return Number.NaN;
      }
      const minutes = parsed.getHours() * 60 + parsed.getMinutes();
      return parsed.getHours() < 12 ? minutes + 24 * 60 : minutes;
    })
    .filter((value) => Number.isFinite(value));

  if (bedtimeMinutes.length < 3) {
    return SleepBedtimeTrend.INSUFFICIENT_DATA;
  }

  const recent = bedtimeMinutes.slice(-3);
  const earlier = bedtimeMinutes.slice(0, -3);
  const recentAverage = recent.reduce((total, value) => total + value, 0) / recent.length;
  const earlierAverage = earlier.length
    ? earlier.reduce((total, value) => total + value, 0) / earlier.length
    : recent[0];

  if (recentAverage >= earlierAverage + 45) {
    return SleepBedtimeTrend.LATER;
  }
  if (recentAverage <= earlierAverage - 45) {
    return SleepBedtimeTrend.EARLIER;
  }
  return SleepBedtimeTrend.STABLE;
}
