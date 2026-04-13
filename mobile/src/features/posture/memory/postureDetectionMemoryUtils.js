import { POSTURE_THRESHOLDS } from "../postureThresholds";
import { ANGLE_KEYPOINTS, DETECTION_VIEWS } from "./postureDetectionSchema";

export const DETECTION_MEMORY_LOG_PREFIX = "[POSTURE_DETECTION_MEMORY]";
const IS_DEV = typeof __DEV__ !== "undefined" ? __DEV__ : process.env.NODE_ENV !== "production";

export function round(value, precision = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function average(values) {
  if (!Array.isArray(values) || !values.length) {
    return null;
  }

  const valid = values.filter((value) => Number.isFinite(value));
  if (!valid.length) {
    return null;
  }

  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function getUriScheme(uri) {
  if (typeof uri !== "string" || !uri.includes(":")) {
    return "unknown";
  }

  return uri.split(":")[0].toLowerCase();
}

export function hasCoordinateLandmark(landmark) {
  return Boolean(
    landmark &&
    Number.isFinite(landmark.x) &&
    Number.isFinite(landmark.y),
  );
}

export function isReliableLandmark(landmark) {
  if (!hasCoordinateLandmark(landmark)) {
    return false;
  }

  return (
    landmark.confidence == null ||
    landmark.confidence >= POSTURE_THRESHOLDS.landmarks.minConfidence
  );
}

export function toBand(value) {
  if (!Number.isFinite(value)) {
    return "low";
  }

  if (value >= 0.72) {
    return "high";
  }

  if (value >= 0.45) {
    return "medium";
  }

  return "low";
}

export function getFeatureQuality(confidence, computed) {
  if (!computed) {
    return "missing";
  }

  if (!Number.isFinite(confidence)) {
    return "low";
  }

  if (confidence >= 0.72) {
    return "high";
  }

  if (confidence >= 0.45) {
    return "medium";
  }

  return "low";
}

export function severityWeight(severity) {
  switch (severity) {
    case "high":
      return 1;
    case "medium":
      return 0.72;
    case "low":
      return 0.45;
    case "none":
      return 0.2;
    default:
      return 0;
  }
}

export function confidenceBandFromScore(value) {
  return toBand(value);
}

export function getAngleKeypoints(view) {
  return ANGLE_KEYPOINTS[view] ?? [];
}

export function getKeypointState(landmarks = {}, view) {
  const names = getAngleKeypoints(view);
  const present = names.filter((name) => hasCoordinateLandmark(landmarks?.[name]));
  const missing = names.filter((name) => !hasCoordinateLandmark(landmarks?.[name]));
  const reliable = names.filter((name) => isReliableLandmark(landmarks?.[name]));
  const weak = names.filter((name) => (
    hasCoordinateLandmark(landmarks?.[name]) && !isReliableLandmark(landmarks?.[name])
  ));

  return {
    present,
    missing,
    reliable,
    weak,
  };
}

export function getAverageConfidenceForKeypoints(landmarks = {}, keypointNames = []) {
  return round(
    average(
      keypointNames
        .map((name) => landmarks?.[name]?.confidence)
        .filter((value) => Number.isFinite(value)),
    ),
    3,
  );
}

export function buildPrecheckConfirmations(validationItems = {}) {
  return {
    fullBodyConfirmed: Boolean(validationItems.fullBody),
    plainBackgroundConfirmed: Boolean(validationItems.background),
    earNeckVisibleConfirmed: Boolean(validationItems.visibility),
    fittedClothingConfirmed: Boolean(validationItems.clothing),
  };
}

export function getProvidedViews(inputEvidence) {
  return DETECTION_VIEWS.filter((view) => Boolean(inputEvidence?.[view]?.uri));
}

export function logDetectionMemory(step, payload) {
  console.log(`${DETECTION_MEMORY_LOG_PREFIX} ${step}`, payload);
}

export function warnDetectionMemory(message, payload = null) {
  if (!IS_DEV) {
    return;
  }

  console.warn(`${DETECTION_MEMORY_LOG_PREFIX} ${message}`, payload ?? {});
}

export function flattenAngleEvidence(angleEvidence) {
  return DETECTION_VIEWS.map((view) => angleEvidence?.[view]).filter(Boolean);
}

export function groupFeatureEvidenceByView(featureEvidence = []) {
  return featureEvidence.reduce((accumulator, item) => {
    const bucket = accumulator[item.view] ?? [];
    bucket.push(item);
    accumulator[item.view] = bucket;
    return accumulator;
  }, {});
}

export function getReasonChainItem(view, label) {
  return `${view}_${label}`;
}

export function validateFeatureRecord(record) {
  if (record?.computed === false && !record?.dropReason) {
    warnDetectionMemory("feature record missing dropReason", record);
  }
}

export function validateSignalRecord(record) {
  if (record?.suppressed === true && !record?.suppressionReason) {
    warnDetectionMemory("signal record missing suppressionReason", record);
  }
}

export function validateAngleRecord(record, featureCoverage) {
  if (!record) {
    return;
  }

  if (record.usable === false && record.usableReason) {
    warnDetectionMemory("angle marked unusable with usableReason", record);
  }

  if (record.usable === true && (!featureCoverage || featureCoverage.totalExpectedFeatures <= 0)) {
    warnDetectionMemory("usable angle has no feature coverage", {
      angle: record,
      featureCoverage,
    });
  }

  if (record.usable === true && featureCoverage && featureCoverage.computedFeatures <= 0) {
    warnDetectionMemory("usable angle has zero computed features", {
      angle: record,
      featureCoverage,
    });
  }
}

export function validateDecisionMemory(decisionMemory) {
  if (!Array.isArray(decisionMemory?.reasonChain) || decisionMemory.reasonChain.length === 0) {
    warnDetectionMemory("decision memory missing reasonChain", decisionMemory);
  }
}
