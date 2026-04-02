export const SleepSource = {
  APPLE_HEALTH: "apple_health",
  HEALTH_CONNECT: "health_connect",
  MANUAL: "manual",
} as const;

export type SleepSourceType = (typeof SleepSource)[keyof typeof SleepSource];

export const SleepSegmentType = {
  IN_BED: "in_bed",
  ASLEEP: "asleep",
  AWAKE: "awake",
  REM: "rem",
  CORE: "core",
  DEEP: "deep",
  OUT_OF_BED: "out_of_bed",
  UNKNOWN: "unknown",
} as const;

export type SleepSegmentType = (typeof SleepSegmentType)[keyof typeof SleepSegmentType];

export type SleepRawSegment = {
  id: string;
  source: SleepSourceType;
  rawSourceId: string;
  segmentType: SleepSegmentType;
  startAt: string;
  endAt: string;
  timezone: string;
  metadataJson: string;
  importedAt: string;
};
