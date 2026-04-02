import { StyleSheet, Text, View } from "react-native";

import type { SleepDailySummary } from "../../domain/models/SleepDailySummary";
import type { SleepInsightSnapshot } from "../../domain/services/SleepInsightEngine";
import { SleepSourceBadge } from "./SleepSourceBadge";

function formatMinutes(value?: number | null) {
  if (value == null) {
    return "-";
  }
  const normalized = Math.max(Number(value || 0), 0);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours}s ${minutes}dk`;
}

function formatClock(value?: string | null) {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDay(value?: string | null) {
  if (!value) {
    return "-";
  }
  return value;
}

export function SleepSummaryCard({
  summary,
  insightSnapshot,
}: {
  summary: SleepDailySummary;
  insightSnapshot: SleepInsightSnapshot;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>Dun Gece</Text>
          <Text style={styles.value}>{formatMinutes(summary.totalSleepMinutes)}</Text>
          <Text style={styles.hint}>{insightSnapshot.shortStatus}</Text>
        </View>
        <SleepSourceBadge source={summary.primarySource} />
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Yatis</Text>
          <Text style={styles.metricValue}>{formatClock(summary.bedtime)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Kalkis</Text>
          <Text style={styles.metricValue}>{formatClock(summary.wakeTime)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>Sleep Day</Text>
          <Text style={styles.metricValue}>{formatDay(summary.sleepDay)}</Text>
        </View>
      </View>

      <View style={styles.secondaryRow}>
        <View style={styles.secondaryPill}>
          <Text style={styles.secondaryLabel}>3 gun ort.</Text>
          <Text style={styles.secondaryValue}>{formatMinutes(summary.trend3dAverage ?? null)}</Text>
        </View>
        <View style={styles.secondaryPill}>
          <Text style={styles.secondaryLabel}>7 gun ort.</Text>
          <Text style={styles.secondaryValue}>{formatMinutes(summary.trend7dAverage ?? null)}</Text>
        </View>
        <View style={styles.secondaryPill}>
          <Text style={styles.secondaryLabel}>Uyanma</Text>
          <Text style={styles.secondaryValue}>
            {summary.awakeningsCount != null ? String(summary.awakeningsCount) : "-"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f7fbf6",
    borderRadius: 22,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "#dfe9de",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  headerCopy: {
    gap: 4,
    flex: 1,
  },
  eyebrow: {
    color: "#5e775f",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  value: {
    color: "#14301f",
    fontSize: 34,
    lineHeight: 38,
    fontWeight: "900",
  },
  hint: {
    color: "#567059",
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metric: {
    flex: 1,
    minWidth: 92,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 12,
    gap: 4,
  },
  metricLabel: {
    color: "#678067",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricValue: {
    color: "#193426",
    fontSize: 18,
    fontWeight: "800",
  },
  secondaryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  secondaryPill: {
    flexGrow: 1,
    minWidth: 90,
    backgroundColor: "#eef5ee",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  secondaryLabel: {
    color: "#678067",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  secondaryValue: {
    color: "#163423",
    fontWeight: "800",
  },
});
