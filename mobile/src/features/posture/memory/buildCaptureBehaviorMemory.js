/**
 * @file buildCaptureBehaviorMemory.js
 * @description Analyzes the user's camera and capture habits to identify recurring weaknesses.
 */

import { PostureApplicationMemorySchema } from "./postureApplicationMemorySchema";

const MEMORY_PREFIX = "[POSTURE_APPLICATION_MEMORY]";

export function buildCaptureBehaviorMemory(historyEntries = [], maxWindow = 5) {
  const captureMemory = PostureApplicationMemorySchema.createCaptureBehaviorMemory();

  if (!historyEntries || historyEntries.length === 0) {
    return captureMemory;
  }

  const recentEntries = [...historyEntries]
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, maxWindow);

  const angleFailures = { front: 0, side: 0, back: 0 };
  const angleSuccesses = { front: 0, side: 0, back: 0 };
  const issues = {};

  let qualityTrendIndex = 0;
  const qualityScores = [];

  recentEntries.forEach(entry => {
    // Collect quality scores for trend (oldest to newest internally if we reversed, but here we just collect)
    qualityScores.unshift(entry.reliabilitySnapshot?.captureQuality ?? 0);

    const coverage = entry.featureCoverageByView || {};
    
    ["front", "side", "back"].forEach(angle => {
      const angleData = coverage[angle];
      
      if (!entry.viewsUsed?.includes(angle)) {
        if (angle === "back") {
          issues["back_missing"] = (issues["back_missing"] || 0) + 1;
        }
      } else if (angleData) {
        if (angleData.coverageRatio < 0.5 || angleData.unusableReason) {
          angleFailures[angle] += 1;
          
          if (angleData.unusableReason) {
            const issueKey = `${angle}_${angleData.unusableReason}`;
            issues[issueKey] = (issues[issueKey] || 0) + 1;
          } else {
            const issueKey = `${angle}_low_quality`;
            issues[issueKey] = (issues[issueKey] || 0) + 1;
          }
        } else {
          angleSuccesses[angle] += 1;
        }
      }
    });
  });

  captureMemory.frequentIssues = issues;

  // Identify recurring weak angles (failed 3+ times, or >50% of the window)
  const weakThreshold = Math.max(3, Math.floor(recentEntries.length * 0.6));
  ["front", "side", "back"].forEach(angle => {
    if (angleFailures[angle] >= weakThreshold) {
      captureMemory.recurringWeakAngles.push(angle);
    }
  });

  // Identify most reliable angle
  let bestAngle = null;
  let maxSuccess = -1;
  ["front", "side", "back"].forEach(angle => {
    if (angleSuccesses[angle] > maxSuccess && angleSuccesses[angle] > 0) {
      maxSuccess = angleSuccesses[angle];
      bestAngle = angle;
    }
  });
  captureMemory.mostReliableAngle = bestAngle;

  // Capture discipline trend
  if (qualityScores.length >= 2) {
    const firstHalfAvg = qualityScores.slice(0, Math.ceil(qualityScores.length / 2)).reduce((a, b) => a + b, 0) / Math.ceil(qualityScores.length / 2);
    const secondHalfAvg = qualityScores.slice(Math.ceil(qualityScores.length / 2)).reduce((a, b) => a + b, 0) / Math.floor(qualityScores.length / 2);
    
    if (secondHalfAvg > firstHalfAvg + 0.1) captureMemory.captureDiscipline = "improving";
    else if (secondHalfAvg < firstHalfAvg - 0.1) captureMemory.captureDiscipline = "worsening";
    else captureMemory.captureDiscipline = "stable";
  } else {
    captureMemory.captureDiscipline = "unknown";
  }

  console.log(`${MEMORY_PREFIX} capture behavior memory built`, {
    weakAngles: captureMemory.recurringWeakAngles,
    issuesCount: Object.keys(captureMemory.frequentIssues).length
  });

  return captureMemory;
}
