import { Platform } from "react-native";

import { apiRequest } from "../../../../api";
import type { SleepDailySummary } from "../models/SleepDailySummary";
import { SleepSource, type SleepSourceType } from "../models/SleepRawSegment";
import {
  SleepPermissionStatus,
  SleepSourceReadStatus,
  type SleepPermissionState,
} from "../models/SleepSession";
import { mapSleepSummaryToCoachInput, type SleepCoachInput } from "../services/SleepCoachMapper";
import {
  buildSleepInsightSnapshot,
  type SleepInsight,
} from "../services/SleepInsightEngine";
import { mergeSleepSessions, mergeSummaries } from "../services/SleepMergeEngine";
import { buildSleepDailySummaries } from "../services/SleepSummaryBuilder";
import { SleepPermissionService } from "../../data/permissions/SleepPermissionService";
import { HealthConnectSleepSource } from "../../data/sources/HealthConnectSleepSource";
import { HealthKitSleepSource } from "../../data/sources/HealthKitSleepSource";
import { ManualSleepSource, type SaveManualSleepInput } from "../../data/sources/ManualSleepSource";
import { buildSleepDayRange, pickSummaryForDay } from "../../data/storage/SleepQueries";
import { SleepStorage } from "../../data/storage/SleepStorage";

type SleepConsistencyFlagType = ReturnType<typeof buildSleepInsightSnapshot>["sleepConsistencyFlag"];

const SUPPORTED_SYNC_WINDOWS = new Set([14, 30]);

type HealthSleepSource = {
  source: SleepSourceType;
  getPermissionState: () => Promise<SleepPermissionState>;
  requestPermission: () => Promise<SleepPermissionState>;
  openSettings: () => Promise<void> | void;
  read: (window: { startDate: string; endDate: string }) => Promise<{
    status: (typeof SleepSourceReadStatus)[keyof typeof SleepSourceReadStatus];
    source: SleepSourceType;
    rawSegments: any[];
    sessions: any[];
    permission: SleepPermissionState;
    message: string;
    errorCode?: string;
  }>;
};

export const SleepRepositoryStatus = {
  SUCCESS: "success",
  PERMISSION_DENIED: "permission_denied",
  NO_DATA: "no_data",
  PARTIAL_DATA: "partial_data",
  SOURCE_NOT_AVAILABLE: "source_not_available",
  SOURCE_NOT_INSTALLED: "source_not_installed",
  SYNC_FAILED_BUT_CACHE_AVAILABLE: "sync_failed_but_cache_available",
} as const;

export type SleepRepositoryStatus = (typeof SleepRepositoryStatus)[keyof typeof SleepRepositoryStatus];

export type SleepRepositoryResult = {
  status: SleepRepositoryStatus;
  messageCode: string;
  summary: SleepDailySummary | null;
  summaries: SleepDailySummary[];
  insights: SleepInsight[];
  coachInput: SleepCoachInput | null;
  sleepConsistencyFlag: SleepConsistencyFlagType;
  sleepEfficiency: number | null;
  isSleepEfficiencyReliable: boolean;
  permission: SleepPermissionState | null;
  source: SleepSourceType | "unknown" | "none";
  lastSuccessfulSyncAt: string | null;
  cacheUsed: boolean;
};

export type SyncSleepOptions = {
  userId?: string | null;
  days?: number;
  sleepDay?: string | null;
};

function nowIso() {
  return new Date().toISOString();
}

function normalizeWindowDays(days?: number | null) {
  const candidate = Math.max(Math.round(Number(days || 14)), 1);
  return SUPPORTED_SYNC_WINDOWS.has(candidate) ? candidate : 14;
}

function toBackendPayload(summary: SleepDailySummary) {
  return {
    sleep_day: summary.sleepDay,
    primary_source: summary.primarySource,
    bedtime: summary.bedtime,
    wake_time: summary.wakeTime,
    total_sleep_minutes: summary.totalSleepMinutes,
    time_in_bed_minutes: summary.timeInBedMinutes ?? null,
    awake_minutes: summary.awakeMinutes ?? null,
    rem_minutes: summary.remMinutes ?? null,
    core_minutes: summary.coreMinutes ?? null,
    deep_minutes: summary.deepMinutes ?? null,
    awakenings_count: summary.awakeningsCount ?? null,
    manual_quality_score: summary.manualQualityScore ?? null,
    trend_3d_average: summary.trend3dAverage ?? null,
    trend_7d_average: summary.trend7dAverage ?? null,
    bedtime_trend: summary.bedtimeTrend ?? null,
    is_stage_data_available: Boolean(summary.isStageDataAvailable),
    is_manual: Boolean(summary.isManual),
    confidence_level: summary.confidenceLevel || "low",
    last_synced_at: summary.lastSyncedAt || nowIso(),
  };
}

function toRepositoryStatus(sourceStatus: (typeof SleepSourceReadStatus)[keyof typeof SleepSourceReadStatus]): SleepRepositoryStatus {
  switch (sourceStatus) {
    case SleepSourceReadStatus.SUCCESS:
      return SleepRepositoryStatus.SUCCESS;
    case SleepSourceReadStatus.PERMISSION_DENIED:
      return SleepRepositoryStatus.PERMISSION_DENIED;
    case SleepSourceReadStatus.NO_DATA:
      return SleepRepositoryStatus.NO_DATA;
    case SleepSourceReadStatus.PARTIAL_DATA:
      return SleepRepositoryStatus.PARTIAL_DATA;
    case SleepSourceReadStatus.SOURCE_NOT_AVAILABLE:
      return SleepRepositoryStatus.SOURCE_NOT_AVAILABLE;
    case SleepSourceReadStatus.SOURCE_NOT_INSTALLED:
      return SleepRepositoryStatus.SOURCE_NOT_INSTALLED;
    default:
      return SleepRepositoryStatus.SOURCE_NOT_AVAILABLE;
  }
}

function deriveResultSource(summary: SleepDailySummary | null, permission: SleepPermissionState | null) {
  if (summary?.primarySource) {
    return summary.primarySource;
  }
  if (permission?.source) {
    return permission.source;
  }
  return "none";
}

export class SleepRepository {
  constructor(
    private readonly storage = new SleepStorage(),
    private readonly manualSource = new ManualSleepSource(),
    private readonly permissionService = new SleepPermissionService(),
    private readonly healthKitSource: HealthSleepSource = new HealthKitSleepSource(),
    private readonly healthConnectSource: HealthSleepSource = new HealthConnectSleepSource()
  ) {}

  private getHealthSource(): HealthSleepSource | null {
    if (Platform.OS === "ios") {
      return this.healthKitSource;
    }
    if (Platform.OS === "android") {
      return this.healthConnectSource;
    }
    return null;
  }

  private async buildResult(
    status: SleepRepositoryStatus,
    messageCode: string,
    summaries: SleepDailySummary[],
    sleepDay?: string | null,
    permission: SleepPermissionState | null = null,
    cacheUsed = false
  ): Promise<SleepRepositoryResult> {
    const meta = await this.storage.getSyncMeta();
    const summary = pickSummaryForDay(summaries, sleepDay);
    const insightSnapshot = buildSleepInsightSnapshot(summary);

    return {
      status,
      messageCode,
      summary,
      summaries,
      insights: insightSnapshot.insights,
      coachInput: mapSleepSummaryToCoachInput(summary),
      sleepConsistencyFlag: insightSnapshot.sleepConsistencyFlag,
      sleepEfficiency: insightSnapshot.sleepEfficiency,
      isSleepEfficiencyReliable: insightSnapshot.isSleepEfficiencyReliable,
      permission,
      source: deriveResultSource(summary, permission),
      lastSuccessfulSyncAt: meta.lastSuccessfulSyncAt,
      cacheUsed,
    };
  }

  async getPermissionState() {
    return this.permissionService.getPermissionState();
  }

  async requestPermission() {
    return this.permissionService.requestPermission();
  }

  async openPermissionSettings() {
    await this.permissionService.openSettings();
  }

  async getOverview(sleepDay?: string | null) {
    const range = buildSleepDayRange(7, sleepDay);

    // Fetch permission, cached summaries, and manual sessions in parallel.
    // Manual is always checked — not as a fallback, but as a first-class source.
    const [permission, cachedSummaries, freshManualSessions] = await Promise.all([
      this.permissionService.getPermissionState(),
      this.storage.getDailySummariesInRange(range.startDay, range.endDay),
      this.manualSource.listSessions(7, sleepDay),
    ]);

    const freshManualSummaries = freshManualSessions.length
      ? buildSleepDailySummaries(mergeSleepSessions(freshManualSessions))
      : [];

    // Merge: manual overrides cache for the same sleepDay.
    const merged = mergeSummaries(cachedSummaries, freshManualSummaries);

    if (merged.length) {
      // Persist any manual entries that weren't yet reflected in the cache.
      if (freshManualSummaries.length) {
        await this.storage.replaceDailySummariesInRange(range.startDay, range.endDay, merged);
      }
      const summary = pickSummaryForDay(merged, sleepDay);
      const status =
        summary && summary.isStageDataAvailable === false && !summary.isManual
          ? SleepRepositoryStatus.PARTIAL_DATA
          : SleepRepositoryStatus.SUCCESS;
      return this.buildResult(status, "OVERVIEW_LOADED", merged, sleepDay, permission, cachedSummaries.length > 0);
    }

    // No data at all — return status-based empty result.
    if (permission.status === SleepPermissionStatus.DENIED) {
      return this.buildResult(
        SleepRepositoryStatus.PERMISSION_DENIED,
        "PERMISSION_DENIED",
        [],
        sleepDay,
        permission,
        false
      );
    }

    if (permission.status === SleepPermissionStatus.NOT_INSTALLED) {
      return this.buildResult(
        SleepRepositoryStatus.SOURCE_NOT_INSTALLED,
        "SOURCE_NOT_INSTALLED",
        [],
        sleepDay,
        permission,
        false
      );
    }

    if (permission.status === SleepPermissionStatus.UNAVAILABLE) {
      return this.buildResult(
        SleepRepositoryStatus.SOURCE_NOT_AVAILABLE,
        "SOURCE_NOT_AVAILABLE",
        [],
        sleepDay,
        permission,
        false
      );
    }

    return this.buildResult(
      SleepRepositoryStatus.NO_DATA,
      "NO_DATA",
      [],
      sleepDay,
      permission,
      false
    );
  }

  async getDetails(days = 7, sleepDay?: string | null) {
    const range = buildSleepDayRange(days, sleepDay);
    const permission = await this.permissionService.getPermissionState();
    const summaries = await this.storage.getDailySummariesInRange(range.startDay, range.endDay);
    if (!summaries.length) {
      return this.getOverview(sleepDay);
    }

    const hasPartial = summaries.some((item) => item.isStageDataAvailable === false && !item.isManual);
    return this.buildResult(
      hasPartial ? SleepRepositoryStatus.PARTIAL_DATA : SleepRepositoryStatus.SUCCESS,
      "DETAILS_FROM_CACHE",
      summaries,
      sleepDay,
      permission,
      true
    );
  }

  async saveManualEntry(input: SaveManualSleepInput, options: { userId?: string | null } = {}) {
    const savedSession = await this.manualSource.saveEntry(input);
    const range = buildSleepDayRange(30, savedSession.sleepDay);
    const manualSessions = await this.manualSource.listSessions(30, savedSession.sleepDay);
    const healthSessions = await this.storage.getSessionsInRange(range.startDay, range.endDay);
    const mergedSessions = mergeSleepSessions([...healthSessions, ...manualSessions]);
    const summaries = buildSleepDailySummaries(mergedSessions);
    const rangedSummaries = summaries.filter(
      (summary) => summary.sleepDay >= range.startDay && summary.sleepDay <= range.endDay
    );

    await this.storage.replaceDailySummariesInRange(range.startDay, range.endDay, rangedSummaries);
    await this.storage.saveSyncMeta({
      lastStatus: SleepRepositoryStatus.SUCCESS,
      lastAttemptedSyncAt: nowIso(),
      lastSuccessfulSyncAt: nowIso(),
      lastErrorCode: null,
      lastWindowDays: 30,
      lastSource: SleepSource.MANUAL,
    });

    if (options.userId && rangedSummaries.length) {
      try {
        await apiRequest("/sleep/sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: options.userId,
            summaries: rangedSummaries.map(toBackendPayload),
          }),
        });
        await this.storage.saveSyncMeta({
          backendSyncedAt: nowIso(),
        });
      } catch {
        return this.buildResult(
          SleepRepositoryStatus.SYNC_FAILED_BUT_CACHE_AVAILABLE,
          "MANUAL_BACKEND_SYNC_FAILED",
          rangedSummaries,
          savedSession.sleepDay,
          {
            status: SleepPermissionStatus.GRANTED,
            source: SleepSource.MANUAL,
            reason: "",
            canAskAgain: true,
          },
          true
        );
      }
    }

    return this.buildResult(
      SleepRepositoryStatus.SUCCESS,
      "MANUAL_SAVED",
      rangedSummaries,
      savedSession.sleepDay,
      {
        status: SleepPermissionStatus.GRANTED,
        source: SleepSource.MANUAL,
        reason: "",
        canAskAgain: true,
      },
      false
    );
  }

  async syncRecentSleep(options: SyncSleepOptions = {}) {
    const days = normalizeWindowDays(options.days);
    const range = buildSleepDayRange(days, options.sleepDay);
    const permission = await this.permissionService.getPermissionState();
    const manualSessions = await this.manualSource.listSessions(days, options.sleepDay);
    const cachedSummaries = await this.storage.getDailySummariesInRange(range.startDay, range.endDay);
    const healthSource = this.getHealthSource();

    await this.storage.saveSyncMeta({
      lastAttemptedSyncAt: nowIso(),
      lastWindowDays: days,
      lastErrorCode: null,
    });

    if (!healthSource) {
      const freshManualSummaries = buildSleepDailySummaries(mergeSleepSessions(manualSessions));
      // Merge cached + fresh manual: manual takes precedence for its days so a
      // just-saved entry is always visible regardless of cache state.
      const mergedMap = new Map<string, SleepDailySummary>();
      for (const s of cachedSummaries) mergedMap.set(s.sleepDay, s);
      for (const s of freshManualSummaries) mergedMap.set(s.sleepDay, s);
      const combinedSummaries = Array.from(mergedMap.values());
      if (combinedSummaries.length) {
        await this.storage.replaceDailySummariesInRange(range.startDay, range.endDay, combinedSummaries);
      }
      return this.buildResult(
        SleepRepositoryStatus.SOURCE_NOT_AVAILABLE,
        "SOURCE_NOT_AVAILABLE",
        combinedSummaries,
        options.sleepDay,
        permission,
        false
      );
    }

    try {
      const readResult = await healthSource.read({
        startDate: range.startAt,
        endDate: range.endAt,
      });

      const repositoryStatus = toRepositoryStatus(readResult.status);
      if (
        repositoryStatus === SleepRepositoryStatus.PERMISSION_DENIED ||
        repositoryStatus === SleepRepositoryStatus.SOURCE_NOT_AVAILABLE ||
        repositoryStatus === SleepRepositoryStatus.SOURCE_NOT_INSTALLED
      ) {
        // Always merge fresh manual sessions with the cache snapshot.
        // OR-logic (cache OR manual) misses the case where the cache was fetched
        // before saveManualEntry committed — the fresh manual read is the source
        // of truth for entries the user just saved.
        const freshManualSummaries = manualSessions.length
          ? buildSleepDailySummaries(mergeSleepSessions(manualSessions))
          : [];
        const mergedMap = new Map<string, SleepDailySummary>();
        for (const s of cachedSummaries) mergedMap.set(s.sleepDay, s);
        for (const s of freshManualSummaries) mergedMap.set(s.sleepDay, s);
        const fallbackSummaries = Array.from(mergedMap.values());
        return this.buildResult(
          repositoryStatus,
          String(repositoryStatus).toUpperCase(),
          fallbackSummaries,
          options.sleepDay,
          readResult.permission,
          true
        );
      }

      await this.storage.replaceSourceRawSegmentsInRange(
        healthSource.source,
        range.startDay,
        range.endDay,
        readResult.rawSegments
      );
      await this.storage.replaceSourceSessionsInRange(
        healthSource.source,
        range.startDay,
        range.endDay,
        readResult.sessions
      );

      const healthSessions = await this.storage.getSessionsInRange(range.startDay, range.endDay);
      const mergedSessions = mergeSleepSessions([...healthSessions, ...manualSessions]);
      const summaries = buildSleepDailySummaries(mergedSessions).filter(
        (summary) => summary.sleepDay >= range.startDay && summary.sleepDay <= range.endDay
      );

      await this.storage.replaceDailySummariesInRange(range.startDay, range.endDay, summaries);
      await this.storage.saveSyncMeta({
        lastSuccessfulSyncAt: nowIso(),
        lastStatus: repositoryStatus,
        lastSource: healthSource.source,
      });

      if (options.userId && summaries.length) {
        try {
          await apiRequest("/sleep/sync", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              user_id: options.userId,
              summaries: summaries.map(toBackendPayload),
            }),
          });
          await this.storage.saveSyncMeta({
            backendSyncedAt: nowIso(),
          });
        } catch {
          await this.storage.saveSyncMeta({
            lastStatus: SleepRepositoryStatus.SYNC_FAILED_BUT_CACHE_AVAILABLE,
            lastErrorCode: "backend_sleep_sync_failed",
          });
          return this.buildResult(
            SleepRepositoryStatus.SYNC_FAILED_BUT_CACHE_AVAILABLE,
            "BACKEND_SYNC_FAILED",
            summaries,
            options.sleepDay,
            readResult.permission,
            true
          );
        }
      }

      return this.buildResult(
        repositoryStatus,
        "SYNC_SUCCESS",
        summaries,
        options.sleepDay,
        readResult.permission,
        false
      );
    } catch {
      await this.storage.saveSyncMeta({
        lastStatus: SleepRepositoryStatus.SYNC_FAILED_BUT_CACHE_AVAILABLE,
        lastErrorCode: "sleep_sync_unexpected_failure",
      });

      const fallbackSummaries = cachedSummaries.length
        ? cachedSummaries
        : buildSleepDailySummaries(mergeSleepSessions(manualSessions));
      return this.buildResult(
        SleepRepositoryStatus.SYNC_FAILED_BUT_CACHE_AVAILABLE,
        "CACHE_SYNC_FAILED",
        fallbackSummaries,
        options.sleepDay,
        permission,
        true
      );
    }
  }

  async getCoachInput(sleepDay?: string | null) {
    const overview = await this.getOverview(sleepDay);
    return overview.coachInput;
  }
}

export function createSleepRepository() {
  return new SleepRepository();
}
