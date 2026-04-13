export const POSTURE_SIGNAL_MAP = Object.freeze({
  forward_head: Object.freeze({
    type: "forward_head",
    requiredFeatures: Object.freeze(["forwardHeadOffset", "spineAngle"]),
    fallbackFeatures: Object.freeze(["forwardHeadOffset"]),
    minEvidence: 1,
    sourceViews: Object.freeze(["side"]),
    weight: 0.9,
    scoreImpact: 7,
    defaultSeverityRules: Object.freeze({
      strategy: "max_feature_severity",
      promoteWhen: Object.freeze({
        primaryFeature: "forwardHeadOffset",
        primarySeverityAtLeast: "medium",
        supportingFeature: "spineAngle",
        supportingSeverityAtLeast: "low",
        targetSeverity: "high",
      }),
    }),
    suppressionRules: Object.freeze({
      reliabilityFloor: 0.32,
      allowFallbackOnly: true,
      suppressWeakFallbackOnly: true,
      minSourceViews: 1,
    }),
  }),
  thoracic_rounding_tendency: Object.freeze({
    type: "thoracic_rounding_tendency",
    requiredFeatures: Object.freeze(["spineAngle"]),
    fallbackFeatures: Object.freeze(["forwardHeadOffset"]),
    minEvidence: 1,
    sourceViews: Object.freeze(["side"]),
    weight: 1,
    scoreImpact: 9,
    defaultSeverityRules: Object.freeze({
      strategy: "max_feature_severity",
    }),
    suppressionRules: Object.freeze({
      reliabilityFloor: 0.34,
      allowFallbackOnly: true,
      suppressWeakFallbackOnly: true,
      minSourceViews: 1,
    }),
  }),
  shoulder_asymmetry: Object.freeze({
    type: "shoulder_asymmetry",
    requiredFeatures: Object.freeze(["shoulderTilt"]),
    fallbackFeatures: Object.freeze(["shoulderTilt"]),
    minEvidence: 1,
    sourceViews: Object.freeze(["front", "back"]),
    weight: 0.7,
    scoreImpact: 5,
    defaultSeverityRules: Object.freeze({
      strategy: "max_feature_severity",
    }),
    suppressionRules: Object.freeze({
      reliabilityFloor: 0.3,
      allowFallbackOnly: true,
      suppressWeakFallbackOnly: false,
      minSourceViews: 1,
      conflictRule: "direction_mismatch",
    }),
  }),
  spinal_alignment_variance: Object.freeze({
    type: "spinal_alignment_variance",
    requiredFeatures: Object.freeze(["spineMidlineOffset", "spineAngle"]),
    fallbackFeatures: Object.freeze(["spineMidlineOffset"]),
    minEvidence: 1,
    sourceViews: Object.freeze(["back"]),
    weight: 0.8,
    scoreImpact: 6,
    defaultSeverityRules: Object.freeze({
      strategy: "max_feature_severity",
    }),
    suppressionRules: Object.freeze({
      reliabilityFloor: 0.34,
      allowFallbackOnly: true,
      suppressWeakFallbackOnly: true,
      minSourceViews: 1,
    }),
  }),
  pelvic_asymmetry_tendency: Object.freeze({
    type: "pelvic_asymmetry_tendency",
    requiredFeatures: Object.freeze(["hipTilt", "hipAlignmentOffset"]),
    fallbackFeatures: Object.freeze(["hipTilt"]),
    minEvidence: 1,
    sourceViews: Object.freeze(["front", "side", "back"]),
    weight: 0.55,
    scoreImpact: 4,
    defaultSeverityRules: Object.freeze({
      strategy: "max_feature_severity",
    }),
    suppressionRules: Object.freeze({
      reliabilityFloor: 0.32,
      allowFallbackOnly: true,
      suppressWeakFallbackOnly: true,
      minSourceViews: 1,
    }),
  }),
});

export function getPostureSignalDefinitions() {
  return Object.values(POSTURE_SIGNAL_MAP);
}
