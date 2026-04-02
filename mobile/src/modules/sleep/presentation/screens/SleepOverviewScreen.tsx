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

export function SleepOverviewScreen({
  repository,
  userId,
  sleepDay,
  onOpenDetails,
  onOpenManualEntry,
  onOpenPermission,
}: {
  repository?: SleepRepository;
  userId?: string | null;
  sleepDay?: string | null;
  onOpenDetails?: () => void;
  onOpenManualEntry?: () => void;
  onOpenPermission?: () => void;
}) {
  const repositoryRef = useRef(repository || createSleepRepository());
  const repo = repository || repositoryRef.current;
  const [result, setResult] = useState<SleepRepositoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadScreen() {
      setLoading(true);
      const cached = await repo.getOverview(sleepDay);
      if (!active) {
        return;
      }
      setResult(cached);
      setLoading(false);

      setSyncing(true);
      const refreshed = await repo.syncRecentSleep({
        userId,
        sleepDay,
        days: 14,
      });
      if (!active) {
        return;
      }
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

  if (loading && !result) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#295c41" />
      </View>
    );
  }

  if (!result?.summary) {
    if (
      result?.status === SleepRepositoryStatus.PERMISSION_DENIED ||
      result?.status === SleepRepositoryStatus.SOURCE_NOT_AVAILABLE ||
      result?.status === SleepRepositoryStatus.SOURCE_NOT_INSTALLED
    ) {
      return (
        <SleepErrorState
          status={result.status}
          message={result.message}
          onPrimaryAction={onOpenPermission}
          onSecondaryAction={onOpenManualEntry}
        />
      );
    }

    return (
      <SleepEmptyState
        title="Uyku verisi bulunamadi"
        description="Dun geceye ait uyku ozeti yok. Izin akisini tamamlayabilir veya manuel kayit ekleyebilirsin."
        actionLabel="Manuel Kayit"
        onPress={onOpenManualEntry}
      />
    );
  }

  const insightSnapshot = buildSleepInsightSnapshot(result.summary);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <SleepSummaryCard summary={result.summary} insightSnapshot={insightSnapshot} />

      {result.status === SleepRepositoryStatus.PARTIAL_DATA ||
      result.status === SleepRepositoryStatus.SYNC_FAILED_BUT_CACHE_AVAILABLE ? (
        <SleepErrorState
          status={result.status}
          message={result.message}
          onPrimaryAction={handleRetry}
          onSecondaryAction={onOpenManualEntry}
        />
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kisa Durum</Text>
        {result.insights.length ? (
          result.insights.map((item) => (
            <View key={item.id} style={styles.insightRow}>
              <Text style={styles.insightTitle}>{item.title}</Text>
              <Text style={styles.insightMessage}>{item.message}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.insightMessage}>Henuz gosterilecek uyku icgorusu yok.</Text>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={onOpenDetails} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Detayi Ac</Text>
        </Pressable>
        <Pressable onPress={onOpenManualEntry} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Manuel Giris</Text>
        </Pressable>
      </View>

      <Text style={styles.syncMeta}>
        {syncing
          ? "Uyku verisi guncelleniyor..."
          : result.lastSuccessfulSyncAt
            ? `Son basarili sync: ${result.lastSuccessfulSyncAt}`
            : "Henuz basarili sync yok."}
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
});
