import { SleepBedtimeTrend, SleepDailySummary } from "../models/SleepDailySummary";
import { SleepSession } from "../models/SleepSession";
import { deriveBedtimeTrend } from "./SleepNormalizer";

function averageMinutes(summaries: SleepDailySummary[]) {
  if (!summaries.length) {
    return null;
  }
  return Number(
    (summaries.reduce((total, item) => total + Number(item.totalSleepMinutes || 0), 0) / summaries.length).toFixed(1)
  );
}

function sortSessions(sessions: SleepSession[]) {
  return [...sessions].sort((left, right) => {
    if (right.totalSleepMinutes !== left.totalSleepMinutes) {
      return right.totalSleepMinutes - left.totalSleepMinutes;
    }
    return left.sessionStartAt.localeCompare(right.sessionStartAt);
  });
}

export function buildSleepDailySummaries(groupedSessions: Map<string, SleepSession[]>) {
  const summaries = Array.from(groupedSessions.entries())
    .sort(([leftDay], [rightDay]) => leftDay.localeCompare(rightDay))
    .map(([sleepDay, sessions]) => {
      const ordered = sortSessions(sessions);
      const healthPrimary = ordered.find((session) => !session.isManual);
      const primary = healthPrimary || ordered[0];
      const manualSecondary = ordered.find((session) => session.isManual);

      return {
        sleepDay,
        primarySource: primary.source,
        bedtime: primary.sessionStartAt,
        wakeTime: primary.sessionEndAt,
        totalSleepMinutes: primary.totalSleepMinutes,
        timeInBedMinutes: primary.timeInBedMinutes ?? null,
        awakeMinutes: primary.awakeMinutes ?? null,
        remMinutes: primary.remMinutes ?? null,
        coreMinutes: primary.coreMinutes ?? null,
        deepMinutes: primary.deepMinutes ?? null,
        awakeningsCount: primary.awakeningsCount ?? manualSecondary?.awakeningsCount ?? null,
        manualQualityScore: primary.manualQualityScore ?? manualSecondary?.manualQualityScore ?? null,
        trend3dAverage: null,
        trend7dAverage: null,
        bedtimeTrend: SleepBedtimeTrend.INSUFFICIENT_DATA,
        lastSyncedAt: new Date().toISOString(),
        isStageDataAvailable: primary.isStageDataAvailable,
        isManual: primary.isManual,
        confidenceLevel: primary.confidenceLevel,
      } as SleepDailySummary;
    });

  return summaries.map((summary, index, items) => {
    const recent3 = items.slice(Math.max(0, index - 2), index + 1);
    const recent7 = items.slice(Math.max(0, index - 6), index + 1);
    return {
      ...summary,
      trend3dAverage: averageMinutes(recent3),
      trend7dAverage: averageMinutes(recent7),
      bedtimeTrend: deriveBedtimeTrend(recent7.map((item) => item.bedtime)),
    };
  });
}
