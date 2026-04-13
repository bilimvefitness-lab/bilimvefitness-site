import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  createSleepRepository,
  SleepRepositoryStatus,
  type SleepRepository,
  type SleepRepositoryResult,
} from "../../domain/repository/SleepRepository";
import { buildSleepInsightSnapshot } from "../../domain/services/SleepInsightEngine";
import { SleepEmptyState } from "../components/SleepEmptyState";
import { SleepErrorState } from "../components/SleepErrorState";
import { SleepStageBreakdown } from "../components/SleepStageBreakdown";
import { SleepSummaryCard } from "../components/SleepSummaryCard";
import { SleepTrendChart } from "../components/SleepTrendChart";
import { useLanguage } from "../../../../i18n";

export function SleepDetailScreen({
  repository,
  userId,
  sleepDay,
}: {
  repository?: SleepRepository;
  userId?: string | null;
  sleepDay?: string | null;
}) {
  const { t } = useLanguage();
  const repositoryRef = useRef(repository || createSleepRepository());
  const repo = repository || repositoryRef.current;
  const [result, setResult] = useState<SleepRepositoryResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadScreen() {
      setLoading(true);
      const cached = await repo.getDetails(7, sleepDay);
      if (!active) {
        return;
      }
      setResult(cached);
      setLoading(false);

      const refreshed = await repo.syncRecentSleep({
        userId,
        sleepDay,
        days: 30,
      });
      if (!active) {
        return;
      }
      setResult(refreshed);
    }

    void loadScreen();
    return () => {
      active = false;
    };
  }, [repo, sleepDay, userId]);

  if (loading && !result) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#295c41" />
      </View>
    );
  }

  if (!result?.summary) {
    return (
      <SleepEmptyState
        title={t("sleep.emptyTitle")}
        description={t("sleep.emptyDescription")}
      />
    );
  }

  const insightSnapshot = buildSleepInsightSnapshot(result.summary);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SleepSummaryCard summary={result.summary} insightSnapshot={insightSnapshot} />

      {result.status === SleepRepositoryStatus.PARTIAL_DATA ||
      result.status === SleepRepositoryStatus.SYNC_FAILED_BUT_CACHE_AVAILABLE ? (
        <SleepErrorState status={result.status} />
      ) : null}

      <SleepTrendChart title={t("sleep.microTrend3d")} summaries={result.summaries} variant="duration" />
      <SleepTrendChart title={t("sleep.microBedDrift")} summaries={result.summaries} variant="bedtime" />

      {result.isSleepEfficiencyReliable ? (
        <View style={styles.metricCard}>
          <Text style={styles.metricLabel}>{t("sleep.card.eyebrowStatus")}</Text>
          <Text style={styles.metricValue}>{result.sleepEfficiency}%</Text>
        </View>
      ) : null}

      <SleepStageBreakdown summary={result.summary} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("sleep.insightsTitle")}</Text>
        {result.insights.map((item) => (
          <View key={item.id} style={styles.insightRow}>
            <Text style={styles.insightTitle}>{t("sleep.insight." + item.type + ".title")}</Text>
            <Text style={styles.insightMessage}>{t("sleep.insight." + item.type + ".message", item.meta as Record<string, string | number>)}</Text>
          </View>
        ))}
      </View>
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
  metricCard: {
    backgroundColor: "#eff5ef",
    borderRadius: 18,
    padding: 16,
    gap: 4,
  },
  metricLabel: {
    color: "#678067",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricValue: {
    color: "#14301f",
    fontSize: 28,
    fontWeight: "900",
  },
});
