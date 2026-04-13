import { POSTURE_THRESHOLDS } from "../postureThresholds";
import { round } from "./postureDetectionMemoryUtils";

const FEATURE_NORMALIZATION_RULES = Object.freeze({
  shoulderTilt: Object.freeze({
    feature: "shoulderTilt",
    unit: "ratio",
    thresholds: Object.freeze({
      noneMax: POSTURE_THRESHOLDS.signalLevels.shoulderTilt.low,
      lowMax: POSTURE_THRESHOLDS.signalLevels.shoulderTilt.medium,
      mediumMax: POSTURE_THRESHOLDS.signalLevels.shoulderTilt.high,
    }),
  }),
  hipTilt: Object.freeze({
    feature: "hipTilt",
    unit: "ratio",
    thresholds: Object.freeze({
      noneMax: POSTURE_THRESHOLDS.signalLevels.hipTilt.low,
      lowMax: POSTURE_THRESHOLDS.signalLevels.hipTilt.medium,
      mediumMax: POSTURE_THRESHOLDS.signalLevels.hipTilt.high,
    }),
  }),
  headAlignment: Object.freeze({
    feature: "headAlignment",
    unit: "ratio",
    thresholds: Object.freeze({
      noneMax: POSTURE_THRESHOLDS.signalLevels.headAlignment.low,
      lowMax: POSTURE_THRESHOLDS.signalLevels.headAlignment.medium,
      mediumMax: POSTURE_THRESHOLDS.signalLevels.headAlignment.high,
    }),
  }),
  kneeAlignment: Object.freeze({
    feature: "kneeAlignment",
    unit: "ratio",
    thresholds: Object.freeze({
      noneMax: POSTURE_THRESHOLDS.signalLevels.kneeAlignment.low,
      lowMax: POSTURE_THRESHOLDS.signalLevels.kneeAlignment.medium,
      mediumMax: POSTURE_THRESHOLDS.signalLevels.kneeAlignment.high,
    }),
  }),
  forwardHeadOffset: Object.freeze({
    feature: "forwardHeadOffset",
    unit: "ratio",
    thresholds: Object.freeze({
      noneMax: POSTURE_THRESHOLDS.forwardHead.balancedMax,
      lowMax: POSTURE_THRESHOLDS.forwardHead.tendencyMin,
      mediumMax: POSTURE_THRESHOLDS.forwardHead.tendencyMin + 0.03,
    }),
  }),
  spineAngle: Object.freeze({
    feature: "spineAngle",
    unit: "deg",
    thresholds: Object.freeze({
      noneMax: POSTURE_THRESHOLDS.signalLevels.spineAngle.low,
      lowMax: POSTURE_THRESHOLDS.signalLevels.spineAngle.medium,
      mediumMax: POSTURE_THRESHOLDS.signalLevels.spineAngle.high,
    }),
  }),
  shoulderAlignmentOffset: Object.freeze({
    feature: "shoulderAlignmentOffset",
    unit: "ratio",
    thresholds: Object.freeze({
      noneMax: POSTURE_THRESHOLDS.signalLevels.shoulderTilt.low,
      lowMax: POSTURE_THRESHOLDS.signalLevels.shoulderTilt.medium,
      mediumMax: POSTURE_THRESHOLDS.signalLevels.shoulderTilt.high,
    }),
  }),
  hipAlignmentOffset: Object.freeze({
    feature: "hipAlignmentOffset",
    unit: "ratio",
    thresholds: Object.freeze({
      noneMax: POSTURE_THRESHOLDS.signalLevels.hipTilt.low,
      lowMax: POSTURE_THRESHOLDS.signalLevels.hipTilt.medium,
      mediumMax: POSTURE_THRESHOLDS.signalLevels.hipTilt.high,
    }),
  }),
  spineMidlineOffset: Object.freeze({
    feature: "spineMidlineOffset",
    unit: "ratio",
    thresholds: Object.freeze({
      noneMax: POSTURE_THRESHOLDS.spineAlignment.balancedMax,
      lowMax: POSTURE_THRESHOLDS.spineAlignment.deviationMin,
      mediumMax: POSTURE_THRESHOLDS.spineAlignment.deviationMin + 0.03,
    }),
  }),
});

const SEVERITY_WEIGHT = Object.freeze({
  missing: 0,
  none: 0.2,
  low: 0.45,
  medium: 0.72,
  high: 1,
});

function getSeverityFromThresholds(value, thresholds) {
  if (!Number.isFinite(value)) {
    return "missing";
  }

  const absoluteValue = Math.abs(value);
  if (absoluteValue <= thresholds.noneMax) {
    return "none";
  }
  if (absoluteValue <= thresholds.lowMax) {
    return "low";
  }
  if (absoluteValue <= thresholds.mediumMax) {
    return "medium";
  }
  return "high";
}

export function getFeatureNormalizationRule(feature) {
  return FEATURE_NORMALIZATION_RULES[feature] ?? null;
}

export function normalizeFeatureValue(feature, value) {
  const rule = getFeatureNormalizationRule(feature);

  if (!rule) {
    return {
      feature,
      normalizedSeverity: Number.isFinite(value) ? "low" : "missing",
      normalizedValue: Number.isFinite(value) ? round(value, 4) : null,
      reliabilityWeight: Number.isFinite(value) ? SEVERITY_WEIGHT.low : SEVERITY_WEIGHT.missing,
      thresholds: null,
    };
  }

  const normalizedSeverity = getSeverityFromThresholds(value, rule.thresholds);
  return {
    feature,
    normalizedSeverity,
    normalizedValue: Number.isFinite(value) ? round(value, 4) : null,
    reliabilityWeight: SEVERITY_WEIGHT[normalizedSeverity] ?? SEVERITY_WEIGHT.missing,
    thresholds: rule.thresholds,
  };
}

export function getSeverityRank(severity) {
  return SEVERITY_WEIGHT[severity] ?? 0;
}

export { FEATURE_NORMALIZATION_RULES };
