/**
 * @file postureKnowledgeSchema.js
 * @description Defines the structured output formats for Layer 3: Knowledge Memory.
 */

export const PostureKnowledgeSchema = {
  createExplanationPackage: () => ({
    explanations: [], // [{ signal: "forward_head", text: "...", sourceViews: ["side"], confidence: "medium" }]
  }),

  createCoachingPackage: () => ({
    coaching: {
      focusArea: null,
      dailyAction: null,
      exerciseGroups: [],
      coachingHint: null,
      urgentGuidance: null // Used for capture guidance
    }
  }),

  createSafetyPackage: () => ({
    safety: {
      limitedMode: false,
      note: null,
      blockedTermsFiltered: false
    }
  }),

  createTrendPackage: () => ({
    trend: {
      overall: "unknown",
      signal: null,
      direction: "unknown"
    }
  }),

  createKnowledgeOutput: () => ({
    ...PostureKnowledgeSchema.createExplanationPackage(),
    ...PostureKnowledgeSchema.createCoachingPackage(),
    ...PostureKnowledgeSchema.createSafetyPackage(),
    ...PostureKnowledgeSchema.createTrendPackage(),
  })
};
