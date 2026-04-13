export const DETECTION_VIEWS = Object.freeze(["front", "side", "back"]);

export const ANGLE_KEYPOINTS = Object.freeze({
  front: Object.freeze([
    "nose",
    "leftEar",
    "rightEar",
    "leftShoulder",
    "rightShoulder",
    "leftHip",
    "rightHip",
    "leftKnee",
    "rightKnee",
    "leftAnkle",
    "rightAnkle",
  ]),
  side: Object.freeze([
    "nose",
    "leftEar",
    "rightEar",
    "leftShoulder",
    "rightShoulder",
    "leftHip",
    "rightHip",
    "leftKnee",
    "rightKnee",
  ]),
  back: Object.freeze([
    "leftShoulder",
    "rightShoulder",
    "leftHip",
    "rightHip",
    "leftKnee",
    "rightKnee",
    "leftAnkle",
    "rightAnkle",
  ]),
});

export const FEATURE_SPECS = Object.freeze({
  front: Object.freeze([
    {
      feature: "shoulderTilt",
      measurementKey: "shoulderDelta",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["leftShoulder", "rightShoulder"]),
    },
    {
      feature: "hipTilt",
      measurementKey: "hipTilt",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["leftHip", "rightHip"]),
    },
    {
      feature: "headAlignment",
      measurementKey: "headAlignment",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["leftEar", "rightEar", "leftShoulder", "rightShoulder"]),
    },
    {
      feature: "kneeAlignment",
      measurementKey: "kneeAlignment",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["leftKnee", "rightKnee"]),
    },
  ]),
  side: Object.freeze([
    {
      feature: "forwardHeadOffset",
      measurementKey: "forwardHeadOffset",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["nose", "leftEar", "rightEar", "leftShoulder", "rightShoulder"]),
    },
    {
      feature: "spineAngle",
      measurementKey: "upperTorsoAngle",
      unit: "deg",
      sourceKeypoints: Object.freeze(["leftShoulder", "rightShoulder", "leftHip", "rightHip"]),
    },
    {
      feature: "shoulderAlignmentOffset",
      measurementKey: "shoulderAlignmentOffset",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["leftShoulder", "rightShoulder", "leftHip", "rightHip"]),
    },
    {
      feature: "hipAlignmentOffset",
      measurementKey: "hipAlignmentOffset",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["leftHip", "rightHip", "leftKnee", "rightKnee"]),
    },
    {
      feature: "kneeAlignment",
      measurementKey: "kneeAlignment",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["leftShoulder", "rightShoulder", "leftKnee", "rightKnee"]),
    },
  ]),
  back: Object.freeze([
    {
      feature: "shoulderTilt",
      measurementKey: "shoulderDelta",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["leftShoulder", "rightShoulder"]),
    },
    {
      feature: "hipTilt",
      measurementKey: "hipTilt",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["leftHip", "rightHip"]),
    },
    {
      feature: "kneeAlignment",
      measurementKey: "kneeAlignment",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["leftKnee", "rightKnee"]),
    },
    {
      feature: "spineAngle",
      measurementKey: "spineAngle",
      unit: "deg",
      sourceKeypoints: Object.freeze(["leftShoulder", "rightShoulder", "leftHip", "rightHip"]),
    },
    {
      feature: "spineMidlineOffset",
      measurementKey: "spinalDeviation",
      unit: "ratio",
      sourceKeypoints: Object.freeze(["leftShoulder", "rightShoulder", "leftHip", "rightHip"]),
    },
  ]),
});

function createEmptyInputEvidence() {
  return {
    front: null,
    side: null,
    back: null,
  };
}

function createEmptyAngleEvidence() {
  return {
    front: null,
    side: null,
    back: null,
  };
}

function createEmptyDecisionMemory() {
  return {
    finalStatus: "fail",
    analysisMode: "ml",
    reasonChain: ["missing_required_images"],
    noLandmarksDetected: true,
    limitedMode: false,
    reliabilityDrivers: [],
    limitedModeReason: "missing_required_images",
    scoreEligible: false,
    persistable: false,
  };
}

function createEmptyReliabilityMemory() {
  return {
    captureQuality: 0,
    landmarkReliability: 0,
    featureReliability: 0,
    signalReliability: 0,
    featureCoverageByView: {},
    overall: "low",
  };
}

export function createBaseDetectionResult(overrides = {}) {
  return {
    status: "fail",
    analysisMode: "ml",
    score: null,
    quality: "low",
    confidence: "low",
    viewsUsed: [],
    inputEvidence: createEmptyInputEvidence(),
    angleEvidence: createEmptyAngleEvidence(),
    featureEvidence: [],
    signalEvidence: [],
    decisionMemory: createEmptyDecisionMemory(),
    reliabilityMemory: createEmptyReliabilityMemory(),
    signals: [],
    uiMeta: {},
    ...overrides,
  };
}
