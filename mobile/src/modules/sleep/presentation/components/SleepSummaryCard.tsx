import { StyleSheet, Text, View } from "react-native";

import type { SleepDailySummary } from "../../domain/models/SleepDailySummary";
import type { SleepInsightSnapshot } from "../../domain/services/SleepInsightEngine";
import { SleepSourceBadge } from "./SleepSourceBadge";
import { useLanguage } from "../../../../i18n";

function formatMinutes(value?: number | null, hourAbbr = "h", minAbbr = "m") {
  if (value == null) {
    return "-";
  }
  const normalized = Math.max(Number(value || 0), 0);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours}${hourAbbr} ${minutes}${minAbbr}`;
}

function formatClock(value?: string | null, locale = "tr-TR") {
  if (!value) {
    return "-";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }
  return parsed.toLocaleTimeString(locale, {
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
  const { t, language } = useLanguage();
  const locale = language === "tr" ? "tr-TR" : "en-US";
  const hourAbbr = t("sleep.hourAbbr");
  const minAbbr  = t("sleep.minAbbr");

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>{t("sleep.card.eyebrow")}</Text>
          <Text style={styles.value}>{formatMinutes(summary.totalSleepMinutes, hourAbbr, minAbbr)}</Text>
          <Text style={styles.hint}>{t("sleep.insight." + insightSnapshot.shortStatusCode + ".title")}</Text>
        </View>
        <SleepSourceBadge source={summary.primarySource} />
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{t("sleep.card.bedtime")}</Text>
          <Text style={styles.metricValue}>{formatClock(summary.bedtime, locale)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{t("sleep.card.wakeTime")}</Text>
          <Text style={styles.metricValue}>{formatClock(summary.wakeTime, locale)}</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricLabel}>{t("sleep.card.sleepDay")}</Text>
          <Text style={styles.metricValue}>{formatDay(summary.sleepDay)}</Text>
        </View>
      </View>

      <View style={styles.secondaryRow}>
        <View style={styles.secondaryPill}>
          <Text style={styles.secondaryLabel}>{t("sleep.card.avg3d")}</Text>
          <Text style={styles.secondaryValue}>{formatMinutes(summary.trend3dAverage ?? null, hourAbbr, minAbbr)}</Text>
        </View>
        <View style={styles.secondaryPill}>
          <Text style={styles.secondaryLabel}>{t("sleep.card.avg7d")}</Text>
          <Text style={styles.secondaryValue}>{formatMinutes(summary.trend7dAverage ?? null, hourAbbr, minAbbr)}</Text>
        </View>
        <View style={styles.secondaryPill}>
          <Text style={styles.secondaryLabel}>{t("sleep.card.awakenings")}</Text>
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
