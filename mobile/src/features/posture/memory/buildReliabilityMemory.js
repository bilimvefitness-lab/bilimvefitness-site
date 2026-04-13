import {
  average,
  confidenceBandFromScore,
  flattenAngleEvidence,
  getProvidedViews,
  logDetectionMemory,
  round,
} from "./postureDetectionMemoryUtils";

function scoreInputEvidence(inputEvidence) {
  const providedViews = getProvidedViews(inputEvidence);
  if (!providedViews.length) {
    return 0;
  }

  return round(average(
    providedViews.map((view) => {
      const evidence = inputEvidence?.[view];
      const precheck = evidence?.precheck ?? {};
      return average([
        precheck.fullBodyConfirmed ? 1 : 0.2,
        precheck.plainBackgroundConfirmed ? 1 : 0.35,
        precheck.earNeckVisibleConfirmed ? 1 : 0.35,
        precheck.fittedClothingConfirmed ? 1 : 0.35,
        evidence?.width && evidence?.height ? 1 : 0.4,
      ]) ?? 0;
    }),
  ), 3) ?? 0;
}

function scoreAngleEvidence(angleEvidence) {
  const angles = flattenAngleEvidence(angleEvidence);
  if (!angles.length) {
    return 0;
  }

  return round(average(
    angles.map((evidence) => average([
      evidence.averageConfidence ?? 0,
      evidence.usable ? 1 : evidence.limitedButUsable ? 0.65 : 0.2,
      evidence.normalizedLandmarkCount > 0
        ? Math.min(1, evidence.normalizedLandmarkCount / 12)
        : 0,
    ]) ?? 0),
  ), 3) ?? 0;
}

function scoreFeatureEvidence(featureEvidence) {
  if (!featureEvidence.length) {
    return 0;
  }

  return round(average(
    featureEvidence.map((feature) => average([
      feature.computed ? 1 : 0,
      feature.reliabilityScore ?? feature.confidence ?? 0,
      feature.keypointConfidence ?? feature.confidence ?? 0,
      feature.geometricStability ?? 0,
      feature.bilateralConsistency ?? 0,
      feature.quality === "high" ? 1 : feature.quality === "medium" ? 0.7 : feature.quality === "low" ? 0.45 : 0,
    ]) ?? 0),
  ), 3) ?? 0;
}

function scoreFeatureCoverage(coverageSummary = {}) {
  const coverages = Object.values(coverageSummary);
  if (!coverages.length) {
    return 0;
  }

  return round(average(coverages.map((item) => item.coverageRatio ?? 0)), 3) ?? 0;
}

function scoreSignalEvidence(signalEvidence) {
  if (!signalEvidence.length) {
    return 0;
  }

  return round(average(
    signalEvidence.map((signal) => average([
      signal.kept ? 1 : 0.2,
      signal.evidenceStrength ?? 0,
      signal.confidence === "high" ? 1 : signal.confidence === "medium" ? 0.7 : 0.45,
      signal.reliabilityContribution ?? 0,
      signal.multiViewSupport?.supportRatio ?? 0,
      signal.uncertain ? 0.35 : 1,
    ]) ?? 0),
  ), 3) ?? 0;
}

function scoreTemporalStability(sessionStability) {
  if (!sessionStability?.eligible) {
    return null;
  }

  return round(
    average([
      sessionStability.score ?? 0.5,
      sessionStability.boost > 0 ? 1 : sessionStability.isConsistent ? 0.7 : 0.35,
    ]),
    3,
  ) ?? 0.5;
}

export function buildReliabilityMemory({
  inputEvidence,
  angleEvidence,
  featureEvidence,
  signalEvidence,
  coverageSummary = {},
  sessionStability = null,
}) {
  const featureCoverageScore = scoreFeatureCoverage(coverageSummary);
  const temporalStability = scoreTemporalStability(sessionStability);
  const baseSignalReliability = scoreSignalEvidence(signalEvidence);
  const reliabilityMemory = {
    captureQuality: scoreInputEvidence(inputEvidence),
    landmarkReliability: scoreAngleEvidence(angleEvidence),
    featureReliability: round(
      average([scoreFeatureEvidence(featureEvidence), featureCoverageScore]),
      3,
    ) ?? 0,
    signalReliability: round(
      average([
        baseSignalReliability,
        ...(Number.isFinite(temporalStability) ? [temporalStability] : []),
      ]),
      3,
    ) ?? 0,
    featureCoverageByView: coverageSummary,
    temporalStability,
    sessionStability,
  };

  const overallInputs = [
    reliabilityMemory.captureQuality,
    reliabilityMemory.landmarkReliability,
    reliabilityMemory.featureReliability,
    reliabilityMemory.signalReliability,
    ...(Number.isFinite(temporalStability) ? [temporalStability] : []),
  ];
  const overallScore = round(average(overallInputs), 3) ?? 0;

  reliabilityMemory.overall = confidenceBandFromScore(overallScore);

  logDetectionMemory("reliability memory", {
    ...reliabilityMemory,
    overallScore,
  });

  return reliabilityMemory;
}
