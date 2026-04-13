import { FEATURE_SPECS } from "./postureDetectionSchema";
import { normalizeFeatureValue } from "./postureFeatureNormalization";
import {
  getAverageConfidenceForKeypoints,
  getFeatureQuality,
  hasCoordinateLandmark,
  logDetectionMemory,
  round,
  validateFeatureRecord,
} from "./postureDetectionMemoryUtils";

function countPresentSourceKeypoints(extractionState, sourceKeypoints = []) {
  return sourceKeypoints.filter((name) => hasCoordinateLandmark(extractionState?.landmarks?.[name])).length;
}

function calculateGeometricStability(spec, extractionState, measurementState, computed) {
  if (!computed) {
    return 0;
  }

  const sourcePresenceRatio = spec.sourceKeypoints.length > 0
    ? countPresentSourceKeypoints(extractionState, spec.sourceKeypoints) / spec.sourceKeypoints.length
    : 0;
  const viewReliability = Number.isFinite(measurementState?.reliability) ? measurementState.reliability : 0;
  const landmarkCoverage = Number.isFinite(extractionState?.landmarkCount) && extractionState.landmarkCount > 0
    ? Math.min(1, extractionState.landmarkCount / 12)
    : 0;

  return round((sourcePresenceRatio + viewReliability + landmarkCoverage) / 3, 3) ?? 0;
}

function calculateBilateralConsistency(spec, extractionState) {
  const leftNames = spec.sourceKeypoints.filter((name) => name.toLowerCase().startsWith("left"));
  const rightNames = spec.sourceKeypoints.filter((name) => name.toLowerCase().startsWith("right"));

  if (!leftNames.length || !rightNames.length) {
    return 1;
  }

  const leftPresentRatio = leftNames.filter((name) => hasCoordinateLandmark(extractionState?.landmarks?.[name])).length / leftNames.length;
  const rightPresentRatio = rightNames.filter((name) => hasCoordinateLandmark(extractionState?.landmarks?.[name])).length / rightNames.length;

  return round(1 - Math.abs(leftPresentRatio - rightPresentRatio), 3) ?? 0;
}

function calculateFeatureReliabilityScore({ keypointConfidence, geometricStability, bilateralConsistency, computed }) {
  if (!computed) {
    return 0;
  }

  return round(
    (
      (Number.isFinite(keypointConfidence) ? keypointConfidence : 0) * 0.45 +
      geometricStability * 0.35 +
      bilateralConsistency * 0.2
    ),
    3,
  ) ?? 0;
}

function resolveFeatureDropReason(spec, extractionState, measurementState, value) {
  if (Number.isFinite(value)) {
    return null;
  }

  const sourceLandmarks = spec.sourceKeypoints.map((name) => extractionState?.landmarks?.[name]);
  const presentSourceCount = sourceLandmarks.filter((landmark) => hasCoordinateLandmark(landmark)).length;

  if (presentSourceCount === 0) {
    return "source_keypoints_missing";
  }

  if (presentSourceCount < spec.sourceKeypoints.length) {
    return "partial_source_keypoints_missing";
  }

  if (measurementState?.unusableReason) {
    return measurementState.unusableReason;
  }

  return "not_computed";
}

function buildSingleFeatureEvidence(view, spec, extractionState, measurementState) {
  const value = measurementState?.[spec.measurementKey];
  const computed = Number.isFinite(value);
  const keypointConfidence = computed
    ? (
      getAverageConfidenceForKeypoints(extractionState?.landmarks, spec.sourceKeypoints) ??
      measurementState?.reliability ??
      null
    )
    : null;
  const dropReason = resolveFeatureDropReason(spec, extractionState, measurementState, value);
  const normalization = normalizeFeatureValue(spec.feature, value);
  const geometricStability = calculateGeometricStability(spec, extractionState, measurementState, computed);
  const bilateralConsistency = calculateBilateralConsistency(spec, extractionState);
  const reliabilityScore = calculateFeatureReliabilityScore({
    keypointConfidence,
    geometricStability,
    bilateralConsistency,
    computed,
  });
  const record = {
    feature: spec.feature,
    view,
    value: computed ? value : null,
    unit: spec.unit,
    computed,
    confidence: keypointConfidence,
    sourceKeypoints: [...spec.sourceKeypoints],
    quality: getFeatureQuality(reliabilityScore, computed),
    normalizedSeverity: normalization.normalizedSeverity,
    normalizedValue: normalization.normalizedValue,
    keypointConfidence,
    geometricStability,
    bilateralConsistency,
    reliabilityScore,
    dropped: !computed,
    dropReason,
  };

  validateFeatureRecord(record);
  return record;
}

function buildCoverageSummary(featureEvidence) {
  return Object.entries(FEATURE_SPECS).reduce((accumulator, [view, specs]) => {
    const records = featureEvidence.filter((item) => item.view === view);
    const computedFeatures = records.filter((item) => item.computed).length;
    const totalExpectedFeatures = specs.length;
    const droppedFeatures = totalExpectedFeatures - computedFeatures;

    accumulator[view] = {
      totalExpectedFeatures,
      computedFeatures,
      droppedFeatures,
      coverageRatio: round(
        totalExpectedFeatures > 0 ? computedFeatures / totalExpectedFeatures : 0,
        3,
      ),
    };

    return accumulator;
  }, {});
}

export function buildFeatureEvidence({ extraction, measurements }) {
  const featureEvidence = Object.entries(FEATURE_SPECS).flatMap(([view, specs]) => (
    specs.map((spec) => buildSingleFeatureEvidence(
      view,
      spec,
      extraction?.[view],
      measurements?.[view],
    ))
  ));

  logDetectionMemory("feature evidence", {
    computed: featureEvidence.filter((item) => item.computed).map((item) => ({
      feature: item.feature,
      view: item.view,
      value: item.value,
      quality: item.quality,
      normalizedSeverity: item.normalizedSeverity,
      reliabilityScore: item.reliabilityScore,
    })),
    dropped: featureEvidence.filter((item) => item.dropped).map((item) => ({
      feature: item.feature,
      view: item.view,
      dropReason: item.dropReason,
    })),
  });

  return {
    featureEvidence,
    coverageSummary: buildCoverageSummary(featureEvidence),
  };
}
