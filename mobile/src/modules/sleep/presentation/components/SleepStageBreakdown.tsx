import { StyleSheet, Text, View } from "react-native";

import type { SleepDailySummary } from "../../domain/models/SleepDailySummary";

function buildStageRows(summary: SleepDailySummary) {
  return [
    { key: "rem", label: "REM", value: summary.remMinutes ?? null, color: "#5e88ff" },
    { key: "core", label: "Core", value: summary.coreMinutes ?? null, color: "#4db091" },
    { key: "deep", label: "Deep", value: summary.deepMinutes ?? null, color: "#274f8b" },
    { key: "awake", label: "Awake", value: summary.awakeMinutes ?? null, color: "#d49c4d" },
  ].filter((item) => item.value != null && Number(item.value) > 0);
}

function formatMinutes(value: number) {
  const normalized = Math.max(Math.round(Number(value || 0)), 0);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours}s ${minutes}dk`;
}

export function SleepStageBreakdown({ summary }: { summary: SleepDailySummary }) {
  const rows = buildStageRows(summary);
  if (!summary.isStageDataAvailable || !rows.length) {
    return null;
  }

  const total = rows.reduce((accumulator, item) => accumulator + Number(item.value || 0), 0);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Stage Dagilimi</Text>
      {rows.map((row) => {
        const width = (total > 0 ? `${Math.max((Number(row.value || 0) / total) * 100, 8)}%` : "8%") as any;
        return (
          <View key={row.key} style={styles.row}>
            <View style={styles.rowHeader}>
              <Text style={styles.label}>{row.label}</Text>
              <Text style={styles.value}>{formatMinutes(Number(row.value || 0))}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width, backgroundColor: row.color }]} />
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f7fbf6",
    borderRadius: 20,
    padding: 18,
    gap: 14,
    borderWidth: 1,
    borderColor: "#dfe9de",
  },
  title: {
    color: "#14301f",
    fontSize: 18,
    fontWeight: "800",
  },
  row: {
    gap: 8,
  },
  rowHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  label: {
    color: "#4e6854",
    fontWeight: "800",
  },
  value: {
    color: "#173625",
    fontWeight: "700",
  },
  track: {
    height: 10,
    borderRadius: 999,
    backgroundColor: "#e1ece0",
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 999,
  },
});
