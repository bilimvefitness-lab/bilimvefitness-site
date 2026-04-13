/**
 * @file postureApplicationMemorySchema.js
 * @description Defines the core data structures for Layer 2: Application Memory.
 * These structures map the transition from single-analysis (Layer 1) to historical user-awareness (Layer 2).
 */

/**
 * @typedef {Object} PostureApplicationMemorySchema
 */
const PostureApplicationMemorySchema = {
  createAnalysisHistoryEntry: () => ({
    id: "",
    timestamp: "",
    status: "",
    analysisMode: "ml",
    score: null,
    quality: "low",
    confidence: "low",
    viewsUsed: [],
    limitedMode: false,
    signals: [], // e.g., [{ type: "forward_head", severity: "medium" }]
    reliabilitySnapshot: {
      captureQuality: 0,
      landmarkReliability: 0,
      featureReliability: 0,
      signalReliability: 0,
      overall: "low",
    },
    featureCoverageByView: {}, // e.g., { front: { coverageRatio: 1 } }
    detectionMemoryRef: {
      decisionStatus: "",
      evidenceSummary: [],
      reasonChain: [],
    },
    captureIssueSummary: [], // Summary of capture issues for this specific run
  }),

  createPatternMemory: () => ({
    persistentSignals: {}, // e.g., { forward_head: { seenInLast: 5, severityPattern: [], persistence: "high" } }
    intermittentSignals: {},
    unstableSignals: {},
    emergingSignals: {},
  }),

  createTrendMemory: () => ({
    scoreTrend: "unknown", // "improving" | "stable" | "worsening" | "unknown"
    signalTrends: {}, // e.g., { forward_head: "improving" }
    confidenceTrend: "unknown",
    captureQualityTrend: "unknown",
  }),

  createBaselineMemory: () => ({
    baselineWindow: 0,
    baselineScore: null,
    baselineSignals: {},
    baselineReliability: "low",
    trustedBaseline: false,
  }),

  createCaptureBehaviorMemory: () => ({
    frequentIssues: {}, // e.g., { side_low_quality: 4 }
    recurringWeakAngles: [],
    mostReliableAngle: null,
    captureDiscipline: "unknown",
  }),

  createPostureProfileState: () => ({
    postureProfile: {
      currentState: {
        score: null,
        confidence: "low",
        quality: "low",
        dominantSignals: [],
      },
      baselineState: PostureApplicationMemorySchema.createBaselineMemory(),
      trendState: PostureApplicationMemorySchema.createTrendMemory(),
      patternState: {
        persistentSignals: [],
        emergingSignals: [],
        unstableSignals: [],
      },
      captureState: {
        weakAngles: [],
        improvingCaptureQuality: false,
      },
      memoryMeta: {
        historyCount: 0,
        trustedBaseline: false,
        lastAnalysisAt: null,
        profileFreshness: "unknown", // e.g. "fresh", "stale"
      },
    },
  }),
};

export { PostureApplicationMemorySchema };
