import { Platform } from "react-native";
import { extractPostureLandmarks } from "./postureLandmarkExtractor";
import { derivePostureMeasurements, calculateConsistency } from "./postureMeasurements";
import { selectPostureRecommendation } from "./postureRecommendationSelector";
import { POSTURE_THRESHOLDS } from "./postureThresholds";
import { buildInputEvidence } from "./memory/buildInputEvidence";
import { buildAngleEvidence } from "./memory/buildAngleEvidence";
import { buildFeatureEvidence } from "./memory/buildFeatureEvidence";
import { buildSignalEvidence } from "./memory/buildSignalEvidence";
import { buildDecisionMemory } from "./memory/buildDecisionMemory";
import { buildReliabilityMemory } from "./memory/buildReliabilityMemory";
import { createBaseDetectionResult } from "./memory/postureDetectionSchema";
import { getProvidedViews } from "./memory/postureDetectionMemoryUtils";
import { analyzePostureOnServer, mapServerResultToEngineFormat } from "./postureServerAnalysis";

const DEBUG_PREFIX = "[POSTURE_FIX_DEBUG]";

const EMPTY_FINDINGS = Object.freeze({
  kyphosis: "unknown",
  forwardHead: null,
  shoulderAsymmetry: "unknown",
  spineAlignment: "unknown",
  lordosis: "unknown",
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cloneFindings() {
  return { ...EMPTY_FINDINGS };
}

function createBaseResult(overrides = {}) {
  return {
    ...createBaseDetectionResult(),
    findings: cloneFindings(),
    summary: ["insufficient_visibility"],
    recommendation: "capture_retry",
    persistable: false,
    provider: "local_posture_engine",
    measurements: null,
    diagnostics: {
      totalLandmarkCount: 0,
      hasLandmarkEvidence: false,
      limitedButUsable: false,
      noLandmarksDetected: true,
      alertReason: "missing_required_images",
    },
    ...overrides,
  };
}

export function createEmptyPostureAnalysisResult(overrides = {}) {
  return createBaseResult(overrides);
}

function hasShoulderImbalance(findings) {
  return (
    findings?.shoulderAsymmetry !== "none" &&
    findings?.shoulderAsymmetry !== "unknown"
  );
}

function hasKyphosisTendency(findings) {
  return findings?.kyphosis === "medium" || findings?.kyphosis === "high";
}

function getSignalPenaltyMultiplier(severity) {
  switch (severity) {
    case "high":
      return 1;
    case "medium":
      return 0.72;
    case "low":
      return 0.42;
    default:
      return 0;
  }
}

function isPlatformLimited(extraction) {
  return (
    extraction?.analysisMode === "heuristic" ||
    extraction?.provider === "heuristic" ||
    extraction?.provider === "unsupported" ||
    extraction?.front?.provider === "heuristic" ||
    extraction?.side?.provider === "heuristic" ||
    extraction?.back?.provider === "heuristic" ||
    extraction?.front?.status === "unsupported" ||
    extraction?.side?.status === "unsupported"
  );
}

function resolveForwardHead(measurements) {
  if (!measurements?.side?.usable) {
    return null;
  }

  const { forwardHeadCandidate, upperTorsoAngleCandidate, reliability } = measurements.side;

  if (forwardHeadCandidate === false) {
    return false;
  }

  if (forwardHeadCandidate === false && upperTorsoAngleCandidate === "low") {
    return false;
  }

  const hasStrongSignal = forwardHeadCandidate === true && upperTorsoAngleCandidate !== "low";
  const isExtremelyReliable = reliability >= POSTURE_THRESHOLDS.forwardHead.reliabilityMin + 0.15;

  if (hasStrongSignal || (forwardHeadCandidate === true && isExtremelyReliable)) {
    return true;
  }

  if (Number.isFinite(measurements?.side?.forwardHeadOffset) && reliability >= POSTURE_THRESHOLDS.quality.lowReliabilityMax) {
    return false;
  }

  return null;
}

function resolveKyphosis(measurements, forwardHead) {
  if (!measurements?.side?.usable) {
    return "unknown";
  }

  const angleCandidate = measurements.side.upperTorsoAngleCandidate;

  if (angleCandidate === "high" && forwardHead === true) {
    return "high";
  }

  if (
    angleCandidate === "high" ||
    (angleCandidate === "medium" && forwardHead === true)
  ) {
    return "medium";
  }

  if (angleCandidate === "low" && forwardHead !== true) {
    return "low";
  }

  if (Number.isFinite(measurements?.side?.upperTorsoAngle)) {
    return "low";
  }

  return "unknown";
}

function resolveSpineAlignment(measurements) {
  if (!measurements?.back?.usable) {
    return "unknown";
  }

  const { spinalDeviation } = measurements.back;
  if (!Number.isFinite(spinalDeviation)) {
    return "unknown";
  }

  if (spinalDeviation <= POSTURE_THRESHOLDS.spineAlignment.balancedMax) {
    return "straight";
  }
  if (spinalDeviation >= POSTURE_THRESHOLDS.spineAlignment.deviationMin) {
    return "marked_deviation";
  }
  return "slight_deviation";
}

function resolveConfidence(measurements) {
  if (
    measurements?.completeness?.noPersonDetected ||
    measurements?.completeness?.extractionFailed ||
    measurements?.completeness?.lowVisibility
  ) {
    return "low";
  }

  const reliability = measurements?.completeness?.overallReliability ?? 0;
  const measuredSignals = measurements?.completeness?.measuredSignals ?? 0;
  const usableViews = measurements?.completeness?.usableViews ?? 0;
  const { medium, high } = POSTURE_THRESHOLDS.confidence;

  if (
    reliability >= high.reliabilityMin &&
    measuredSignals >= high.measuredSignalsMin &&
    usableViews >= high.usableViewsMin
  ) {
    return "high";
  }

  if (
    reliability >= medium.reliabilityMin &&
    measuredSignals >= medium.measuredSignalsMin &&
    usableViews >= medium.usableViewsMin
  ) {
    return "medium";
  }

  return "low";
}

function buildSignalDebugPayload(measurements) {
  const frontSignals = measurements?.front?.signals ?? [];
  const sideSignals = measurements?.side?.signals ?? [];
  const backSignals = measurements?.back?.signals ?? [];

  return {
    front: frontSignals.filter((signal) => signal.present).map(({ id, value, severity }) => ({ id, value, severity })),
    side: sideSignals.filter((signal) => signal.present).map(({ id, value, severity }) => ({ id, value, severity })),
    back: backSignals.filter((signal) => signal.present).map(({ id, value, severity }) => ({ id, value, severity })),
    dropped: [
      ...(measurements?.front?.signalBuckets?.dropped ?? []),
      ...(measurements?.side?.signalBuckets?.dropped ?? []),
      ...(measurements?.back?.signalBuckets?.dropped ?? []),
    ],
  };
}

function buildSummary(findings, measurements, confidence, detectionSignals = []) {
  const summary = [];
  const completeness = measurements?.completeness ?? {};
  const keptSignals = detectionSignals.filter((item) => item.kept).map((item) => item.type);

  if (!completeness.hasAnySignal) {
    if (completeness.noPersonDetected) {
      return ["no_person_detected"];
    }

    if (completeness.wrongAngleDetected) {
      return ["wrong_angle"];
    }

    if (completeness.extractionFailed || completeness.lowVisibility) {
      return ["insufficient_visibility"];
    }

    return ["insufficient_visibility"];
  }

  if (completeness.wrongAngleDetected && !summary.length) {
    summary.push("wrong_angle");
  }

  if (hasKyphosisTendency(findings)) {
    summary.push("kyphosis");
  }

  if (findings.forwardHead === true) {
    summary.push("forwardHead");
  }

  if (hasShoulderImbalance(findings)) {
    summary.push("shoulderAsymmetry");
  }

  if (findings.spineAlignment && findings.spineAlignment !== "straight" && findings.spineAlignment !== "unknown") {
    summary.push("spineAlignment");
  }

  if (
    confidence !== "high" ||
    !completeness.frontUsable ||
    !completeness.sideUsable ||
    completeness.wrongAngleDetected ||
    completeness.lowImageQuality
  ) {
    summary.push("partial_visibility");
  }

  if (!summary.some((item) => item === "kyphosis" || item === "forwardHead" || item === "shoulderAsymmetry")) {
    if (keptSignals.includes("thoracic_rounding_tendency")) {
      summary.unshift("kyphosis");
    } else if (keptSignals.includes("forward_head")) {
      summary.unshift("forwardHead");
    } else if (keptSignals.includes("shoulder_asymmetry")) {
      summary.unshift("shoulderAsymmetry");
    } else if (keptSignals.includes("spinal_alignment_variance")) {
      summary.unshift("spineAlignment");
    }
  }

  if (!summary.some((item) => item === "kyphosis" || item === "forwardHead" || item === "shoulderAsymmetry")) {
    if (keptSignals.length) {
      summary.unshift("minor_alignment_shift");
    } else if (confidence === "high" || confidence === "medium") {
      summary.unshift("balanced_alignment");
    } else if (!summary.length) {
      summary.push("insufficient_visibility");
    }
  }

  return Array.from(new Set(summary)).slice(0, 3);
}

function computeScore(findings, confidence, measurements, signalEvidence = [], reliabilityMemory = null) {
  const totalLandmarkCount = measurements?.completeness?.totalLandmarkCount ?? 0;
  const rawTotalLandmarkCount = measurements?.completeness?.rawTotalLandmarkCount ?? 0;
  const hasLandmarkEvidence =
    rawTotalLandmarkCount > 0 ||
    totalLandmarkCount > 0 ||
    measurements?.completeness?.hasAnySignal;

  if (!hasLandmarkEvidence || measurements?.completeness?.noPersonDetected) {
    return 0;
  }

  if (!measurements?.completeness?.hasAnySignal) {
    return 50;
  }

  const penalties = POSTURE_THRESHOLDS.score.penalties;
  const floor = POSTURE_THRESHOLDS.score.floors[confidence] ?? POSTURE_THRESHOLDS.score.floors.low;
  let score = POSTURE_THRESHOLDS.score.base;
  const weightedSignalPenalty = signalEvidence
    .filter((signal) => signal.kept)
    .reduce((sum, signal) => {
      const reliabilityFactor = 0.55 + ((signal.reliabilityContribution ?? 0) * 0.45);
      const uncertaintyFactor = signal.uncertain ? 0.72 : 1;
      return sum + (
        (signal.scoreImpact ?? 0) *
        (signal.weight ?? 0.5) *
        getSignalPenaltyMultiplier(signal.normalizedSeverity) *
        reliabilityFactor *
        uncertaintyFactor
      );
    }, 0);

  if (measurements?.side?.usable && findings.kyphosis === "medium") {
    score -= penalties.kyphosisMedium;
  }

  if (measurements?.side?.usable && findings.kyphosis === "high") {
    score -= penalties.kyphosisHigh;
  }

  if (measurements?.side?.usable && findings.forwardHead === true) {
    score -= penalties.forwardHead;
  }

  if (measurements?.front?.usable && hasShoulderImbalance(findings)) {
    score -= penalties.shoulderAsymmetry;
  }

  if (measurements?.back?.usable && findings.spineAlignment === "marked_deviation") {
    score -= penalties.spineDeviation;
  }

  score -= weightedSignalPenalty;

  if (confidence === "low") {
    let lowConfidenceScore = POSTURE_THRESHOLDS.score.lowSignalFallback;

    if (hasKyphosisTendency(findings)) {
      lowConfidenceScore -= 10;
    }

    if (findings.forwardHead === true) {
      lowConfidenceScore -= 6;
    }

    if (hasShoulderImbalance(findings)) {
      lowConfidenceScore -= 5;
    }

    if (findings.spineAlignment === "marked_deviation") {
      lowConfidenceScore -= 4;
    }

    return clamp(Math.round(lowConfidenceScore), 45, 60);
  }

  if (confidence === "medium") {
    score -= penalties.mediumConfidence;
  }

  if (reliabilityMemory?.sessionStability?.boost > 0) {
    score += Math.min(3, Math.round(reliabilityMemory.sessionStability.boost * 20));
  }

  return clamp(Math.round(Math.max(score, floor)), floor, POSTURE_THRESHOLDS.score.base);
}

function softenFindingsForConfidence(findings, confidence) {
  if (confidence !== "low") {
    return findings;
  }

  const downgradeKyphosis =
    findings?.kyphosis === "high"
      ? "medium"
      : findings?.kyphosis === "medium"
        ? "low"
        : findings?.kyphosis;
  const downgradeSpine =
    findings?.spineAlignment === "marked_deviation"
      ? "slight_deviation"
      : findings?.spineAlignment;

  return {
    ...findings,
    kyphosis: downgradeKyphosis,
    forwardHead: findings?.forwardHead === true ? true : findings?.forwardHead === false ? false : null,
    shoulderAsymmetry:
      findings?.shoulderAsymmetry === "left_low" || findings?.shoulderAsymmetry === "right_low"
        ? findings.shoulderAsymmetry
        : findings?.shoulderAsymmetry === "none"
          ? "none"
          : "unknown",
    spineAlignment: downgradeSpine,
  };
}

function applySignalEvidenceToFindings(findings, signalEvidence = []) {
  const keptSignals = new Set(signalEvidence.filter((item) => item.kept).map((item) => item.type));

  return {
    ...findings,
    forwardHead:
      findings?.forwardHead === true && !keptSignals.has("forward_head")
        ? null
        : findings?.forwardHead,
    shoulderAsymmetry:
      (
        (findings?.shoulderAsymmetry === "left_low" || findings?.shoulderAsymmetry === "right_low") &&
        !keptSignals.has("shoulder_asymmetry")
      )
        ? "unknown"
        : findings?.shoulderAsymmetry,
    spineAlignment:
      (
        (findings?.spineAlignment === "slight_deviation" || findings?.spineAlignment === "marked_deviation") &&
        !keptSignals.has("spinal_alignment_variance")
      )
        ? "unknown"
        : findings?.spineAlignment,
    kyphosis:
      (
        (findings?.kyphosis === "low" || findings?.kyphosis === "medium" || findings?.kyphosis === "high") &&
        !keptSignals.has("thoracic_rounding_tendency")
      )
        ? "unknown"
        : findings?.kyphosis,
  };
}

function resolveQualityLevel(qualityScore) {
  const { accuracy } = POSTURE_THRESHOLDS;
  if (qualityScore >= accuracy.high) return "high";
  if (qualityScore >= accuracy.medium) return "medium";
  return "low";
}

function shouldPersistResult(summary, confidence, measurements, extraction) {
  if (!measurements?.completeness?.hasAnySignal) {
    return false;
  }

  if (confidence === "low") {
    return false;
  }

  if (extraction?.analysisMode === "heuristic" || extraction?.provider === "heuristic") {
    return false;
  }

  return !summary.some((item) => (
    item === "no_person_detected" ||
    item === "wrong_angle" ||
    item === "platform_limited"
  ));
}

function buildFinalStatus({ noLandmarkEvidence, limitedButUsable, platformLimited, hasPartialEvidence }) {
  if (noLandmarkEvidence && !hasPartialEvidence) {
    return "fail";
  }

  if (platformLimited) {
    return "degraded";
  }
  
  if (limitedButUsable || hasPartialEvidence) {
    return "degraded";
  }

  return "ready";
}

function buildAlertReason({ finalStatus, noLandmarkEvidence, platformLimited }) {
  if (finalStatus === "ready") {
    return "not_triggered_ready_path";
  }

  if (finalStatus === "degraded") {
    return "not_triggered_degraded_path";
  }

  if (platformLimited) {
    return "platform_limited_retry";
  }

  if (noLandmarkEvidence) {
    return "no_landmark_evidence";
  }

  return "manual_retry";
}

function buildSessionStability(previousEntry, consistency) {
  const previousDate = Number(previousEntry?.date ?? 0);
  const sameSessionWindowMs = 30 * 60 * 1000;
  const sameSession = previousDate > 0 && (Date.now() - previousDate) <= sameSessionWindowMs;

  if (!sameSession || !consistency) {
    return {
      eligible: false,
      sameSession: false,
      consistencyLevel: "low",
      score: 0.5,
      boost: 0,
      reason: "not_same_session",
      repeatedScanDetected: false,
    };
  }

  const boost = consistency.consistencyLevel === "high"
    ? 0.08
    : consistency.consistencyLevel === "medium"
      ? 0.04
      : 0;

  return {
    eligible: consistency.comparisonEligible !== false,
    sameSession: true,
    consistencyLevel: consistency.consistencyLevel ?? "low",
    score: consistency.score ?? 0.5,
    boost,
    reason: consistency.reason ?? null,
    repeatedScanDetected: true,
  };
}

export async function runPostureAnalysis({
  frontImage,
  sideImage,
  backImage,
  previousEntry,
  validationItems,
}) {
  const inputEvidence = buildInputEvidence({
    frontImage,
    sideImage,
    backImage,
    validationItems,
  });

  if (!frontImage?.uri || !sideImage?.uri) {
    return createEmptyPostureAnalysisResult({
      inputEvidence,
      viewsUsed: getProvidedViews(inputEvidence),
      uiMeta: {
        scoreAvailable: false,
        limitedMode: false,
      },
    });
  }

  // ─── SERVER-SIDE ANALYSIS (iOS priority, Android fallback) ───────
  // Try server analysis first on iOS (no native ML available in Expo Go)
  // On Android, only try if native extraction is unavailable
  const tryServer = Platform.OS === "ios" || Platform.OS === "web";
  if (tryServer) {
    try {
      console.log(`${DEBUG_PREFIX} Attempting server-side posture analysis...`);
      const serverResult = await analyzePostureOnServer({
        frontUri: frontImage.uri,
        sideUri: sideImage.uri,
        backUri: backImage?.uri ?? null,
      });

      if (serverResult && serverResult.score !== undefined) {
        const mapped = mapServerResultToEngineFormat(serverResult);
        console.log(`${DEBUG_PREFIX} Server analysis succeeded`, {
          score: mapped.score,
          confidence: mapped.confidence,
          issueCount: mapped.issues.length,
        });

        // Build a complete result from server data
        return {
          ...createBaseDetectionResult(),
          score: mapped.score,
          quality: mapped.confidence === "high" ? "high" : mapped.confidence === "medium" ? "medium" : "low",
          viewsUsed: Object.keys(serverResult.views ?? {}),
          inputEvidence,
          serverResult: mapped,
          signals: mapped.issues.map((i) => i.code),
          postureMetrics: {
            headTilt: mapped.angles?.front?.head_tilt_deg ?? null,
            shoulderAsymmetry: mapped.angles?.front?.shoulder_tilt_deg ?? null,
            pelvisAsymmetry: mapped.angles?.front?.hip_tilt_deg ?? null,
            forwardHeadTendency: mapped.angles?.side?.forward_head_offset ?? null,
            roundedShoulderTendency: mapped.angles?.side?.shoulder_tilt_deg ?? null,
            pelvicTiltProxy: null,
            stanceAsymmetry: mapped.angles?.front?.knee_alignment_deg ?? null,
            spineDeviation: mapped.angles?.front?.spine_lateral_deg ?? null,
          },
          uiMeta: {
            scoreAvailable: true,
            limitedMode: false,
            heuristicMode: false,
            serverMode: true,
            viewsUsed: Object.keys(serverResult.views ?? {}),
          },
          findings: {
            kyphosis: "unknown",
            forwardHead: mapped.issues.some((i) => i.code === "forward_head") ? "forward" : null,
            shoulderAsymmetry: mapped.issues.some((i) => i.code === "shoulder_tilt") ? "asymmetric" : "balanced",
            spineAlignment: mapped.issues.some((i) => i.code === "spine_lateral") ? "deviated" : "aligned",
            lordosis: "unknown",
          },
          summary: mapped.issues.map((i) => i.code),
          recommendation: mapped.score >= 85 ? "maintain" : mapped.score >= 65 ? "mild_correction" : "active_correction",
          confidence: mapped.confidence,
          persistable: mapped.confidence !== "none",
          status: mapped.confidence === "none" ? "fail" : "ready",
          provider: "ml_server",
          analysisMode: "ml",
          measurements: null,
          consistency: null,
          qualityScore: mapped.score,
          qualityLevel: mapped.confidence === "high" ? "high" : mapped.confidence === "medium" ? "medium" : "low",
          diagnostics: {
            serverMode: true,
            processingMs: mapped.processingMs,
            views: serverResult.views,
            issues: mapped.issues,
            angles: mapped.angles,
          },
          message: mapped.message,
        };
      }

      console.log(`${DEBUG_PREFIX} Server analysis returned no result, falling back to client-side`);
    } catch (serverError) {
      console.warn(`${DEBUG_PREFIX} Server analysis failed, falling back to client-side`, serverError?.message);
    }
  }

  const extraction = await extractPostureLandmarks({ frontImage, sideImage, backImage });
  const measurements = derivePostureMeasurements(extraction);
  const {
    featureEvidence,
    coverageSummary,
  } = buildFeatureEvidence({ extraction, measurements });
  const { angleEvidence, viewsUsed } = buildAngleEvidence({
    extraction,
    measurements,
    coverageSummary,
  });

  const findings = cloneFindings();

  findings.shoulderAsymmetry = measurements.back?.usable
    ? measurements.back.shoulderAsymmetryCandidate
    : measurements.front.usable
      ? measurements.front.shoulderAsymmetryCandidate
      : "unknown";
  findings.spineAlignment = resolveSpineAlignment(measurements);
  findings.forwardHead = resolveForwardHead(measurements);
  findings.kyphosis = resolveKyphosis(measurements, findings.forwardHead);

  const confidence = resolveConfidence(measurements);
  const softenedFindings = softenFindingsForConfidence(findings, confidence);
  const detectionSignals = buildSignalEvidence({
    featureEvidence,
    measurements,
  });
  const filteredFindings = applySignalEvidenceToFindings(softenedFindings, detectionSignals);
  const signalDebugPayload = buildSignalDebugPayload(measurements);
  const summary = buildSummary(filteredFindings, measurements, confidence, detectionSignals);
  const recommendation = selectPostureRecommendation({
    findings: filteredFindings,
    confidence,
    measurements,
  });
  const persistable = shouldPersistResult(summary, confidence, measurements, extraction);
  const consistency = calculateConsistency(measurements, previousEntry);
  const sessionStability = buildSessionStability(previousEntry, consistency);
  const reliabilityMemory = buildReliabilityMemory({
    inputEvidence,
    angleEvidence,
    featureEvidence,
    signalEvidence: detectionSignals,
    coverageSummary,
    sessionStability,
  });
  const score = computeScore(filteredFindings, confidence, measurements, detectionSignals, reliabilityMemory);
  const qualityScore = Math.round(
    (
      (
        reliabilityMemory.captureQuality +
        reliabilityMemory.landmarkReliability +
        reliabilityMemory.featureReliability +
        reliabilityMemory.signalReliability +
        reliabilityMemory.temporalStability
      ) / 5
    ) * 100,
  );
  const qualityLevel = reliabilityMemory.overall ?? resolveQualityLevel(qualityScore);
  const totalLandmarkCount = measurements?.completeness?.totalLandmarkCount ?? 0;
  const rawTotalLandmarkCount =
    (extraction?.front?.rawLandmarkCount ?? 0) +
    (extraction?.side?.rawLandmarkCount ?? 0) +
    (extraction?.back?.rawLandmarkCount ?? 0);
  const minimumEvidenceThreshold = POSTURE_THRESHOLDS.landmarks.minimumAnalysisCount;
  const hasLandmarkEvidence =
    rawTotalLandmarkCount >= minimumEvidenceThreshold ||
    totalLandmarkCount >= minimumEvidenceThreshold ||
    measurements?.completeness?.hasAnySignal;
  const noLandmarkEvidence = rawTotalLandmarkCount <= 0 && !measurements?.completeness?.hasAnySignal;
  const platformLimited = isPlatformLimited(extraction);
  const hasPartialEvidence = rawTotalLandmarkCount > 0 && !hasLandmarkEvidence;
  const limitedButUsable =
    hasLandmarkEvidence &&
    !noLandmarkEvidence &&
    (
      confidence === "low" ||
      !persistable ||
      !measurements?.completeness?.frontUsable ||
      !measurements?.completeness?.sideUsable
    );
  
  console.log(`[POSTURE_RUNTIME_TRACE] [JS FILTERING STAGE] rawTotalLandmarkCount=${rawTotalLandmarkCount} filteredLandmarkCount=${totalLandmarkCount} noLandmarkEvidence=${noLandmarkEvidence} hasPartialEvidence=${hasPartialEvidence} limitedButUsable=${limitedButUsable}`);

  const proposedStatus = buildFinalStatus({
    noLandmarkEvidence,
    limitedButUsable,
    platformLimited,
    hasPartialEvidence,
  });
  const decisionMemory = buildDecisionMemory({
    proposedStatus,
    analysisMode: extraction.analysisMode ?? "ml",
    angleEvidence,
    signalEvidence: detectionSignals,
    confidence: noLandmarkEvidence ? "low" : confidence,
    noLandmarksDetected: noLandmarkEvidence,
    persistable,
    score,
    platformLimited,
    reliabilityMemory,
  });
  const finalStatus = decisionMemory.finalStatus;
  const alertReason = buildAlertReason({
    finalStatus,
    noLandmarkEvidence,
    platformLimited,
  });
  const failSummary = measurements?.completeness?.noPersonDetected
    ? ["no_person_detected"]
    : ["insufficient_visibility"];

  if (finalStatus === "fail") {
    console.log(`[POSTURE_RUNTIME_TRACE] HARD_FAIL_REASON: finalStatus is fail. noPersonDetected=${measurements?.completeness?.noPersonDetected} alertReason=${alertReason}`);
  }

  console.log(`[POSTURE_RUNTIME_TRACE] [FINAL DECISION STAGE] finalStatus=${finalStatus} reasonChain=[${decisionMemory.reasonChain.join(", ")}] alertReason=${alertReason}`);

  // Structured posture metrics — consolidated output for UI consumption
  const postureMetrics = {
    headTilt: measurements?.front?.headAlignment ?? null,
    shoulderAsymmetry: measurements?.front?.shoulderDelta ?? measurements?.back?.shoulderDelta ?? null,
    pelvisAsymmetry: measurements?.front?.hipTilt ?? measurements?.back?.hipTilt ?? null,
    forwardHeadTendency: measurements?.side?.forwardHeadOffset ?? null,
    roundedShoulderTendency: measurements?.side?.upperTorsoAngle ?? null,
    pelvicTiltProxy: measurements?.side?.hipAlignmentOffset ?? null,
    stanceAsymmetry: measurements?.front?.kneeAlignment ?? measurements?.back?.kneeAlignment ?? null,
    spineDeviation: measurements?.back?.spinalDeviation ?? null,
  };

  const finalResult = {
    ...createBaseDetectionResult(),
    score: finalStatus === "fail" || extraction.analysisMode === "heuristic" ? null : score,
    quality: finalStatus === "fail" ? "low" : qualityLevel,
    viewsUsed,
    inputEvidence,
    angleEvidence,
    featureEvidence,
    signalEvidence: detectionSignals,
    decisionMemory,
    reliabilityMemory,
    signals: detectionSignals.filter((item) => item.kept).map((item) => item.type),
    postureMetrics,
    uiMeta: {
      scoreAvailable: Number.isFinite(Number(finalStatus === "fail" || extraction.analysisMode === "heuristic" ? null : score)),
      limitedMode: finalStatus === "degraded",
      heuristicMode: (extraction.analysisMode ?? "ml") === "heuristic",
      viewsUsed,
    },
    findings: {
      ...filteredFindings,
      landmarks: {
        front: extraction?.front?.landmarks ?? {},
        side: extraction?.side?.landmarks ?? {},
        back: extraction?.back?.landmarks ?? {},
      },
    },
    summary: platformLimited
      ? ["platform_limited"]
      : (finalStatus === "fail" ? failSummary : summary),
    recommendation: finalStatus === "fail" ? "capture_retry" : recommendation,
    confidence: finalStatus === "fail" ? "low" : confidence,
    persistable: finalStatus === "ready" ? persistable : false,
    status: finalStatus,
    provider: extraction.provider,
    analysisMode: extraction.analysisMode ?? "ml",
    measurements,
    consistency,
    qualityScore: finalStatus === "fail" ? 0 : qualityScore,
    qualityLevel: finalStatus === "fail" ? "low" : qualityLevel,
    diagnostics: {
      totalLandmarkCount,
      rawTotalLandmarkCount,
      hasLandmarkEvidence,
      limitedButUsable,
      noLandmarksDetected: noLandmarkEvidence,
      minimumEvidenceThreshold,
      alertReason,
      signalEvidence: detectionSignals,
      signalDebug: signalDebugPayload,
      reasonChain: decisionMemory.reasonChain,
      sessionStability,
      front: {
        provider: extraction?.front?.provider ?? extraction?.provider ?? "unknown",
        landmarkCount: extraction?.front?.landmarkCount ?? 0,
        rawLandmarkCount: extraction?.front?.rawLandmarkCount ?? 0,
        averageConfidence: measurements?.front?.averageConfidence ?? 0,
        validKeypointCount: measurements?.front?.reliableKeypoints ?? 0,
        usable: measurements?.front?.usable ?? false,
        unusableReason: measurements?.front?.unusableReason ?? null,
        debugImageUri: extraction?.front?.debugImageUri ?? null,
      },
      side: {
        provider: extraction?.side?.provider ?? extraction?.provider ?? "unknown",
        landmarkCount: extraction?.side?.landmarkCount ?? 0,
        rawLandmarkCount: extraction?.side?.rawLandmarkCount ?? 0,
        averageConfidence: measurements?.side?.averageConfidence ?? 0,
        validKeypointCount: measurements?.side?.reliableKeypoints ?? 0,
        usable: measurements?.side?.usable ?? false,
        unusableReason: measurements?.side?.unusableReason ?? null,
        debugImageUri: extraction?.side?.debugImageUri ?? null,
      },
      back: {
        provider: extraction?.back?.provider ?? extraction?.provider ?? "unknown",
        landmarkCount: extraction?.back?.landmarkCount ?? 0,
        rawLandmarkCount: extraction?.back?.rawLandmarkCount ?? 0,
        averageConfidence: measurements?.back?.averageConfidence ?? 0,
        validKeypointCount: measurements?.back?.validKeypointCount ?? 0,
        usable: measurements?.back?.usable ?? false,
        unusableReason: measurements?.back?.unusableReason ?? null,
        debugImageUri: extraction?.back?.debugImageUri ?? null,
      },
    },
  };

  ["front", "side", "back"].forEach((angle) => {
    console.log(`${DEBUG_PREFIX} STEP 3 Final decision`, {
      angle,
      finalStatus: finalResult.status,
      ready: finalResult.status === "ready",
      degraded: finalResult.status === "degraded",
      fail: finalResult.status === "fail",
      limitedButUsable,
      noLandmarksDetected: noLandmarkEvidence,
      confidence: finalResult.confidence,
      score: finalResult.score,
      alertTriggered: finalResult.status === "fail",
      whyAlertIsTriggered: alertReason,
      provider: finalResult.provider,
      signalEvidence: detectionSignals,
      diagnostics: finalResult.diagnostics?.[angle] ?? null,
    });
  });

  console.log("POSTURE_SIGNALS", signalDebugPayload);

  return finalResult;
}
