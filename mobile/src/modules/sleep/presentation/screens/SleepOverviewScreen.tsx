import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  createSleepRepository,
  SleepRepositoryStatus,
  type SleepRepository,
  type SleepRepositoryResult,
} from "../../domain/repository/SleepRepository";
import { buildSleepInsightSnapshot } from "../../domain/services/SleepInsightEngine";
import { SleepEmptyState } from "../components/SleepEmptyState";
import { SleepErrorState } from "../components/SleepErrorState";
import { SleepSummaryCard } from "../components/SleepSummaryCard";
import { useLanguage } from "../../../../i18n";

export function SleepOverviewScreen({
  repository,
  userId,
  sleepDay,
  seedResult,
  onOpenDetails,
  onOpenManualEntry,
  onOpenPermission,
}: {
  repository?: SleepRepository;
  userId?: string | null;
  sleepDay?: string | null;
  /** Result from saveManualEntry — seeds initial state so the overview renders
   *  saved data instantly on remount without waiting for getOverview/sync. */
  seedResult?: SleepRepositoryResult | null;
  onOpenDetails?: () => void;
  onOpenManualEntry?: () => void;
  onOpenPermission?: () => void;
}) {
  const { t } = useLanguage();
  const repositoryRef = useRef(repository || createSleepRepository());
  const repo = repository || repositoryRef.current;
  // If we have a seed result (from a just-completed manual save), use it as the
  // initial state and skip the loading spinner — the data is already available.
  const [result, setResult] = useState<SleepRepositoryResult | null>(seedResult ?? null);
  const [loading, setLoading] = useState(seedResult == null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadScreen() {
      // When a seedResult is provided (e.g. from a just-completed manual save),
      // skip getOverview — the data is already merged and available.  Jump
      // straight to syncRecentSleep so fresh health data is picked up in the
      // background without a loading flash.
      if (!seedResult) {
        setLoading(true);
        const cached = await repo.getOverview(sleepDay);
        if (!active) return;
        setResult(cached);
        setLoading(false);
      }

      setSyncing(true);
      const refreshed = await repo.syncRecentSleep({
        userId,
        sleepDay,
        days: 14,
      });
      if (!active) return;
      setResult(refreshed);
      setSyncing(false);
    }

    void loadScreen();
    return () => {
      active = false;
    };
  }, [repo, sleepDay, userId]);

  async function handleRetry() {
    setSyncing(true);
    const refreshed = await repo.syncRecentSleep({
      userId,
      sleepDay,
      days: 14,
    });
    setResult(refreshed);
    setSyncing(false);
  }

  // ── Localised format helpers (depend on t — defined inside component) ────────

  function formatDuration(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0
      ? `${h}${t("sleep.hourAbbr")} ${m}${t("sleep.minAbbr")}`
      : `${h}${t("sleep.hourAbbr")}`;
  }

  function formatTrendDiff(last: number, avg: number): string {
    const diff = Math.round(last - avg);
    if (Math.abs(diff) < 5) return t("sleep.trendEqual");
    return diff > 0
      ? t("sleep.trendAbove", { diff })
      : t("sleep.trendBelow", { diff: Math.abs(diff) });
  }

  // ── Loading guard ────────────────────────────────────────────────────────────

  if (loading && !result) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#295c41" />
      </View>
    );
  }

  // Data-first rule: if we have ANY summaries, always render the data view —
  // even if the health source is unavailable or permission is denied.  The
  // error/empty state is only shown when there is truly no data to display.
  const hasAnySummaries = (result?.summaries?.length ?? 0) > 0;

  if (!result?.summary && !hasAnySummaries) {
    if (
      result?.status === SleepRepositoryStatus.PERMISSION_DENIED ||
      result?.status === SleepRepositoryStatus.SOURCE_NOT_AVAILABLE ||
      result?.status === SleepRepositoryStatus.SOURCE_NOT_INSTALLED
    ) {
      return (
        <SleepErrorState
          status={result.status}
          onPrimaryAction={onOpenPermission}
          onSecondaryAction={onOpenManualEntry}
        />
      );
    }

    return (
      <SleepEmptyState
        title={t("sleep.emptyTitle")}
        description={t("sleep.emptyDescription")}
        actionLabel={t("sleep.emptyAction")}
        onPress={onOpenManualEntry}
      />
    );
  }

  // ── Null-safe summary access ─────────────────────────────────────────────────
  // hasAnySummaries may be true while result.summary is still null during a
  // mid-transition state (e.g. language switch triggering a re-render before
  // syncRecentSleep completes).  Guard every field access here.
  const summary = result?.summary ?? null;
  const insightSnapshot = summary ? buildSleepInsightSnapshot(summary) : null;

  // Micro insight values — only rendered when the field is actually present.
  const totalMin = summary?.totalSleepMinutes ?? null;
  const trend3d  = summary?.trend3dAverage   ?? null;
  const bedTrend = summary?.bedtimeTrend     ?? null;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {summary && insightSnapshot && (
        <SleepSummaryCard summary={summary} insightSnapshot={insightSnapshot} />
      )}

      {/* ── Micro insight block ───────────────────────────────────── */}
      {(totalMin !== null || bedTrend !== null) && (
        <View style={styles.microBlock}>
          <Text style={styles.microBlockTitle}>{t("sleep.microTitle")}</Text>
          {totalMin !== null && (
            <View style={styles.microRow}>
              <Text style={styles.microLabel}>{t("sleep.microDuration")}</Text>
              <Text style={styles.microValue}>{formatDuration(totalMin)}</Text>
            </View>
          )}
          {totalMin !== null && trend3d !== null && (
            <View style={styles.microRow}>
              <Text style={styles.microLabel}>{t("sleep.microTrend3d")}</Text>
              <Text style={styles.microValue}>{formatTrendDiff(totalMin, trend3d)}</Text>
            </View>
          )}
          {bedTrend !== null && (
            <View style={styles.microRow}>
              <Text style={styles.microLabel}>{t("sleep.microBedDrift")}</Text>
              <Text style={styles.microValue}>{String(bedTrend)}</Text>
            </View>
          )}
        </View>
      )}

      {result?.status === SleepRepositoryStatus.PARTIAL_DATA ||
      result?.status === SleepRepositoryStatus.SYNC_FAILED_BUT_CACHE_AVAILABLE ? (
        <SleepErrorState
          status={result.status}
          onPrimaryAction={handleRetry}
          onSecondaryAction={onOpenManualEntry}
        />
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("sleep.insightsTitle")}</Text>
        {(result?.insights?.length ?? 0) > 0 ? (
          result!.insights.map((item) => (
            <View key={item.id} style={styles.insightRow}>
              <Text style={styles.insightTitle}>{t("sleep.insight." + item.type + ".title")}</Text>
              <Text style={styles.insightMessage}>{t("sleep.insight." + item.type + ".message", item.meta as Record<string, string | number>)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.insightMessage}>{t("sleep.noInsights")}</Text>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onOpenDetails} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>{t("sleep.openDetail")}</Text>
        </Pressable>
        <Pressable onPress={onOpenManualEntry} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>{t("sleep.manualEntry")}</Text>
        </Pressable>
      </View>

      <Text style={styles.syncMeta}>
        {syncing
          ? t("sleep.syncing")
          : result?.lastSuccessfulSyncAt
            ? t("sleep.lastSync", { time: result.lastSuccessfulSyncAt })
            : t("sleep.noSync")}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef4e8",
  },
  content: {
    padding: 16,
    gap: 16,
  },
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#f7fbf6",
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#dde9db",
  },
  cardTitle: {
    color: "#14301f",
    fontSize: 18,
    fontWeight: "800",
  },
  insightRow: {
    gap: 4,
  },
  insightTitle: {
    color: "#31553a",
    fontWeight: "800",
  },
  insightMessage: {
    color: "#567059",
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#295c41",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#d4dfd3",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  secondaryButtonText: {
    color: "#295c41",
    fontWeight: "800",
  },
  syncMeta: {
    color: "#648066",
    fontSize: 12,
  },
  microBlock: {
    backgroundColor: "#f0f7f2",
    borderRadius: 18,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#d4e4d5",
  },
  microBlockTitle: {
    color: "#14301f",
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  microRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  microLabel: {
    color: "#567059",
    fontSize: 14,
    fontWeight: "600",
  },
  microValue: {
    color: "#14301f",
    fontSize: 14,
    fontWeight: "800",
    flexShrink: 1,
    textAlign: "right",
    maxWidth: "60%",
  },
});
