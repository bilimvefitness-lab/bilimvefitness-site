/**
 * @file buildBaselineMemory.js
 * @description Computes a trusted posture baseline by weighting recent historical entries.
 */

import { PostureApplicationMemorySchema } from "./postureApplicationMemorySchema";

const MEMORY_PREFIX = "[POSTURE_APPLICATION_MEMORY]";

function calculateEntryWeight(entry) {
  let weight = 1.0;

  // Down-weight low confidence
  if (entry.confidence === "low") weight *= 0.4;
  else if (entry.confidence === "medium") weight *= 0.8;

  // Down-weight poor quality
  if (entry.quality === "low") weight *= 0.5;
  else if (entry.quality === "medium") weight *= 0.8;

  // Preserve limited mode but reduce influence
  if (entry.limitedMode) weight *= 0.5;

  // Zero-weight failed entries
  if (entry.status === "fail") weight = 0;

  return weight;
}

export function buildBaselineMemory(historyEntries = [], baselineWindowTarget = 5) {
  const baselineMemory = PostureApplicationMemorySchema.createBaselineMemory();

  if (!historyEntries || historyEntries.length === 0) {
    return baselineMemory;
  }

  // Use up to 'baselineWindowTarget' most recent entries
  const recentEntries = [...historyEntries]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, baselineWindowTarget);

  let totalWeight = 0;
  let weightedScoreSum = 0;
  let weightedReliabilitySum = 0;
  let validCount = 0;

  const signalWeights = {};

  recentEntries.forEach(entry => {
    const weight = calculateEntryWeight(entry);
    
    if (weight > 0 && typeof entry.score === "number") {
      validCount++;
      totalWeight += weight;
      weightedScoreSum += entry.score * weight;
      
      const relSnapshot = entry.reliabilitySnapshot?.overall === "high" ? 1.0 
                        : entry.reliabilitySnapshot?.overall === "medium" ? 0.6 
                        : 0.2;
      weightedReliabilitySum += relSnapshot * weight;

      // Accumulate signal weights
      entry.signals.forEach(signal => {
        if (signal.severity !== "none") {
          if (!signalWeights[signal.type]) {
            signalWeights[signal.type] = { weightSum: 0, severityPriority: 0 };
          }
          signalWeights[signal.type].weightSum += weight;

          // Keep track of what the typical severity is (simple accumulation for now)
          const sevVal = signal.severity === "high" ? 3 : signal.severity === "medium" ? 2 : 1;
          signalWeights[signal.type].severityPriority += sevVal * weight;
        }
      });
    }
  });

  if (totalWeight > 0) {
    baselineMemory.baselineScore = Math.round(weightedScoreSum / totalWeight);
    const avgRel = weightedReliabilitySum / totalWeight;
    baselineMemory.baselineReliability = avgRel > 0.8 ? "high" : avgRel > 0.4 ? "medium" : "low";
  }

  // A signal becomes a baseline signal if its accumulated weight is significant
  // i.e., it appeared frequently in trusted entries.
  Object.keys(signalWeights).forEach(type => {
    const sig = signalWeights[type];
    // If it has at least 40% of the total available weight, it's a baseline signal
    if (sig.weightSum > totalWeight * 0.4 && totalWeight > 0) {
      const avgSev = sig.severityPriority / sig.weightSum;
      baselineMemory.baselineSignals[type] = avgSev > 2.5 ? "high" : avgSev > 1.5 ? "medium" : "low";
    }
  });

  baselineMemory.baselineWindow = validCount;

  // Minimum 3 valid, somewhat reliable entries required for a trusted baseline
  const IS_TRUSTED = validCount >= 3 && baselineMemory.baselineReliability !== "low";
  baselineMemory.trustedBaseline = IS_TRUSTED;

  console.log(`${MEMORY_PREFIX} baseline memory built`, {
    score: baselineMemory.baselineScore,
    trusted: baselineMemory.trustedBaseline,
    window: baselineMemory.baselineWindow
  });

  return baselineMemory;
}
