/**
 * @file buildTrendMemory.js
 * @description Analyzes recent history entries to build trend memory (score, signals, confidence).
 */

import { PostureApplicationMemorySchema } from "./postureApplicationMemorySchema";

const MEMORY_PREFIX = "[POSTURE_APPLICATION_MEMORY]";

const SEVERITY_WEIGHT = {
  "high": 3,
  "medium": 2,
  "low": 1,
  "none": 0
};

function calculateSeverityTrend(severities) {
  // severities is expected to be ordered [oldest, ..., newest]
  const valid = severities.filter(s => s !== null && s !== undefined);
  if (valid.length < 2) return "unknown";

  const firstHalf = valid.slice(0, Math.ceil(valid.length / 2));
  const secondHalf = valid.slice(Math.ceil(valid.length / 2));

  const avgFirst = firstHalf.reduce((sum, val) => sum + SEVERITY_WEIGHT[val], 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((sum, val) => sum + SEVERITY_WEIGHT[val], 0) / secondHalf.length;

  if (avgSecond < avgFirst - 0.2) return "improving";
  if (avgSecond > avgFirst + 0.2) return "worsening";
  return "stable";
}

function calculateScoreTrend(scores) {
  // scores ordered [oldest, ..., newest]
  const valid = scores.filter(s => typeof s === "number");
  if (valid.length < 2) return "unknown";

  const first = valid[0];
  const last = valid[valid.length - 1];

  if (last > first + 2) return "improving";
  if (last < first - 2) return "worsening";
  return "stable";
}

function calculateNumericTrend(values) {
  const valid = values.filter(v => typeof v === "number");
  if (valid.length < 2) return "unknown";
  
  const first = valid[0];
  const last = valid[valid.length - 1];

  if (last > first + 0.05) return "improving";
  if (last < first - 0.05) return "worsening";
  return "stable";
}

export function buildTrendMemory(historyEntries = [], maxWindow = 5) {
  const trendMemory = PostureApplicationMemorySchema.createTrendMemory();
  
  if (!historyEntries || historyEntries.length < 2) {
    return trendMemory;
  }

  // Sort by timestamp ascending ([oldest, ..., newest])
  const recentEntries = [...historyEntries]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, maxWindow)
    .reverse();

  // Score Trend
  const scores = recentEntries.map(e => e.score);
  trendMemory.scoreTrend = calculateScoreTrend(scores);

  // Confidence Trend mapping (low=1, medium=2, high=3)
  const confMap = { "low": 1, "medium": 2, "high": 3 };
  const confidences = recentEntries.map(e => confMap[e.confidence] || 1);
  trendMemory.confidenceTrend = calculateNumericTrend(confidences);

  // Capture Quality Trend
  const qualities = recentEntries.map(e => e.reliabilitySnapshot?.captureQuality ?? 0);
  trendMemory.captureQualityTrend = calculateNumericTrend(qualities);

  // Signal Trends
  const signalMap = {};
  recentEntries.forEach((entry, index) => {
    entry.signals.forEach(signal => {
      // Treat "none" also as a valid state to register improvement
      if (!signalMap[signal.type]) {
        signalMap[signal.type] = new Array(recentEntries.length).fill(null);
      }
      signalMap[signal.type][index] = signal.severity;
    });
  });

  Object.keys(signalMap).forEach(type => {
    // Fill gaps linearly or just leave them. The severity trend handles nulls.
    trendMemory.signalTrends[type] = calculateSeverityTrend(signalMap[type]);
  });

  console.log(`${MEMORY_PREFIX} trend memory built`, {
    scoreTrend: trendMemory.scoreTrend,
    signalTrendsCount: Object.keys(trendMemory.signalTrends).length
  });

  return trendMemory;
}
