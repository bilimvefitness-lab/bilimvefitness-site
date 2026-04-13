/**
 * SleepInsightEngine — produces structured insight codes, never user-facing text.
 *
 * All text output lives in the i18n layer (tr.ts / en.ts  sleep.insight.*).
 * The engine emits typed codes + numeric meta so the UI can interpolate and
 * translate without any domain knowledge of the active language.
 */

import { SleepBedtimeTrend, SleepConsistencyFlag, type SleepDailySummary } from "../models/SleepDailySummary";

export const SleepInsightSeverity = {
  INFO:    "info",
  SUCCESS: "success",
  WARNING: "warning",
} as const;

export type SleepInsightSeverity = (typeof SleepInsightSeverity)[keyof typeof SleepInsightSeverity];

/**
 * A single insight produced by the engine.
 *
 * `type` maps to i18n keys:
 *   sleep.insight.<type>.title
 *   sleep.insight.<type>.message   (interpolated with `meta`)
 *
 * `meta` carries numeric/string values for interpolation only (no language).
 */
export type SleepInsight = {
  id:       string;
  type:     string;
  severity: SleepInsightSeverity;
  meta:     Record<string, unknown>;
};

type SleepConsistencyFlagType = (typeof SleepConsistencyFlag)[keyof typeof SleepConsistencyFlag];

/**
 * Summary snapshot produced for a given day.
 *
 * `shortStatusCode` maps to  sleep.insight.<code>.title  in i18n.
 */
export type SleepInsightSnapshot = {
  shortStatusCode:        string;
  sleepConsistencyFlag:   SleepConsistencyFlagType;
  sleepEfficiency:        number | null;
  isSleepEfficiencyReliable: boolean;
  insights:               SleepInsight[];
};

// ── Pure helpers (no language) ────────────────────────────────────────────────

export function deriveSleepConsistencyFlag(summary: SleepDailySummary | null): SleepConsistencyFlagType {
  if (!summary || summary.bedtimeTrend === SleepBedtimeTrend.INSUFFICIENT_DATA || !summary.bedtimeTrend) {
    return SleepConsistencyFlag.INSUFFICIENT_DATA;
  }
  return summary.bedtimeTrend === SleepBedtimeTrend.LATER
    ? SleepConsistencyFlag.DELAYED
    : SleepConsistencyFlag.STABLE;
}

export function isSleepEfficiencyReliable(summary: SleepDailySummary | null) {
  if (!summary)                          return false;
  if (summary.isManual)                  return false;
  if (summary.timeInBedMinutes == null)  return false;
  return summary.timeInBedMinutes >= summary.totalSleepMinutes && summary.totalSleepMinutes > 0;
}

export function calculateSleepEfficiency(summary: SleepDailySummary | null) {
  if (!summary || !isSleepEfficiencyReliable(summary) || !summary.timeInBedMinutes) return null;
  return Math.round((summary.totalSleepMinutes / summary.timeInBedMinutes) * 100);
}

// ── Main entry point ──────────────────────────────────────────────────────────

export function buildSleepInsightSnapshot(summary: SleepDailySummary | null): SleepInsightSnapshot {
  if (!summary) {
    return {
      shortStatusCode:          "no_data",
      sleepConsistencyFlag:     SleepConsistencyFlag.INSUFFICIENT_DATA,
      sleepEfficiency:          null,
      isSleepEfficiencyReliable:false,
      insights:                 [],
    };
  }

  const insights: SleepInsight[] = [];

  // ── Duration insight ─────────────────────────────────────────────────────
  const hours = Math.floor(summary.totalSleepMinutes / 60);
  const mins  = summary.totalSleepMinutes % 60;
  const durationMeta = { hours, mins };

  if (summary.totalSleepMinutes < 360) {
    insights.push({ id: "duration_low",      type: "duration_low",      severity: SleepInsightSeverity.WARNING, meta: durationMeta });
  } else if (summary.totalSleepMinutes < 420) {
    insights.push({ id: "duration_moderate", type: "duration_moderate", severity: SleepInsightSeverity.INFO,    meta: durationMeta });
  } else if (summary.totalSleepMinutes <= 540) {
    insights.push({ id: "duration_target",   type: "duration_target",   severity: SleepInsightSeverity.SUCCESS, meta: durationMeta });
  } else {
    insights.push({ id: "duration_high",     type: "duration_high",     severity: SleepInsightSeverity.INFO,    meta: durationMeta });
  }

  // ── Trend insight ─────────────────────────────────────────────────────────
  if (
    summary.trend3dAverage != null &&
    summary.trend7dAverage != null &&
    summary.trend3dAverage + 20 < summary.trend7dAverage
  ) {
    insights.push({ id: "trend_down", type: "trend_down", severity: SleepInsightSeverity.WARNING, meta: {} });
  }

  // ── Bedtime trend ─────────────────────────────────────────────────────────
  if (summary.bedtimeTrend === SleepBedtimeTrend.LATER) {
    insights.push({ id: "bedtime_later", type: "bedtime_later", severity: SleepInsightSeverity.INFO, meta: {} });
  }

  // ── Stage data insight ────────────────────────────────────────────────────
  if (summary.isStageDataAvailable) {
    insights.push({
      id:       "stage_available",
      type:     "stage_available",
      severity: SleepInsightSeverity.INFO,
      // meta carries raw numeric values for optional UI interpolation only
      meta: {
        rem:   summary.remMinutes   ?? null,
        deep:  summary.deepMinutes  ?? null,
        awake: summary.awakeMinutes ?? null,
      },
    });
  }

  return {
    shortStatusCode:          insights[0]?.type || "sleep_summary",
    sleepConsistencyFlag:     deriveSleepConsistencyFlag(summary),
    sleepEfficiency:          calculateSleepEfficiency(summary),
    isSleepEfficiencyReliable:isSleepEfficiencyReliable(summary),
    insights:                 insights.slice(0, 4),
  };
}
