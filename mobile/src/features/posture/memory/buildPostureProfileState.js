/**
 * @file buildPostureProfileState.js
 * @description Master builder that aggregates pattern, trend, baseline, and capture memory into a compact PostureProfileState.
 */

import { PostureApplicationMemorySchema } from "./postureApplicationMemorySchema";
import { buildPatternMemory } from "./buildPatternMemory";
import { buildTrendMemory } from "./buildTrendMemory";
import { buildBaselineMemory } from "./buildBaselineMemory";
import { buildCaptureBehaviorMemory } from "./buildCaptureBehaviorMemory";

const MEMORY_PREFIX = "[POSTURE_APPLICATION_MEMORY]";

export function buildPostureProfileState(historyEntries = []) {
  const profileState = PostureApplicationMemorySchema.createPostureProfileState();

  if (!historyEntries || historyEntries.length === 0) {
    return profileState;
  }

  // Ensure entries are sorted newest first just in case
  const sortedEntries = [...historyEntries].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  
  const latestEntry = sortedEntries[0];

  // 1. Current State
  profileState.postureProfile.currentState = {
    score: latestEntry.score,
    confidence: latestEntry.confidence,
    quality: latestEntry.quality,
    dominantSignals: latestEntry.signals
      .filter(s => s.severity === "high" || s.severity === "medium")
      .map(s => s.type)
  };

  // 2. Baseline State
  profileState.postureProfile.baselineState = buildBaselineMemory(sortedEntries, 5);

  // 3. Trend State
  const trendMemory = buildTrendMemory(sortedEntries, 5);
  profileState.postureProfile.trendState = {
    signalTrends: trendMemory.signalTrends, // Prioritized for LLM weighting
    captureQualityTrend: trendMemory.captureQualityTrend,
    confidenceTrend: trendMemory.confidenceTrend,
    scoreTrend: trendMemory.scoreTrend
  };

  // 4. Pattern State
  const patternMemory = buildPatternMemory(sortedEntries, 5);
  profileState.postureProfile.patternState = {
    persistentSignals: Object.keys(patternMemory.persistentSignals),
    emergingSignals: Object.keys(patternMemory.emergingSignals),
    unstableSignals: Object.keys(patternMemory.unstableSignals)
  };

  // 5. Capture State
  const captureMemory = buildCaptureBehaviorMemory(sortedEntries, 5);
  profileState.postureProfile.captureState = {
    weakAngles: captureMemory.recurringWeakAngles,
    improvingCaptureQuality: captureMemory.captureDiscipline === "improving"
  };

  // 6. Memory Meta
  const msSinceLast = Date.now() - new Date(latestEntry.timestamp).getTime();
  const daysSinceLast = msSinceLast / (1000 * 60 * 60 * 24);
  let freshness = "fresh";
  if (daysSinceLast > 30) freshness = "stale";
  else if (daysSinceLast > 7) freshness = "aging";

  profileState.postureProfile.memoryMeta = {
    historyCount: sortedEntries.length,
    trustedBaseline: profileState.postureProfile.baselineState.trustedBaseline,
    lastAnalysisAt: latestEntry.timestamp,
    profileFreshness: freshness
  };

  console.log(`${MEMORY_PREFIX} posture profile state built`, {
    currentScore: profileState.postureProfile.currentState.score,
    hasTrustedBaseline: profileState.postureProfile.memoryMeta.trustedBaseline,
    persistentCount: profileState.postureProfile.patternState.persistentSignals.length
  });

  return profileState;
}
