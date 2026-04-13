import { StyleSheet, Text, View } from "react-native";

import type { SleepDailySummary } from "../../domain/models/SleepDailySummary";
import { useLanguage } from "../../../../i18n";

type SleepTrendVariant = "duration" | "bedtime";

function dayLabel(value: string, locale: string) {
  const parsed = new Date(`${value}T12:00:00`);
  return parsed.toLocaleDateString(locale, {
    weekday: "short",
  });
}

function bedtimeMinutes(value?: string | null) {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }
  const base = parsed.getHours() * 60 + parsed.getMinutes();
  return base < 12 * 60 ? base + 24 * 60 : base;
}

function numericValue(summary: SleepDailySummary, variant: SleepTrendVariant) {
  if (variant === "bedtime") {
    return bedtimeMinutes(summary.bedtime);
  }
  return Number(summary.totalSleepMinutes || 0);
}

function labelValue(
  summary: SleepDailySummary,
  variant: SleepTrendVariant,
  locale: string,
  hourAbbr: string,
  minAbbr: string,
) {
  if (variant === "bedtime") {
    const parsed = new Date(summary.bedtime);
    if (Number.isNaN(parsed.getTime())) {
      return "-";
    }
    return parsed.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
  }
  const totalMinutes = Number(summary.totalSleepMinutes || 0);
  return `${Math.floor(totalMinutes / 60)}${hourAbbr} ${totalMinutes % 60}${minAbbr}`;
}

export function SleepTrendChart({
  title,
  summaries,
  variant = "duration",
}: {
  title: string;
  summaries: SleepDailySummary[];
  variant?: SleepTrendVariant;
}) {
  const { language, t } = useLanguage();
  const locale   = language === "tr" ? "tr-TR" : "en-US";
  const hourAbbr = t("sleep.hourAbbr");
  const minAbbr  = t("sleep.minAbbr");

  const items    = [...(summaries || [])].slice(-7);
  const maxValue = Math.max(1, ...items.map((item) => numericValue(item, variant)));

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.chart}>
        {items.map((summary) => {
          const value  = numericValue(summary, variant);
          const height = Math.max((value / maxValue) * 120, 10);
          return (
            <View key={`${variant}-${summary.sleepDay}`} style={styles.column}>
              <Text style={styles.value}>{labelValue(summary, variant, locale, hourAbbr, minAbbr)}</Text>
              <View style={styles.track}>
                <View style={[styles.fill, { height }]} />
              </View>
              <Text style={styles.day}>{dayLabel(summary.sleepDay, locale)}</Text>
            </View>
          );
        })}
      </View>
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
  chart: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 10,
  },
  column: {
    flex: 1,
    alignItems: "center",
    gap: 8,
  },
  value: {
    color: "#5c765f",
    fontSize: 11,
    fontWeight: "700",
  },
  track: {
    width: "100%",
    maxWidth: 28,
    height: 124,
    justifyContent: "flex-end",
    backgroundColor: "#e3eee3",
    borderRadius: 999,
    overflow: "hidden",
  },
  fill: {
    width: "100%",
    backgroundColor: "#3c8058",
    borderRadius: 999,
  },
  day: {
    color: "#486252",
    fontSize: 11,
    fontWeight: "700",
  },
});
