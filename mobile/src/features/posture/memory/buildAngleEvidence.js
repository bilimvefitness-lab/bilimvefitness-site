import { DETECTION_VIEWS } from "./postureDetectionSchema";
import {
  getKeypointState,
  getReasonChainItem,
  logDetectionMemory,
  round,
  validateAngleRecord,
} from "./postureDetectionMemoryUtils";

function resolveUsableReason(view, measurementState, keypointsPresent) {
  if (!measurementState?.usable) {
    return null;
  }

  if (view === "front" && keypointsPresent.includes("leftShoulder") && keypointsPresent.includes("rightShoulder")) {
    return "shoulder_hip_head_present";
  }

  if (view === "side" && keypointsPresent.some((name) => name.includes("Shoulder")) && keypointsPresent.some((name) => name.includes("Hip"))) {
    return "side_profile_alignment_present";
  }

  if (view === "back" && keypointsPresent.includes("leftShoulder") && keypointsPresent.includes("rightShoulder")) {
    return "posterior_alignment_present";
  }

  return "alignment_signal_present";
}

function resolveWrongAngle(view, measurements) {
  if (view === "front") {
    return measurements?.completeness?.frontOrientation === "side_like";
  }

  if (view === "side") {
    return measurements?.completeness?.sideOrientation === "front_like";
  }

  return false;
}

function buildSingleAngleEvidence(view, extractionState, measurementState, measurements, featureCoverage) {
  if (!extractionState) {
    return null;
  }

  const keypointState = getKeypointState(extractionState.landmarks, view);
  const wrongAngleDetected = resolveWrongAngle(view, measurements);
  const limitedButUsable = Boolean(
    measurementState?.usable &&
    (
      wrongAngleDetected ||
      (measurementState?.reliability ?? 0) < 0.45 ||
      (measurementState?.signalBuckets?.active?.length ?? 0) === 0
    )
  );

  const evidence = {
    provider: extractionState?.provider ?? "unknown",
    status: extractionState?.status ?? "missing_input",
    rawLandmarkCount: extractionState?.rawLandmarkCount ?? 0,
    normalizedLandmarkCount: extractionState?.landmarkCount ?? 0,
    averageConfidence: round(
      measurementState?.averageConfidence ?? extractionState?.rawAverageConfidence ?? 0,
      3,
    ),
    keypointsPresent: keypointState.present,
    keypointsMissing: keypointState.missing,
    keypointsReliable: keypointState.reliable,
    keypointsWeak: keypointState.weak,
    usable: Boolean(measurementState?.usable),
    usableReason: resolveUsableReason(view, measurementState, keypointState.present),
    unusableReason: measurementState?.unusableReason ?? extractionState?.status ?? "missing_input",
    wrongAngleDetected,
    limitedButUsable,
    featureCoverage: featureCoverage ?? {
      totalExpectedFeatures: 0,
      computedFeatures: 0,
      droppedFeatures: 0,
      coverageRatio: 0,
    },
  };

  validateAngleRecord(evidence, featureCoverage);

  logDetectionMemory("angle evidence", {
    view,
    landmarkCount: evidence.normalizedLandmarkCount,
    usable: evidence.usable,
    reason: evidence.usable ? evidence.usableReason : evidence.unusableReason,
    averageConfidence: evidence.averageConfidence,
    featureCoverage: evidence.featureCoverage,
  });

  return evidence;
}

export function buildAngleEvidence({ extraction, measurements, coverageSummary = {} }) {
  const angleEvidence = DETECTION_VIEWS.reduce((accumulator, view) => {
    accumulator[view] = buildSingleAngleEvidence(
      view,
      extraction?.[view],
      measurements?.[view],
      measurements,
      coverageSummary?.[view],
    );
    return accumulator;
  }, {});

  const viewsUsed = DETECTION_VIEWS.filter((view) => (
    angleEvidence?.[view]?.usable ||
    angleEvidence?.[view]?.limitedButUsable ||
    (angleEvidence?.[view]?.normalizedLandmarkCount ?? 0) > 0
  ));

  return {
    angleEvidence,
    viewsUsed,
    reasonChain: DETECTION_VIEWS.map((view) => {
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
  };
}
