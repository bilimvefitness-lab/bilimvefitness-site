import type { SleepDailySummary } from "../models/SleepDailySummary";
import type { SleepSourceType } from "../models/SleepRawSegment";
import { buildSleepInsightSnapshot, deriveSleepConsistencyFlag } from "./SleepInsightEngine";

type SleepConsistencyFlagType = ReturnType<typeof deriveSleepConsistencyFlag>;

export type SleepCoachInput = {
  totalSleepMinutes: number;
  bedtime: string;
  wakeTime: string;
  awakeningsCount?: number | null;
  manualQualityScore?: number | null;
  remMinutes?: number | null;
  deepMinutes?: number | null;
  sourceType: SleepSourceType;
  trend3dAverage?: number | null;
  trend7dAverage?: number | null;
  sleepConsistencyFlag: SleepConsistencyFlagType;
  confidenceLevel?: "low" | "standard" | "high";
  isStageDataAvailable: boolean;
  insightMode: "duration_only" | "stage_aware";
  insights: string[];
};

export function mapSleepSummaryToCoachInput(summary: SleepDailySummary | null): SleepCoachInput | null {
  if (!summary) {
    return null;
  }

  const insightSnapshot = buildSleepInsightSnapshot(summary);
  return {
    totalSleepMinutes: summary.totalSleepMinutes,
    bedtime: summary.bedtime,
    wakeTime: summary.wakeTime,
    awakeningsCount: summary.awakeningsCount ?? null,
    manualQualityScore: summary.manualQualityScore ?? null,
    remMinutes: summary.remMinutes ?? null,
    deepMinutes: summary.deepMinutes ?? null,
    sourceType: summary.primarySource,
    trend3dAverage: summary.trend3dAverage ?? null,
    trend7dAverage: summary.trend7dAverage ?? null,
    sleepConsistencyFlag: deriveSleepConsistencyFlag(summary),
    confidenceLevel: summary.confidenceLevel,
    isStageDataAvailable: Boolean(summary.isStageDataAvailable),
    insightMode: summary.isStageDataAvailable ? "stage_aware" : "duration_only",
    insights: insightSnapshot.insights.map((item) => item.message),
  };
}
