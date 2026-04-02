import type { SleepSourceType } from "./SleepRawSegment";

export const SleepBedtimeTrend = {
  EARLIER: "earlier",
  STABLE: "stable",
  LATER: "later",
  INSUFFICIENT_DATA: "insufficient_data",
} as const;

export type SleepBedtimeTrend = (typeof SleepBedtimeTrend)[keyof typeof SleepBedtimeTrend];

export const SleepConsistencyFlag = {
  STABLE: "stable",
  DELAYED: "delayed",
  INSUFFICIENT_DATA: "insufficient_data",
} as const;

export type SleepConsistencyFlag = (typeof SleepConsistencyFlag)[keyof typeof SleepConsistencyFlag];

export type SleepDailySummary = {
  sleepDay: string;
  primarySource: SleepSourceType;
  bedtime: string;
  wakeTime: string;
  totalSleepMinutes: number;
  timeInBedMinutes?: number | null;
  awakeMinutes?: number | null;
  remMinutes?: number | null;
  coreMinutes?: number | null;
  deepMinutes?: number | null;
  awakeningsCount?: number | null;
  manualQualityScore?: number | null;
  trend3dAverage?: number | null;
  trend7dAverage?: number | null;
  bedtimeTrend?: SleepBedtimeTrend | null;
  lastSyncedAt?: string | null;
  isStageDataAvailable?: boolean;
  isManual?: boolean;
  confidenceLevel?: "low" | "standard" | "high";
};
