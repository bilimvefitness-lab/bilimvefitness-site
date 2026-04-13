import { getPostureSignalDefinitions } from "./postureSignalMap";
import {
  average,
  confidenceBandFromScore,
  logDetectionMemory,
  round,
  severityWeight,
  validateSignalRecord,
} from "./postureDetectionMemoryUtils";
import { getSeverityRank } from "./postureFeatureNormalization";

function collectSignalFeatureRecords(featureEvidence, signalDefinition) {
  return featureEvidence.filter((item) => (
    signalDefinition.sourceViews.includes(item.view) &&
    (
      signalDefinition.requiredFeatures.includes(item.feature) ||
      signalDefinition.fallbackFeatures.includes(item.feature)
    )
  ));
}

function getStrongestFeatureSeverity(featureRecords) {
  return featureRecords.reduce((strongest, record) => (
    getSeverityRank(record.normalizedSeverity) > getSeverityRank(strongest)
      ? record.normalizedSeverity
      : strongest
  ), "none");
}

function shouldPromoteSeverity(signalDefinition, featureRecords, currentSeverity) {
  const promoteWhen = signalDefinition?.defaultSeverityRules?.promoteWhen;
  if (!promoteWhen) {
    return currentSeverity;
  }

  const primary = featureRecords.find((record) => record.feature === promoteWhen.primaryFeature);
  const supporting = featureRecords.find((record) => record.feature === promoteWhen.supportingFeature);

  if (
    primary &&
    supporting &&
    getSeverityRank(primary.normalizedSeverity) >= getSeverityRank(promoteWhen.primarySeverityAtLeast) &&
    getSeverityRank(supporting.normalizedSeverity) >= getSeverityRank(promoteWhen.supportingSeverityAtLeast)
  ) {
    return promoteWhen.targetSeverity;
  }

  return currentSeverity;
}

function hasDirectionalConflict(signalType, measurements) {
  if (signalType !== "shoulder_asymmetry") {
    return false;
  }

  const frontDirection = measurements?.front?.shoulderAsymmetryDirection;
  const backDirection = measurements?.back?.shoulderAsymmetryDirection;
  if (!frontDirection || !backDirection || frontDirection === "unknown" || backDirection === "unknown") {
    return false;
  }

  return frontDirection !== backDirection;
}

function getConflictReason(signalDefinition, measurements, computedFeatureRecords) {
  if (hasDirectionalConflict(signalDefinition.type, measurements)) {
    return "direction_mismatch";
  }

  if (computedFeatureRecords.length >= 2) {
    const severities = computedFeatureRecords.map((record) => getSeverityRank(record.normalizedSeverity));
    if (Math.max(...severities) - Math.min(...severities) >= 0.55) {
      return "severity_divergence";
    }
  }

  return null;
}

function buildMultiViewSupport(signalDefinition, sourceViews, conflictReason) {
  const expectedViews = signalDefinition.sourceViews.length;
  const supportingViews = sourceViews.length;
  const supportRatio = expectedViews > 0 ? supportingViews / expectedViews : 0;

  let agreement = "single_view";
  if (expectedViews > 1) {
    agreement = conflictReason
      ? "conflicted"
      : supportRatio >= 1
        ? "confirmed"
        : supportingViews > 0
          ? "partial"
          : "missing";
  }

  const confidenceBoost = conflictReason
    ? -0.08
    : expectedViews <= 1
      ? 0
      : supportRatio >= 1
        ? 0.12
        : supportRatio >= 0.5
          ? 0.06
          : 0;

  return {
    expectedViews,
    supportingViews,
    supportRatio: round(supportRatio, 3) ?? 0,
    agreement,
    confidenceBoost,
  };
}

function resolveSuppression({
  signalDefinition,
  computedFeatureRecords,
  fallbackOnly,
  evidenceStrength,
  severity,
  sourceViews,
  conflictReason,
}) {
  if (!computedFeatureRecords.length) {
    return "missing_source_features";
  }

  if (computedFeatureRecords.length < signalDefinition.minEvidence) {
    return "insufficient_multi_view_support";
  }

  if ((sourceViews?.length ?? 0) < (signalDefinition?.suppressionRules?.minSourceViews ?? 1)) {
    return "insufficient_multi_view_support";
  }

  if (conflictReason && evidenceStrength < ((signalDefinition?.suppressionRules?.reliabilityFloor ?? 0.3) + 0.05)) {
    return "conflicting_feature_evidence";
  }

  if (evidenceStrength < (signalDefinition?.suppressionRules?.reliabilityFloor ?? 0.3)) {
    return "low_signal_reliability";
  }

  if (
    fallbackOnly &&
    signalDefinition?.suppressionRules?.suppressWeakFallbackOnly &&
    (severity === "low" || severity === "none")
  ) {
    return "weak_measurement_only";
  }

  return null;
}

function buildSingleSignalEvidence(signalDefinition, featureEvidence, measurements) {
  const sourceFeatureRecords = collectSignalFeatureRecords(featureEvidence, signalDefinition);
  const computedFeatureRecords = sourceFeatureRecords.filter((item) => item.computed);
  const requiredFeatureRecords = computedFeatureRecords.filter((item) => (
    signalDefinition.requiredFeatures.includes(item.feature)
  ));
  const fallbackFeatureRecords = computedFeatureRecords.filter((item) => (
    signalDefinition.fallbackFeatures.includes(item.feature)
  ));
  const sourceViews = Array.from(new Set(computedFeatureRecords.map((item) => item.view)));

  let normalizedSeverity = getStrongestFeatureSeverity(computedFeatureRecords);
  normalizedSeverity = shouldPromoteSeverity(signalDefinition, computedFeatureRecords, normalizedSeverity);

  const featureConfidence = average(computedFeatureRecords.map((item) => item.reliabilityScore ?? item.confidence));
  const conflictReason = getConflictReason(signalDefinition, measurements, computedFeatureRecords);
  const multiViewSupport = buildMultiViewSupport(signalDefinition, sourceViews, conflictReason);
  const evidenceStrength = round(
    Math.min(
      1,
      Math.max(
        0,
        (
          average([
            featureConfidence ?? 0,
            average(computedFeatureRecords.map((item) => severityWeight(item.normalizedSeverity))) ?? 0,
            multiViewSupport.supportRatio,
          ]) ?? 0
        ) + multiViewSupport.confidenceBoost,
      ),
    ),
    3,
  ) ?? 0;
  const fallbackOnly = requiredFeatureRecords.length === 0 && fallbackFeatureRecords.length > 0;
  const resolvedSuppressionReason = resolveSuppression({
    signalDefinition,
    computedFeatureRecords,
    fallbackOnly,
    evidenceStrength,
    severity: normalizedSeverity,
    sourceViews,
    conflictReason,
  });
  const suppressionReason = resolvedSuppressionReason ?? (normalizedSeverity === "none" ? "below_signal_threshold" : null);
  const suppressed = Boolean(suppressionReason);
  const kept = !suppressed;
  const uncertain = Boolean(conflictReason) || (kept && evidenceStrength < 0.45);

  const record = {
    type: signalDefinition.type,
    severity: normalizedSeverity,
    normalizedSeverity,
    confidence: confidenceBandFromScore(evidenceStrength),
    sourceViews,
    sourceFeatures: Array.from(new Set(computedFeatureRecords.map((item) => item.feature))),
    evidenceStrength,
    multiViewSupport,
    confidenceBoost: multiViewSupport.confidenceBoost,
    kept,
    suppressed,
    suppressionReason,
    conflictReason,
    uncertain,
    weight: signalDefinition.weight ?? 0.5,
    scoreImpact: signalDefinition.scoreImpact ?? 0,
    reliabilityContribution: round(
      average([evidenceStrength, featureConfidence ?? 0]),
      3,
    ) ?? 0,
  };

  validateSignalRecord(record);
  return record;
}

export function buildSignalEvidence({ featureEvidence, measurements }) {
  const signalEvidence = getPostureSignalDefinitions().map((signalDefinition) => (
    buildSingleSignalEvidence(signalDefinition, featureEvidence, measurements)
  ));

  logDetectionMemory("signal evidence", signalEvidence.map((item) => ({
    type: item.type,
    severity: item.severity,
    normalizedSeverity: item.normalizedSeverity,
    multiViewSupport: item.multiViewSupport,
    confidenceBoost: item.confidenceBoost,
    kept: item.kept,
    suppressed: item.suppressed,
    suppressionReason: item.suppressionReason,
    conflictReason: item.conflictReason,
    uncertain: item.uncertain,
    reliabilityContribution: item.reliabilityContribution,
  })));

  return signalEvidence;
}
