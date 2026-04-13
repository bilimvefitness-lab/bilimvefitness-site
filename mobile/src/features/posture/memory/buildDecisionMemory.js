import { DETECTION_VIEWS } from "./postureDetectionSchema";
import {
  getReasonChainItem,
  logDetectionMemory,
  validateDecisionMemory,
} from "./postureDetectionMemoryUtils";

function resolveLimitedModeReason({
  finalStatus,
  confidence,
  signalEvidence,
  angleEvidence,
  noLandmarksDetected,
  reliabilityDrivers,
}) {
  if (noLandmarksDetected) {
    return "no_landmark_evidence";
  }

  if (finalStatus === "degraded") {
    if (confidence === "low") {
      return "confidence_softened";
    }

    if (signalEvidence.some((item) => item.suppressed)) {
      return "partial_signal_evidence";
    }

    if (reliabilityDrivers.some((driver) => driver.includes("_low"))) {
      return "reliability_softened";
    }

    const limitedView = DETECTION_VIEWS.find((view) => angleEvidence?.[view]?.limitedButUsable);
    if (limitedView) {
      return `${limitedView}_limited_but_usable`;
    }
  }

  return finalStatus === "ready" ? null : "manual_retry";
}

function getReliabilityDrivers(reliabilityMemory = {}) {
  const drivers = [
    `captureQuality_${reliabilityMemory.captureQuality >= 0.72 ? "high" : reliabilityMemory.captureQuality >= 0.45 ? "medium" : "low"}`,
    `landmarkReliability_${reliabilityMemory.landmarkReliability >= 0.72 ? "high" : reliabilityMemory.landmarkReliability >= 0.45 ? "medium" : "low"}`,
    `featureReliability_${reliabilityMemory.featureReliability >= 0.72 ? "high" : reliabilityMemory.featureReliability >= 0.45 ? "medium" : "low"}`,
    `signalReliability_${reliabilityMemory.signalReliability >= 0.72 ? "high" : reliabilityMemory.signalReliability >= 0.45 ? "medium" : "low"}`,
  ];

  if (reliabilityMemory?.sessionStability?.eligible) {
    drivers.push(`sessionStability_${reliabilityMemory.sessionStability.boost > 0 ? "boosted" : reliabilityMemory.sessionStability.consistencyLevel ?? "low"}`);
  }

  return drivers;
}

function resolveFinalStatus({
  proposedStatus,
  noLandmarksDetected,
  signalEvidence,
  reliabilityMemory,
  angleEvidence,
  platformLimited,
}) {
  if (noLandmarksDetected) {
    return "fail";
  }

  const keptSignals = signalEvidence.filter((item) => item.kept).length;
  const hasUsableAngle = DETECTION_VIEWS.some((view) => angleEvidence?.[view]?.usable);
  const coverageRatios = Object.values(reliabilityMemory?.featureCoverageByView ?? {}).map((item) => item.coverageRatio ?? 0);
  const weakestCoverage = coverageRatios.length ? Math.min(...coverageRatios) : 0;

  if (platformLimited && keptSignals === 0) {
    return "fail";
  }

  if (
    reliabilityMemory?.signalReliability < 0.35 ||
    (reliabilityMemory?.landmarkReliability < 0.4 && weakestCoverage < 0.5)
  ) {
    return hasUsableAngle ? "degraded" : "fail";
  }

  if (proposedStatus === "degraded") {
    return "degraded";
  }

  if (
    keptSignals > 0 &&
    reliabilityMemory?.featureReliability >= 0.45 &&
    reliabilityMemory?.signalReliability >= 0.4
  ) {
    return "ready";
  }

  return hasUsableAngle ? "degraded" : "fail";
}

export function buildDecisionMemory({
  proposedStatus,
  analysisMode,
  angleEvidence,
  signalEvidence,
  confidence,
  noLandmarksDetected,
  persistable,
  score,
  platformLimited,
  reliabilityMemory,
}) {
  const reliabilityDrivers = getReliabilityDrivers(reliabilityMemory);
  const finalStatus = resolveFinalStatus({
    proposedStatus,
    noLandmarksDetected,
    signalEvidence,
    reliabilityMemory,
    angleEvidence,
    platformLimited,
  });
  const reasonChain = [
    ...DETECTION_VIEWS.map((view) => {
      const evidence = angleEvidence?.[view];
      if (!evidence) {
        return getReasonChainItem(view, "missing_input");
      }
      if (evidence.usable && evidence.limitedButUsable) {
        return getReasonChainItem(view, "limited_but_usable");
      }
      if (evidence.usable) {
        return getReasonChainItem(view, "usable");
      }
      if (evidence.normalizedLandmarkCount > 0) {
        return getReasonChainItem(view, "partial_evidence");
      }
      return getReasonChainItem(view, "unusable");
    }),
    signalEvidence.some((item) => item.kept)
      ? "signal_evidence_present"
      : "signal_evidence_suppressed",
    ...reliabilityDrivers,
    confidence === "low" ? "confidence_softened" : "confidence_stable",
    platformLimited ? "platform_limited" : "platform_supported",
  ];

  const limitedMode = finalStatus === "degraded";
  const decisionMemory = {
    finalStatus,
    analysisMode,
    reasonChain,
    noLandmarksDetected,
    limitedMode,
    reliabilityDrivers,
    limitedModeReason: resolveLimitedModeReason({
      finalStatus,
      confidence,
      signalEvidence,
      angleEvidence,
      noLandmarksDetected,
      reliabilityDrivers,
    }),
    scoreEligible: finalStatus !== "fail" && Number.isFinite(Number(score)),
    persistable: finalStatus === "ready" && Boolean(persistable),
  };

  validateDecisionMemory(decisionMemory);
  logDetectionMemory("decision memory", decisionMemory);
  return decisionMemory;
}
