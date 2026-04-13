/**
 * @file buildPostureTrendPackage.js
 * @description Generates trend reporting.
 */

import { PostureKnowledgeSchema } from "./postureKnowledgeSchema";

const MEMORY_PREFIX = "[POSTURE_KNOWLEDGE_MEMORY]";

export function buildPostureTrendPackage(postureProfileState) {
  const packageData = PostureKnowledgeSchema.createTrendPackage();
  
  if (!postureProfileState || !postureProfileState.postureProfile) return packageData;

  const trendState = postureProfileState.postureProfile.trendState;

  packageData.trend.overall = trendState?.scoreTrend || "unknown";

  // Pick the most relevant signal trend
  const keys = Object.keys(trendState?.signalTrends || {});
  if (keys.length > 0) {
    packageData.trend.signal = keys[0];
    packageData.trend.direction = trendState.signalTrends[keys[0]];
  }

  console.log(`${MEMORY_PREFIX} trend package built`, {
    overall: packageData.trend.overall
  });

  return packageData;
}
