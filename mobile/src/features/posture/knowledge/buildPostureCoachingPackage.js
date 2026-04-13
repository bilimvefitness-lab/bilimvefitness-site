/**
 * @file buildPostureCoachingPackage.js
 * @description Builds actionable coaching and exercise groups based on state.
 */

import { PostureKnowledgeSchema } from "./postureKnowledgeSchema";
import { PostureRecommendationKnowledge } from "./postureRecommendationKnowledge";
import { PostureCaptureGuidanceKnowledge } from "./postureCaptureGuidanceKnowledge";

const MEMORY_PREFIX = "[POSTURE_KNOWLEDGE_MEMORY]";

export function buildPostureCoachingPackage(postureProfileState, focusEngineResult) {
  const packageData = PostureKnowledgeSchema.createCoachingPackage();
  
  if (!postureProfileState || !postureProfileState.postureProfile) return packageData;

  const { primaryFocus, secondaryFocus } = focusEngineResult || {};

  // Expand base schema slightly to capture both
  packageData.coaching.primaryFocus = null;
  packageData.coaching.secondaryFocus = null;

  if (primaryFocus && PostureRecommendationKnowledge[primaryFocus]) {
    const rec = PostureRecommendationKnowledge[primaryFocus];
    packageData.coaching.primaryFocus = {
      signal: primaryFocus,
      focusArea: rec.focusArea,
      dailyAction: rec.dailyAction,
      exerciseGroups: rec.exerciseGroups,
      coachingHint: rec.coachingHint
    };
  }

  if (secondaryFocus && PostureRecommendationKnowledge[secondaryFocus]) {
    const rec = PostureRecommendationKnowledge[secondaryFocus];
    packageData.coaching.secondaryFocus = {
      signal: secondaryFocus,
      focusArea: rec.focusArea,
      dailyAction: rec.dailyAction, // light coaching: maybe skip subsets, but for now we include it as secondary
      exerciseGroups: rec.exerciseGroups
      // Omitting coachingHint for secondary to keep it light
    };
  }

  // To preserve backward compatibility with the basic schema structure just in case:
  if (packageData.coaching.primaryFocus) {
    packageData.coaching.focusArea = packageData.coaching.primaryFocus.focusArea;
    packageData.coaching.dailyAction = packageData.coaching.primaryFocus.dailyAction;
    packageData.coaching.exerciseGroups = packageData.coaching.primaryFocus.exerciseGroups;
    packageData.coaching.coachingHint = packageData.coaching.primaryFocus.coachingHint;
  }

  // Check capture guidance (Layer 2)
  const weakAngles = postureProfileState.postureProfile.captureState?.weakAngles || [];
  if (weakAngles.length > 0) {
    const angle = weakAngles[0];
    const guidanceInfo = PostureCaptureGuidanceKnowledge.captureIssues[`${angle}_low_quality`] || PostureCaptureGuidanceKnowledge.captureIssues[`${angle}_missing`];
    if (guidanceInfo) {
      packageData.coaching.urgentGuidance = guidanceInfo;
    }
  }

  console.log(`${MEMORY_PREFIX} coaching package built`, {
    focusArea: packageData.coaching.focusArea
  });

  return packageData;
}
