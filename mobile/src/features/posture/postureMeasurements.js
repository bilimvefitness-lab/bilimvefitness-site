import { POSTURE_THRESHOLDS } from "./postureThresholds";

const DEBUG_PREFIX = "[POSTURE_FIX_DEBUG]";

function round(value, precision = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function average(values) {
  if (!Array.isArray(values) || !values.length) return null;
  const valid = values.filter((value) => Number.isFinite(value));

  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function getLandmark(state, name) {
  return state?.landmarks?.[name] ?? null;
}

function hasCoordinateLandmark(landmark) {
  return Boolean(
    landmark &&
    Number.isFinite(landmark.x) &&
    Number.isFinite(landmark.y),
  );
}

function isReliableLandmark(
  landmark,
  minConfidence = POSTURE_THRESHOLDS.landmarks.minConfidence,
) {
  if (!hasCoordinateLandmark(landmark)) return false;
  return landmark.confidence == null || landmark.confidence >= minConfidence;
}

function countReliableLandmarks(landmarks) {
  return landmarks.filter((landmark) => isReliableLandmark(landmark)).length;
}

function countPresentLandmarks(landmarks) {
  return landmarks.filter((landmark) => hasCoordinateLandmark(landmark))
    .length;
}

function buildKeypointPresence(state, keypointNames) {
  return keypointNames.reduce((accumulator, [label, names]) => {
    const landmarks = names.map((name) => getLandmark(state, name));
    accumulator[label] = landmarks.some((landmark) => hasCoordinateLandmark(landmark));
    return accumulator;
  }, {});
}

function buildFeatureLog(features) {
  return Object.entries(features).reduce((accumulator, [key, value]) => {
    accumulator[key] = Number.isFinite(value) ? round(value, 4) : value ?? null;
    return accumulator;
  }, {});
}

function classifySignalSeverity(value, thresholds) {
  if (!Number.isFinite(value)) {
    return "missing";
  }

  if (value >= thresholds.high) {
    return "high";
  }

  if (value >= thresholds.medium) {
    return "medium";
  }

  if (value >= thresholds.low) {
    return "low";
  }

  return "none";
}

function createMeasuredSignal(id, value, thresholdKey) {
  const severity = classifySignalSeverity(
    value,
    POSTURE_THRESHOLDS.signalLevels[thresholdKey],
  );

  return {
    id,
    value: Number.isFinite(value) ? round(value, 4) : null,
    severity,
    present: severity !== "missing",
    active: severity === "low" || severity === "medium" || severity === "high",
  };
}

function splitSignals(signals) {
  const active = signals.filter((signal) => signal.active);
  const neutral = signals.filter((signal) => signal.present && !signal.active);
  const dropped = signals.filter((signal) => !signal.present).map((signal) => signal.id);

  return { active, neutral, dropped };
}

function calculateAverageConfidence(landmarks) {
  return round(
    average(
      landmarks
        .map((landmark) => landmark?.confidence)
        .filter((value) => Number.isFinite(value)),
    ),
    3,
  );
}

function resolveMeasurementQualityLevel(reliability, usable) {
  if (!usable || !Number.isFinite(reliability)) {
    return "low";
  }

  if (reliability >= 0.7) {
    return "high";
  }

  if (reliability >= 0.45) {
    return "medium";
  }

  return "low";
}

function logAngleDiagnostics(angle, payload) {
  if (!Object.prototype.hasOwnProperty.call(payload ?? {}, "qualityLevel")) {
    return;
  }

  console.log(`${DEBUG_PREFIX} STEP 2 Processed measurements`, {
    angle,
    ...payload,
  });
}

function resolveShoulderAsymmetryCandidate(shoulderDelta, leftShoulder, rightShoulder, reliability) {
  if (
    !Number.isFinite(shoulderDelta) ||
    !hasCoordinateLandmark(leftShoulder) ||
    !hasCoordinateLandmark(rightShoulder)
  ) {
    return "unknown";
  }

  if (shoulderDelta <= POSTURE_THRESHOLDS.shoulderAsymmetry.balancedMax) {
    return "none";
  }

  return leftShoulder.y > rightShoulder.y ? "left_low" : "right_low";
}

function resolveForwardHeadCandidate(forwardHeadOffset, reliability, faceDirection) {
  if (!Number.isFinite(forwardHeadOffset)) {
    return null;
  }

  if (forwardHeadOffset >= POSTURE_THRESHOLDS.forwardHead.tendencyMin) {
    return true;
  }

  if (forwardHeadOffset <= POSTURE_THRESHOLDS.forwardHead.balancedMax) {
    return false;
  }

  if (
    !Number.isFinite(reliability) ||
    reliability < POSTURE_THRESHOLDS.forwardHead.reliabilityMin ||
    faceDirection === "unknown"
  ) {
    return false;
  }

  return false;
}

function resolveUpperTorsoAngleCandidate(upperTorsoAngle, reliability) {
  if (
    !Number.isFinite(upperTorsoAngle)
  ) {
    return "unknown";
  }

  if (upperTorsoAngle >= POSTURE_THRESHOLDS.upperTorsoAngle.highMin) {
    return "high";
  }

  if (upperTorsoAngle >= POSTURE_THRESHOLDS.upperTorsoAngle.mediumMin) {
    return "medium";
  }

  if (upperTorsoAngle <= POSTURE_THRESHOLDS.upperTorsoAngle.lowMax) {
    return "low";
  }

  if (
    !Number.isFinite(reliability) ||
    reliability < POSTURE_THRESHOLDS.upperTorsoAngle.reliabilityMin
  ) {
    return "low";
  }

  return "low";
}

function buildFrontMeasurements(frontState) {
  const leftShoulder = getLandmark(frontState, "leftShoulder");
  const rightShoulder = getLandmark(frontState, "rightShoulder");
  const leftHip = getLandmark(frontState, "leftHip");
  const rightHip = getLandmark(frontState, "rightHip");
  const leftKnee = getLandmark(frontState, "leftKnee");
  const rightKnee = getLandmark(frontState, "rightKnee");
  const leftEar = getLandmark(frontState, "leftEar");
  const rightEar = getLandmark(frontState, "rightEar");

  const leftReady = hasCoordinateLandmark(leftShoulder);
  const rightReady = hasCoordinateLandmark(rightShoulder);
  const leftHipReady = hasCoordinateLandmark(leftHip);
  const rightHipReady = hasCoordinateLandmark(rightHip);
  const leftKneeReady = hasCoordinateLandmark(leftKnee);
  const rightKneeReady = hasCoordinateLandmark(rightKnee);
  const shoulderDelta =
    leftReady && rightReady
      ? round(Math.abs(leftShoulder.y - rightShoulder.y))
      : null;
  const shoulderSpan =
    leftReady && rightReady
      ? round(Math.abs(leftShoulder.x - rightShoulder.x))
      : null;
  const hipSpan =
    leftHipReady && rightHipReady
      ? round(Math.abs(leftHip.x - rightHip.x))
      : null;
  const hipTilt =
    leftHipReady && rightHipReady
      ? computeAxisOffset(leftHip, rightHip, "y")
      : null;
  const kneeAlignment =
    leftKneeReady && rightKneeReady
      ? computeAxisOffset(leftKnee, rightKnee, "y")
      : null;
  const headAlignment =
    hasCoordinateLandmark(leftEar) && hasCoordinateLandmark(rightEar) && leftReady && rightReady
      ? computeAxisOffset(
          computeMidpoint(leftEar, rightEar),
          computeMidpoint(leftShoulder, rightShoulder),
          "x",
        )
      : null;
  const frontLandmarks = [
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftKnee,
    rightKnee,
    leftEar,
    rightEar,
  ];
  const reliability = calculateAverageConfidence(frontLandmarks);
  const reliableKeypoints = countReliableLandmarks(frontLandmarks);
  const presentKeypoints = countPresentLandmarks(frontLandmarks);
  const orientation = resolveFrontOrientation(shoulderSpan, hipSpan);
  const shoulderAsymmetryDirection = leftReady && rightReady
    ? resolveShoulderAsymmetryCandidate(
        shoulderDelta,
        leftShoulder,
        rightShoulder,
        reliability,
      )
    : "unknown";

  const keypointsPresent = buildKeypointPresence(frontState, [
    ["shoulder", ["leftShoulder", "rightShoulder"]],
    ["hip", ["leftHip", "rightHip"]],
    ["knee", ["leftKnee", "rightKnee"]],
    ["ear", ["leftEar", "rightEar"]],
  ]);
  const signals = [
    createMeasuredSignal("front_shoulder_tilt", shoulderDelta, "shoulderTilt"),
    createMeasuredSignal("front_head_alignment", headAlignment, "headAlignment"),
    createMeasuredSignal("front_hip_tilt", hipTilt, "hipTilt"),
    createMeasuredSignal("front_knee_alignment", kneeAlignment, "kneeAlignment"),
  ];
  const signalBuckets = splitSignals(signals);
  const hasAnyAlignmentSignal = Boolean(
    Number.isFinite(shoulderDelta) ||
    Number.isFinite(hipTilt) ||
    Number.isFinite(kneeAlignment) ||
    Number.isFinite(headAlignment),
  );
  const usable =
    presentKeypoints >= 2 &&
    orientation !== "side_like" &&
    hasAnyAlignmentSignal;
  const unusableReason = usable
    ? null
    : orientation === "side_like"
      ? "side_like_orientation"
      : !hasAnyAlignmentSignal
        ? "missing_alignment_signal"
        : "insufficient_visible_keypoints";

  return {
    status: frontState?.status ?? "missing_input",
    usable,
    unusableReason,
    landmarkCount: frontState?.landmarkCount ?? presentKeypoints,
    averageConfidence: reliability,
    reliableKeypoints,
    leftShoulderX: leftReady ? round(leftShoulder.x) : null,
    leftShoulderY: leftReady ? round(leftShoulder.y) : null,
    rightShoulderX: rightReady ? round(rightShoulder.x) : null,
    rightShoulderY: rightReady ? round(rightShoulder.y) : null,
    shoulderSpan,
    hipSpan,
    orientation,
    shoulderDelta,
    hipTilt,
    kneeAlignment,
    headAlignment,
    shoulderAsymmetryCandidate: shoulderAsymmetryDirection,
    keypointsPresent,
    signals,
    signalBuckets,
    featureLog: buildFeatureLog({
      headAlignment,
      shoulderTilt: shoulderDelta,
      hipTilt,
      kneeAlignment,
      spineAngle: null,
    }),
    reliability,
    provider: frontState?.provider ?? "unknown",
  };
}

function buildSideCandidate(sideState, sideKey) {
  const key = sideKey === "left" ? "left" : "right";
  const ear = getLandmark(sideState, `${key}Ear`);
  const shoulder = getLandmark(sideState, `${key}Shoulder`);
  const hip = getLandmark(sideState, `${key}Hip`);
  const knee = getLandmark(sideState, `${key}Knee`);

  const reliableCount = [ear, shoulder, hip, knee].filter((landmark) => isReliableLandmark(landmark))
    .length;
  const presentCount = [ear, shoulder, hip, knee].filter((landmark) => hasCoordinateLandmark(landmark))
    .length;
  const reliability = average([
    ear?.confidence,
    shoulder?.confidence,
    hip?.confidence,
    knee?.confidence,
  ]);

  return {
    key,
    ear,
    shoulder,
    hip,
    knee,
    reliableCount,
    presentCount,
    reliability,
  };
}

function selectVisibleSide(sideState) {
  const leftCandidate = buildSideCandidate(sideState, "left");
  const rightCandidate = buildSideCandidate(sideState, "right");

  if (leftCandidate.reliableCount > rightCandidate.reliableCount) {
    return leftCandidate;
  }

  if (rightCandidate.reliableCount > leftCandidate.reliableCount) {
    return rightCandidate;
  }

  if (leftCandidate.presentCount > rightCandidate.presentCount) {
    return leftCandidate;
  }

  if (rightCandidate.presentCount > leftCandidate.presentCount) {
    return rightCandidate;
  }

  if ((rightCandidate.reliability ?? 0) > (leftCandidate.reliability ?? 0)) {
    return rightCandidate;
  }

  return leftCandidate;
}

function resolveFaceDirection(nose, shoulder) {
  if (!hasCoordinateLandmark(nose) || !hasCoordinateLandmark(shoulder)) {
    return "unknown";
  }

  return nose.x >= shoulder.x ? "right" : "left";
}

function computeForwardHeadOffset(ear, shoulder, faceDirection) {
  if (!hasCoordinateLandmark(ear) || !hasCoordinateLandmark(shoulder)) {
    return null;
  }

  if (faceDirection === "right") {
    return round(ear.x - shoulder.x);
  }

  if (faceDirection === "left") {
    return round(shoulder.x - ear.x);
  }

  return round(Math.abs(ear.x - shoulder.x));
}

function computeUpperTorsoAngle(shoulder, hip) {
  if (!hasCoordinateLandmark(shoulder) || !hasCoordinateLandmark(hip)) {
    return null;
  }

  const dx = Math.abs(shoulder.x - hip.x);
  const dy = Math.max(Math.abs(hip.y - shoulder.y), 0.0001);
  return round((Math.atan2(dx, dy) * 180) / Math.PI, 2);
}

function computeAxisOffset(firstLandmark, secondLandmark, axis = "y") {
  if (!hasCoordinateLandmark(firstLandmark) || !hasCoordinateLandmark(secondLandmark)) {
    return null;
  }

  return round(Math.abs(firstLandmark[axis] - secondLandmark[axis]), 4);
}

function computeSignedAxisOffset(firstLandmark, secondLandmark, axis = "x") {
  if (!hasCoordinateLandmark(firstLandmark) || !hasCoordinateLandmark(secondLandmark)) {
    return null;
  }

  return round(firstLandmark[axis] - secondLandmark[axis], 4);
}

function computeMidpoint(firstLandmark, secondLandmark) {
  if (!hasCoordinateLandmark(firstLandmark) || !hasCoordinateLandmark(secondLandmark)) {
    return null;
  }

  return {
    x: (firstLandmark.x + secondLandmark.x) / 2,
    y: (firstLandmark.y + secondLandmark.y) / 2,
  };
}

function computeSpineAngle(upperPoint, lowerPoint) {
  if (!upperPoint || !lowerPoint) {
    return null;
  }

  const dx = Math.abs(upperPoint.x - lowerPoint.x);
  const dy = Math.max(Math.abs(lowerPoint.y - upperPoint.y), 0.0001);
  return round((Math.atan2(dx, dy) * 180) / Math.PI, 2);
}

function resolveFrontOrientation(shoulderSpan, hipSpan) {
  if (
    Number.isFinite(shoulderSpan) &&
    shoulderSpan <= POSTURE_THRESHOLDS.frontView.sideLikeShoulderSpanMax &&
    (
      !Number.isFinite(hipSpan) ||
      hipSpan <= POSTURE_THRESHOLDS.frontView.sideLikeHipSpanMax
    )
  ) {
    return "side_like";
  }

  if (
    Number.isFinite(shoulderSpan) &&
    shoulderSpan >= POSTURE_THRESHOLDS.frontView.frontLikeShoulderSpanMin &&
    (
      !Number.isFinite(hipSpan) ||
      hipSpan >= POSTURE_THRESHOLDS.frontView.frontLikeHipSpanMin
    )
  ) {
    return "front_like";
  }

  return "unknown";
}

function resolveSideOrientation(shoulderSpan, hipSpan) {
  if (
    Number.isFinite(shoulderSpan) &&
    shoulderSpan >= POSTURE_THRESHOLDS.sideView.frontLikeShoulderSpanMin &&
    (
      !Number.isFinite(hipSpan) ||
      hipSpan >= POSTURE_THRESHOLDS.sideView.frontLikeHipSpanMin
    )
  ) {
    return "front_like";
  }

  if (
    Number.isFinite(shoulderSpan) &&
    shoulderSpan <= POSTURE_THRESHOLDS.sideView.sideLikeShoulderSpanMax &&
    (
      !Number.isFinite(hipSpan) ||
      hipSpan <= POSTURE_THRESHOLDS.sideView.sideLikeHipSpanMax
    )
  ) {
    return "side_like";
  }

  return "unknown";
}

function buildSideMeasurements(sideState) {
  const visibleSide = selectVisibleSide(sideState);
  const nose = getLandmark(sideState, "nose");
  const leftShoulder = getLandmark(sideState, "leftShoulder");
  const rightShoulder = getLandmark(sideState, "rightShoulder");
  const leftHip = getLandmark(sideState, "leftHip");
  const rightHip = getLandmark(sideState, "rightHip");
  const leftKnee = getLandmark(sideState, "leftKnee");
  const rightKnee = getLandmark(sideState, "rightKnee");
  const faceDirection = resolveFaceDirection(nose, visibleSide.shoulder);
  const forwardHeadOffset = computeForwardHeadOffset(
    visibleSide.ear,
    visibleSide.shoulder,
    faceDirection,
  );
  const upperTorsoAngle = computeUpperTorsoAngle(visibleSide.shoulder, visibleSide.hip);
  const shoulderAlignmentOffset = computeAxisOffset(visibleSide.shoulder, visibleSide.hip, "x");
  const hipAlignmentOffset = computeAxisOffset(visibleSide.hip, visibleSide.knee, "x");
  const headAlignment = computeAxisOffset(visibleSide.ear, visibleSide.shoulder, "x");
  const kneeAlignment = computeAxisOffset(visibleSide.shoulder, visibleSide.knee, "x");
  const shoulderSpan =
    hasCoordinateLandmark(leftShoulder) && hasCoordinateLandmark(rightShoulder)
      ? round(Math.abs(leftShoulder.x - rightShoulder.x))
      : null;
  const hipSpan =
    hasCoordinateLandmark(leftHip) && hasCoordinateLandmark(rightHip)
      ? round(Math.abs(leftHip.x - rightHip.x))
      : null;
  const sideLandmarks = [
    visibleSide.ear,
    visibleSide.shoulder,
    visibleSide.hip,
    visibleSide.knee,
    nose,
  ];
  const reliability = calculateAverageConfidence(sideLandmarks);
  const orientation = resolveSideOrientation(shoulderSpan, hipSpan);
  const reliableKeypoints = countReliableLandmarks(sideLandmarks);
  const presentKeypoints = countPresentLandmarks(sideLandmarks);
  const keypointsPresent = buildKeypointPresence(sideState, [
    ["shoulder", ["leftShoulder", "rightShoulder"]],
    ["hip", ["leftHip", "rightHip"]],
    ["knee", ["leftKnee", "rightKnee"]],
    ["ear", ["leftEar", "rightEar"]],
  ]);
  const signals = [
    createMeasuredSignal("side_head_alignment", headAlignment, "headAlignment"),
    createMeasuredSignal("side_forward_head", forwardHeadOffset, "headAlignment"),
    createMeasuredSignal("side_shoulder_alignment", shoulderAlignmentOffset, "shoulderTilt"),
    createMeasuredSignal("side_hip_alignment", hipAlignmentOffset, "hipTilt"),
    createMeasuredSignal("side_knee_alignment", kneeAlignment, "kneeAlignment"),
    createMeasuredSignal("side_spine_angle", upperTorsoAngle, "spineAngle"),
  ];
  const signalBuckets = splitSignals(signals);
  const hasTorsoSignal =
    hasCoordinateLandmark(visibleSide.shoulder) &&
    hasCoordinateLandmark(visibleSide.hip);
  const hasAnySideSignal = Boolean(
    Number.isFinite(forwardHeadOffset) ||
    Number.isFinite(upperTorsoAngle) ||
    Number.isFinite(shoulderAlignmentOffset) ||
    Number.isFinite(hipAlignmentOffset) ||
    Number.isFinite(headAlignment) ||
    Number.isFinite(kneeAlignment),
  );
  const usable =
    hasTorsoSignal &&
    presentKeypoints >= 2 &&
    orientation !== "front_like";
  const unusableReason = usable
    ? null
    : orientation === "front_like"
      ? "front_like_orientation"
      : !hasTorsoSignal
        ? "missing_torso_signal"
        : !hasAnySideSignal
          ? "missing_alignment_signal"
          : "insufficient_visible_keypoints";

  return {
    status: sideState?.status ?? "missing_input",
    usable,
    unusableReason,
    landmarkCount: sideState?.landmarkCount ?? countPresentLandmarks(Object.values(sideState?.landmarks ?? {})),
    averageConfidence: reliability,
    reliableKeypoints,
    visibleSide:
      visibleSide.presentCount > 0
        ? visibleSide.key
        : "unknown",
    faceDirection,
    earX: hasCoordinateLandmark(visibleSide.ear) ? round(visibleSide.ear.x) : null,
    shoulderX: hasCoordinateLandmark(visibleSide.shoulder) ? round(visibleSide.shoulder.x) : null,
    hipX: hasCoordinateLandmark(visibleSide.hip) ? round(visibleSide.hip.x) : null,
    kneeX: hasCoordinateLandmark(visibleSide.knee) ? round(visibleSide.knee.x) : null,
    shoulderSpan,
    hipSpan,
    orientation,
    forwardHeadOffset,
    forwardHeadCandidate: resolveForwardHeadCandidate(
      forwardHeadOffset,
      reliability,
      faceDirection,
    ),
    upperTorsoAngle,
    upperTorsoAngleCandidate: resolveUpperTorsoAngleCandidate(
      upperTorsoAngle,
      reliability,
    ),
    headAlignment,
    shoulderAlignmentOffset,
    hipAlignmentOffset,
    kneeAlignment,
    keypointsPresent,
    signals,
    signalBuckets,
    featureLog: buildFeatureLog({
      headAlignment,
      shoulderTilt: shoulderAlignmentOffset,
      hipTilt: hipAlignmentOffset,
      kneeAlignment,
      spineAngle: upperTorsoAngle,
    }),
    reliability,
    provider: sideState?.provider ?? "unknown",
  };
}

function buildBackMeasurements(state) {
  if (!state || state.status !== "ready") {
    return {
      usable: false,
      reliability: 0,
      landmarkCount: state?.landmarkCount ?? 0,
      averageConfidence: 0,
      validKeypointCount: 0,
      unusableReason: state?.status ?? "missing_input",
    };
  }

  const ls = getLandmark(state, "leftShoulder");
  const rs = getLandmark(state, "rightShoulder");
  const lh = getLandmark(state, "leftHip");
  const rh = getLandmark(state, "rightHip");
  const lk = getLandmark(state, "leftKnee");
  const rk = getLandmark(state, "rightKnee");

  const landmarks = [ls, rs, lh, rh, lk, rk];
  const reliability = calculateAverageConfidence(landmarks) ?? 0;
  const validKeypointCount = countReliableLandmarks(landmarks);
  const presentKeypointCount = countPresentLandmarks(landmarks);
  const hasShoulderPair = hasCoordinateLandmark(ls) && hasCoordinateLandmark(rs);
  const hasHipPair = hasCoordinateLandmark(lh) && hasCoordinateLandmark(rh);
  const hasKneePair = hasCoordinateLandmark(lk) && hasCoordinateLandmark(rk);
  const usable = presentKeypointCount >= 2 && (hasShoulderPair || hasHipPair || hasKneePair);
  const unusableReason = usable
    ? null
    : presentKeypointCount < 2
      ? "insufficient_visible_keypoints"
      : "missing_alignment_pair";

  if (!usable) {
    return {
      usable: false,
      reliability: round(reliability),
      landmarkCount: state?.landmarkCount ?? countPresentLandmarks(landmarks),
      averageConfidence: round(reliability, 3),
      validKeypointCount,
      keypointsPresent: buildKeypointPresence(state, [
        ["shoulder", ["leftShoulder", "rightShoulder"]],
        ["hip", ["leftHip", "rightHip"]],
        ["knee", ["leftKnee", "rightKnee"]],
        ["ear", ["leftEar", "rightEar"]],
      ]),
      signals: [],
      signalBuckets: { active: [], neutral: [], dropped: ["back_shoulder_tilt", "back_hip_tilt", "back_knee_alignment", "back_spine_angle"] },
      unusableReason,
      provider: state?.provider,
    };
  }

  // Back-view Shoulder Asymmetry
  const shoulderDelta = Number.isFinite(ls.y) && Number.isFinite(rs.y)
    ? Math.abs(ls.y - rs.y)
    : null;
  const hipTilt = Number.isFinite(lh?.y) && Number.isFinite(rh?.y)
    ? Math.abs(lh.y - rh.y)
    : null;
  const kneeAlignment = Number.isFinite(lk?.y) && Number.isFinite(rk?.y)
    ? Math.abs(lk.y - rk.y)
    : null;

  // Spinal Midline Deviation
  const shoulderMidX = (ls.x + rs.x) / 2;
  const hipMidX = (lh.x + rh.x) / 2;
  const spinalDeviation = Number.isFinite(shoulderMidX) && Number.isFinite(hipMidX)
    ? Math.abs(shoulderMidX - hipMidX)
    : null;
  const spineAngle = hasShoulderPair && hasHipPair
    ? computeSpineAngle(
        { x: shoulderMidX, y: (ls.y + rs.y) / 2 },
        { x: hipMidX, y: (lh.y + rh.y) / 2 },
      )
    : null;
  const signals = [
    createMeasuredSignal("back_shoulder_tilt", shoulderDelta, "shoulderTilt"),
    createMeasuredSignal("back_hip_tilt", hipTilt, "hipTilt"),
    createMeasuredSignal("back_knee_alignment", kneeAlignment, "kneeAlignment"),
    createMeasuredSignal("back_spine_angle", spineAngle, "spineAngle"),
  ];
  const signalBuckets = splitSignals(signals);

  return {
    usable,
    provider: state.provider,
    landmarks: state.landmarks,
    reliability: round(reliability),
    landmarkCount: state?.landmarkCount ?? countPresentLandmarks(landmarks),
    averageConfidence: round(reliability, 3),
    validKeypointCount,
    unusableReason,
    shoulderDelta: round(shoulderDelta),
    shoulderAsymmetryCandidate: resolveShoulderAsymmetryCandidate(shoulderDelta, ls, rs, reliability),
    spinalDeviation: round(spinalDeviation),
    hipTilt: round(hipTilt),
    kneeAlignment: round(kneeAlignment),
    spineAngle,
    keypointsPresent: buildKeypointPresence(state, [
      ["shoulder", ["leftShoulder", "rightShoulder"]],
      ["hip", ["leftHip", "rightHip"]],
      ["knee", ["leftKnee", "rightKnee"]],
      ["ear", ["leftEar", "rightEar"]],
    ]),
    signals,
    signalBuckets,
    featureLog: buildFeatureLog({
      headAlignment: null,
      shoulderTilt: shoulderDelta,
      hipTilt,
      kneeAlignment,
      spineAngle,
    }),
  };
}

export function derivePostureMeasurements(extraction) {
  const front = buildFrontMeasurements(extraction?.front);
  const side = buildSideMeasurements(extraction?.side);
  const back = buildBackMeasurements(extraction?.back);
  const providedStatuses = [extraction?.front?.status, extraction?.side?.status, extraction?.back?.status]
    .filter((status) => status && status !== "missing_input");
  const allProvidedMissingLandmarks =
    providedStatuses.length > 0 &&
    providedStatuses.every((status) => status === "no_person_detected" || status === "no_landmarks");
  const criticalExtractionFailed =
    extraction?.front?.status === "extraction_failed" &&
    extraction?.side?.status === "extraction_failed";

  const overallReliability = round(
    clamp(
      average([front.reliability, side.reliability, back.reliability].filter(r => r > 0)) ?? 0,
      0,
      1,
    ),
    3,
  );

  const measuredSignalValues = [
    front.shoulderDelta,
    front.hipTilt,
    front.kneeAlignment,
    front.headAlignment,
    side.forwardHeadOffset,
    side.upperTorsoAngle,
    side.headAlignment,
    side.shoulderAlignmentOffset,
    side.hipAlignmentOffset,
    side.kneeAlignment,
    back.shoulderDelta,
    back.spinalDeviation,
    back.hipTilt,
    back.kneeAlignment,
    back.spineAngle,
  ];
  const measuredSignals = measuredSignalValues.filter((value) => Number.isFinite(value)).length;

  const measurements = {
    front,
    side,
    back,
    completeness: {
      frontReady: extraction?.front?.status === "ready",
      sideReady: extraction?.side?.status === "ready",
      backReady: extraction?.back?.status === "ready",
      frontUsable: front.usable,
      sideUsable: side.usable,
      backUsable: back.usable,
      usableViews: [front.usable, side.usable, back.usable].filter(Boolean).length,
      frontOrientation: front.orientation,
      sideOrientation: side.orientation,
      wrongAngleDetected:
        front.orientation === "side_like" &&
        side.orientation === "front_like",
      noPersonDetected: allProvidedMissingLandmarks,
      extractionFailed: criticalExtractionFailed,
      lowVisibility:
        !allProvidedMissingLandmarks &&
        (extraction?.front?.status === "low_visibility" ||
          extraction?.side?.status === "low_visibility" ||
          extraction?.back?.status === "low_visibility"),
      lowImageQuality: overallReliability <= POSTURE_THRESHOLDS.quality.lowReliabilityMax,
      measuredSignals,
      hasAnySignal: measuredSignals > 0,
      totalLandmarkCount:
        (extraction?.front?.landmarkCount ?? 0) +
        (extraction?.side?.landmarkCount ?? 0) +
        (extraction?.back?.landmarkCount ?? 0),
      rawTotalLandmarkCount:
        (extraction?.front?.rawLandmarkCount ?? 0) +
        (extraction?.side?.rawLandmarkCount ?? 0) +
        (extraction?.back?.rawLandmarkCount ?? 0),
      overallReliability,
    },
  };

  const wrongAngleDetected = measurements.completeness.wrongAngleDetected;

  [
    {
      angle: "front",
      state: measurements.front,
      validKeypointCount: measurements.front?.reliableKeypoints ?? 0,
    },
    {
      angle: "side",
      state: measurements.side,
      validKeypointCount: measurements.side?.reliableKeypoints ?? 0,
    },
    {
      angle: "back",
      state: measurements.back,
      validKeypointCount: measurements.back?.validKeypointCount ?? 0,
    },
  ].forEach(({ angle, state, validKeypointCount }) => {
    logAngleDiagnostics(angle, {
      normalizedLandmarkCount: state?.landmarkCount ?? 0,
      averageConfidence: state?.averageConfidence ?? 0,
      validKeypointCount,
      usable: state?.usable ?? false,
      unusableReason: state?.unusableReason ?? null,
      wrongAngleDetected,
      qualityLevel: resolveMeasurementQualityLevel(state?.reliability, state?.usable),
      keypointsPresent: state?.keypointsPresent ?? null,
      features: state?.featureLog ?? {},
      signals: state?.signals ?? [],
      droppedSignals: state?.signalBuckets?.dropped ?? [],
    });
  });

  return measurements;
}
export function calculateConsistency(current, previous) {
  if (!current || !previous) return { score: 1.0, isConsistent: true };

  const threshold = POSTURE_THRESHOLDS.hardening.consistencyThreshold;

  // --- Scale consistency: shoulder span ratio ---
  const currentShoulderSpan = current.front?.shoulderSpan;
  const prevLandmarks = previous.findings?.landmarks?.front;
  const prevShoulderSpan = prevLandmarks?.leftShoulder && prevLandmarks?.rightShoulder
    ? Math.abs(prevLandmarks.leftShoulder.x - prevLandmarks.rightShoulder.x)
    : null;

  // --- Frame consistency: hip span ratio ---
  const currentHipSpan = current.front?.hipSpan;
  const prevHipSpan = prevLandmarks?.leftHip && prevLandmarks?.rightHip
    ? Math.abs(prevLandmarks.leftHip.x - prevLandmarks.rightHip.x)
    : null;

  const ratios = [];

  if (Number.isFinite(currentShoulderSpan) && Number.isFinite(prevShoulderSpan) && prevShoulderSpan > 0) {
    ratios.push(Math.abs(currentShoulderSpan - prevShoulderSpan) / prevShoulderSpan);
  }

  if (Number.isFinite(currentHipSpan) && Number.isFinite(prevHipSpan) && prevHipSpan > 0) {
    ratios.push(Math.abs(currentHipSpan - prevHipSpan) / prevHipSpan);
  }

  if (!ratios.length) {
    return { score: 0.5, isConsistent: false, reason: "missing_reference" };
  }

  // Use the worst (highest) ratio — if either signal drifted, consistency is low
  const worstRatio = Math.max(...ratios);
  const { consistencyHighMax, consistencyMediumMax } = POSTURE_THRESHOLDS.hardening;

  const consistencyLevel =
    worstRatio <= consistencyHighMax ? "high"
      : worstRatio <= consistencyMediumMax ? "medium"
        : "low";

  return {
    score: round(1 - worstRatio, 2),
    isConsistent: worstRatio <= threshold,
    consistencyLevel,
    comparisonEligible: consistencyLevel !== "low",
    ratio: round(worstRatio, 3),
    reason: worstRatio > threshold ? "scale_drift" : null,
  };
}
