import type { SleepRawSegment, SleepSourceType } from "./SleepRawSegment";

export const SleepConfidence = {
  LOW: "low",
  STANDARD: "standard",
  HIGH: "high",
} as const;

export type SleepConfidenceLevel = (typeof SleepConfidence)[keyof typeof SleepConfidence];

export const SleepPermissionStatus = {
  GRANTED: "granted",
  DENIED: "denied",
  PENDING: "pending",
  UNAVAILABLE: "unavailable",
  NOT_INSTALLED: "not_installed",
} as const;

export type SleepPermissionStatus = (typeof SleepPermissionStatus)[keyof typeof SleepPermissionStatus];

export type SleepPermissionState = {
  status: SleepPermissionStatus;
  source: SleepSourceType | "unknown";
  reason: string;
  canAskAgain: boolean;
};

export const SleepSourceReadStatus = {
  SUCCESS: "success",
  PERMISSION_DENIED: "permission_denied",
  NO_DATA: "no_data",
  PARTIAL_DATA: "partial_data",
  SOURCE_NOT_AVAILABLE: "source_not_available",
  SOURCE_NOT_INSTALLED: "source_not_installed",
} as const;

export type SleepSourceReadStatus = (typeof SleepSourceReadStatus)[keyof typeof SleepSourceReadStatus];

export type SleepSession = {
  id: string;
  source: SleepSourceType;
  rawSessionId: string;
  sessionStartAt: string;
  sessionEndAt: string;
  sleepDay: string;
  totalSleepMinutes: number;
  timeInBedMinutes?: number | null;
  awakeMinutes?: number | null;
  remMinutes?: number | null;
  coreMinutes?: number | null;
  deepMinutes?: number | null;
  awakeningsCount?: number | null;
  manualQualityScore?: number | null;
  notes?: string | null;
  isStageDataAvailable: boolean;
  isManual: boolean;
  confidenceLevel: SleepConfidenceLevel;
  createdAt: string;
  updatedAt: string;
};

export type SleepManualEntry = {
  id: string;
  bedtime: string;
  wakeTime: string;
  awakeningsCount?: number | null;
  manualQualityScore?: number | null;
  notes?: string | null;
  timezone: string;
  createdAt: string;
  updatedAt: string;
};

export type SleepSourceReadResult = {
  status: SleepSourceReadStatus;
  source: SleepSourceType;
  rawSegments: SleepRawSegment[];
  sessions: SleepSession[];
  permission: SleepPermissionState;
  message: string;
  errorCode?: string;
};
