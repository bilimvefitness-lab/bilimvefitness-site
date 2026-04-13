export const POSTURE_THRESHOLDS = Object.freeze({
  landmarks: {
    minConfidence: 0.35,
    minimumAnalysisCount: 4,
  },
  frontView: {
    frontLikeShoulderSpanMin: 0.13,
    frontLikeHipSpanMin: 0.1,
    sideLikeShoulderSpanMax: 0.08,
    sideLikeHipSpanMax: 0.07,
  },
  sideView: {
    frontLikeShoulderSpanMin: 0.22,
    frontLikeHipSpanMin: 0.17,
    sideLikeShoulderSpanMax: 0.14,
    sideLikeHipSpanMax: 0.12,
  },
  quality: {
    lowReliabilityMax: 0.38,
  },
  signalLevels: {
    shoulderTilt: {
      low: 0.005,
      medium: 0.02,
      high: 0.04,
    },
    headAlignment: {
      low: 0.015,
      medium: 0.035,
      high: 0.06,
    },
    hipTilt: {
      low: 0.005,
      medium: 0.018,
      high: 0.035,
    },
    kneeAlignment: {
      low: 0.005,
      medium: 0.018,
      high: 0.035,
    },
    spineAngle: {
      low: 4,
      medium: 10,
      high: 18,
    },
  },
  shoulderAsymmetry: {
    reliabilityMin: 0.4,
    balancedMax: 0.005,
    asymmetryMin: 0.02,
  },
  forwardHead: {
    reliabilityMin: 0.4,
    balancedMax: 0.02,
    tendencyMin: 0.05,
  },
  upperTorsoAngle: {
    reliabilityMin: 0.4,
    lowMax: 6,
    mediumMin: 10,
    highMin: 16,
  },
  spineAlignment: {
    balancedMax: 0.015, // 1.5% horizontal offset
    deviationMin: 0.04, // 4% horizontal offset
  },
  confidence: {
    medium: {
      reliabilityMin: 0.42,
      measuredSignalsMin: 1,
      usableViewsMin: 1,
    },
    high: {
      reliabilityMin: 0.65,
      measuredSignalsMin: 2,
      usableViewsMin: 2,
    },
  },
  score: {
    base: 100,
    lowSignalFallback: 88,
    floors: {
      low: 82,
      medium: 76,
      high: 68,
    },
    penalties: {
      forwardHead: 5,
      shoulderAsymmetry: 3,
      spineDeviation: 4,
      kyphosisMedium: 4,
      kyphosisHigh: 8,
      mediumConfidence: 2,
      lowConfidence: 1,
    },
  },
  hardening: {
    consistencyThreshold: 0.18, // 18% max change in shoulder span ratio
    consistencyHighMax: 0.08, // ≤8% drift → high consistency
    consistencyMediumMax: 0.18, // ≤18% drift → medium consistency
    // >18% → low consistency
    levelUpRequirement: 2, // 2 consecutive improvements to level up
    minQualityScore: 40,
    identityDamping: true,
  },
  accuracy: {
    low: 40,
    medium: 65,
    high: 85,
  },
});
