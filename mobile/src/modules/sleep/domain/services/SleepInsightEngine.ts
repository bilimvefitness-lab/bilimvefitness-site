import { SleepBedtimeTrend, SleepConsistencyFlag, type SleepDailySummary } from "../models/SleepDailySummary";

export const SleepInsightSeverity = {
  INFO: "info",
  SUCCESS: "success",
  WARNING: "warning",
} as const;

export type SleepInsightSeverity = (typeof SleepInsightSeverity)[keyof typeof SleepInsightSeverity];

export type SleepInsight = {
  id: string;
  title: string;
  message: string;
  severity: SleepInsightSeverity;
};

type SleepConsistencyFlagType = (typeof SleepConsistencyFlag)[keyof typeof SleepConsistencyFlag];

export type SleepInsightSnapshot = {
  shortStatus: string;
  sleepConsistencyFlag: SleepConsistencyFlagType;
  sleepEfficiency: number | null;
  isSleepEfficiencyReliable: boolean;
  insights: SleepInsight[];
};

function formatMinutes(minutes?: number | null) {
  if (minutes == null) {
    return "-";
  }
  const normalized = Math.max(Math.round(Number(minutes || 0)), 0);
  const hours = Math.floor(normalized / 60);
  const remainingMinutes = normalized % 60;
  return `${hours}s ${remainingMinutes}dk`;
}

export function deriveSleepConsistencyFlag(summary: SleepDailySummary | null): SleepConsistencyFlagType {
  if (!summary || summary.bedtimeTrend === SleepBedtimeTrend.INSUFFICIENT_DATA || !summary.bedtimeTrend) {
    return SleepConsistencyFlag.INSUFFICIENT_DATA;
  }
  return summary.bedtimeTrend === SleepBedtimeTrend.LATER
    ? SleepConsistencyFlag.DELAYED
    : SleepConsistencyFlag.STABLE;
}

export function isSleepEfficiencyReliable(summary: SleepDailySummary | null) {
  if (!summary) {
    return false;
  }
  if (summary.isManual) {
    return false;
  }
  if (summary.timeInBedMinutes == null) {
    return false;
  }
  return summary.timeInBedMinutes >= summary.totalSleepMinutes && summary.totalSleepMinutes > 0;
}

export function calculateSleepEfficiency(summary: SleepDailySummary | null) {
  if (!summary || !isSleepEfficiencyReliable(summary) || !summary.timeInBedMinutes) {
    return null;
  }
  return Math.round((summary.totalSleepMinutes / summary.timeInBedMinutes) * 100);
}

export function buildSleepInsightSnapshot(summary: SleepDailySummary | null): SleepInsightSnapshot {
  if (!summary) {
    return {
      shortStatus: "Veri yok",
      sleepConsistencyFlag: SleepConsistencyFlag.INSUFFICIENT_DATA,
      sleepEfficiency: null,
      isSleepEfficiencyReliable: false,
      insights: [],
    };
  }

  const insights: SleepInsight[] = [];
  if (summary.totalSleepMinutes < 360) {
    insights.push({
      id: "duration-low",
      title: "Toparlanma dikkat",
      message: `Toplam uyku ${formatMinutes(summary.totalSleepMinutes)} gorunuyor. Bugun yuklenmeyi biraz daha sade tutmak daha guvenli olabilir.`,
      severity: SleepInsightSeverity.WARNING,
    });
  } else if (summary.totalSleepMinutes < 420) {
    insights.push({
      id: "duration-moderate",
      title: "Hedefin alti",
      message: `Toplam uyku ${formatMinutes(summary.totalSleepMinutes)} gorunuyor. Gun icinde ritmi korumak faydali olabilir.`,
      severity: SleepInsightSeverity.INFO,
    });
  } else if (summary.totalSleepMinutes <= 540) {
    insights.push({
      id: "duration-target",
      title: "Hedef aralik",
      message: `Toplam uyku ${formatMinutes(summary.totalSleepMinutes)} ile hedef banda yakin gorunuyor.`,
      severity: SleepInsightSeverity.SUCCESS,
    });
  } else {
    insights.push({
      id: "duration-high",
      title: "Uzun gece",
      message: `Toplam uyku ${formatMinutes(summary.totalSleepMinutes)} gorunuyor. Bunu tek basina yorumlamak icin daha fazla baglam gerekir.`,
      severity: SleepInsightSeverity.INFO,
    });
  }

  if (
    summary.trend3dAverage != null &&
    summary.trend7dAverage != null &&
    summary.trend3dAverage + 20 < summary.trend7dAverage
  ) {
    insights.push({
      id: "trend-down",
      title: "Son 3 gun dusuyor",
      message: "Kisa vade uyku ortalamasi son haftanin altina geliyor gibi gorunuyor.",
      severity: SleepInsightSeverity.WARNING,
    });
  }

  if (summary.bedtimeTrend === SleepBedtimeTrend.LATER) {
    insights.push({
      id: "bedtime-later",
      title: "Yatis gecikiyor",
      message: "Yatis saati son gunlerde daha gec bir pencereye kayiyor gibi gorunuyor.",
      severity: SleepInsightSeverity.INFO,
    });
  }

  if (summary.isStageDataAvailable) {
    const stageParts = [
      summary.remMinutes != null ? `REM ${summary.remMinutes} dk` : null,
      summary.deepMinutes != null ? `deep ${summary.deepMinutes} dk` : null,
      summary.awakeMinutes != null ? `uyanik ${summary.awakeMinutes} dk` : null,
    ].filter(Boolean);
    if (stageParts.length) {
      insights.push({
        id: "stage-available",
        title: "Stage verisi mevcut",
        message: `${stageParts.join(", ")}. Bu alanlari sadece baglamsal yorum olarak kullan.`,
        severity: SleepInsightSeverity.INFO,
      });
    }
  }

  const efficiency = calculateSleepEfficiency(summary);
  return {
    shortStatus: insights[0]?.title || "Uyku ozeti",
    sleepConsistencyFlag: deriveSleepConsistencyFlag(summary),
    sleepEfficiency: efficiency,
    isSleepEfficiencyReliable: isSleepEfficiencyReliable(summary),
    insights: insights.slice(0, 4),
  };
}
