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
import { mergeSleepSessions } from "../services/SleepMergeEngine";
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
  message: string;
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
    message: string,
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
      message,
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
    const permission = await this.permissionService.getPermissionState();
    const summaries = await this.storage.getDailySummariesInRange(range.startDay, range.endDay);

    if (summaries.length) {
      const summary = pickSummaryForDay(summaries, sleepDay);
      const status =
        summary && summary.isStageDataAvailable === false && !summary.isManual
          ? SleepRepositoryStatus.PARTIAL_DATA
          : SleepRepositoryStatus.SUCCESS;
      return this.buildResult(status, "Uyku ozeti cache uzerinden yuklendi.", summaries, sleepDay, permission, true);
    }

    if (permission.status === SleepPermissionStatus.DENIED) {
      return this.buildResult(
        SleepRepositoryStatus.PERMISSION_DENIED,
        "Uyku verisine erisim izni verilmedi.",
        [],
        sleepDay,
        permission,
        true
      );
    }

    if (permission.status === SleepPermissionStatus.NOT_INSTALLED) {
      return this.buildResult(
        SleepRepositoryStatus.SOURCE_NOT_INSTALLED,
        permission.reason,
        [],
        sleepDay,
        permission,
        true
      );
    }

    if (permission.status === SleepPermissionStatus.UNAVAILABLE) {
      return this.buildResult(
        SleepRepositoryStatus.SOURCE_NOT_AVAILABLE,
        permission.reason,
        [],
        sleepDay,
        permission,
        true
      );
    }

    return this.buildResult(
      SleepRepositoryStatus.NO_DATA,
      "Henüz cachelenmis uyku verisi bulunmuyor.",
      [],
      sleepDay,
      permission,
      true
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
      "Uyku detaylari cache uzerinden yuklendi.",
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
          "Manuel uyku kaydi yerelde kaydedildi ancak backend senkronizasyonu tamamlanamadi.",
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
      "Manuel uyku kaydi kaydedildi.",
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
      const mergedSessions = mergeSleepSessions(manualSessions);
      const manualSummaries = buildSleepDailySummaries(mergedSessions);
      if (manualSummaries.length) {
        await this.storage.replaceDailySummariesInRange(range.startDay, range.endDay, manualSummaries);
      }
      return this.buildResult(
        SleepRepositoryStatus.SOURCE_NOT_AVAILABLE,
        "Bu platformda otomatik uyku kaynagi desteklenmiyor.",
        manualSummaries,
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
        const fallbackSummaries = cachedSummaries.length
          ? cachedSummaries
          : buildSleepDailySummaries(mergeSleepSessions(manualSessions));
        return this.buildResult(
          repositoryStatus,
          readResult.message,
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
            "Yerel uyku verisi guncellendi ancak backend senkronizasyonu tamamlanamadi.",
            summaries,
            options.sleepDay,
            readResult.permission,
            true
          );
        }
      }

      return this.buildResult(
        repositoryStatus,
        readResult.message,
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
        "Son uyku verisi korunuyor. Yeni senkronizasyon tamamlanamadi.",
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
