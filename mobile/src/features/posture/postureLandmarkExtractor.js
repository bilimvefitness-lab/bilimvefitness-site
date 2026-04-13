import { NativeModules, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";


const MODULE_NAME = "PostureLandmarkModule";
const LANDMARK_MODULE = NativeModules[MODULE_NAME];
const DEBUG_PREFIX = "[POSTURE_FIX_DEBUG]";
const PROVIDER_PREFIX = "[POSTURE_PROVIDER_SELECT]";
const HEURISTIC_CONFIDENCE = 0.12;

function round(value, precision = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function getUriScheme(uri) {
  if (typeof uri !== "string" || !uri.includes(":")) {
    return "unknown";
  }

  return uri.split(":")[0].toLowerCase();
}

function getExtension(uri, fallback = ".jpg") {
  if (typeof uri !== "string") {
    return fallback;
  }

  const cleanUri = uri.split("?")[0];
  const match = cleanUri.match(/(\.[a-z0-9]+)$/i);
  return match?.[1] ?? fallback;
}

function logDebug(message, payload) {
  console.log(`${DEBUG_PREFIX} ${message}`, payload);
}

function logProvider(event, payload) {
  console.log(`${PROVIDER_PREFIX} ${event}`, payload);
}

function normalizeSourceSize(nativeSize, imageAsset) {
  const width = Number(nativeSize?.width ?? imageAsset?.width ?? 0);
  const height = Number(nativeSize?.height ?? imageAsset?.height ?? 0);

  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  return { width, height };
}

function normalizeLandmarks(rawLandmarks) {
  if (!rawLandmarks || typeof rawLandmarks !== "object") {
    return {};
  }

  return Object.entries(rawLandmarks).reduce((accumulator, [name, landmark]) => {
    const x = round(Number(landmark?.x));
    const y = round(Number(landmark?.y));

    if (x === null || y === null) {
      return accumulator;
    }

    accumulator[name] = {
      x,
      y,
      z: round(Number(landmark?.z)),
      confidence: round(Number(landmark?.confidence), 3),
    };

    return accumulator;
  }, {});
}

function createMidpointLandmark(first, second) {
  if (!first || !second) {
    return null;
  }

  const x = round((Number(first.x) + Number(second.x)) / 2);
  const y = round((Number(first.y) + Number(second.y)) / 2);
  const zValues = [first.z, second.z].filter(Number.isFinite);
  const confidenceValues = [first.confidence, second.confidence].filter(Number.isFinite);

  if (x === null || y === null) {
    return null;
  }

  return {
    x,
    y,
    z: zValues.length ? round(zValues.reduce((sum, value) => sum + value, 0) / zValues.length) : null,
    confidence: confidenceValues.length
      ? round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length, 3)
      : null,
  };
}

function addDerivedLandmarks(landmarks) {
  const normalized = { ...landmarks };
  const neck = createMidpointLandmark(normalized.leftShoulder, normalized.rightShoulder);
  const pelvisCenter = createMidpointLandmark(normalized.leftHip, normalized.rightHip);

  if (neck) {
    normalized.neck = neck;
  }

  if (pelvisCenter) {
    normalized.pelvis_center = pelvisCenter;
  }

  return normalized;
}

function countValidLandmarks(landmarks) {
  return Object.values(landmarks ?? {}).filter((landmark) => (
    Number.isFinite(landmark?.x) &&
    Number.isFinite(landmark?.y)
  )).length;
}

function computeAverageConfidence(landmarks, fallback = null) {
  const confidenceValues = Object.values(landmarks ?? {})
    .map((landmark) => Number(landmark?.confidence))
    .filter(Number.isFinite);

  if (!confidenceValues.length) {
    return round(Number(fallback), 3);
  }

  return round(
    confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length,
    3,
  );
}

function buildRawKeypointPresence(landmarks) {
  const hasLandmark = (name) => (
    Number.isFinite(landmarks?.[name]?.x) &&
    Number.isFinite(landmarks?.[name]?.y)
  );

  return {
    shoulder: hasLandmark("leftShoulder") || hasLandmark("rightShoulder"),
    hip: hasLandmark("leftHip") || hasLandmark("rightHip"),
    knee: hasLandmark("leftKnee") || hasLandmark("rightKnee"),
    ear: hasLandmark("leftEar") || hasLandmark("rightEar"),
  };
}

function createExtractionResult({
  status,
  provider,
  landmarks = {},
  rawKeypointsCount = 0,
  validKeypointsCount = 0,
  averageConfidence = null,
  processingMs = null,
  reason = null,
  sourceSize = null,
  inputUri = null,
  preparedUri = null,
  uriScheme = "unknown",
  debugImageUri = null,
  errorCode = null,
}) {
  return {
    status,
    provider,
    landmarks,
    rawKeypointsCount: Number(rawKeypointsCount ?? 0),
    validKeypointsCount: Number(validKeypointsCount ?? 0),
    averageConfidence: round(Number(averageConfidence), 3),
    processingMs: Number.isFinite(Number(processingMs)) ? Number(processingMs) : null,
    reason,
    sourceSize,
    landmarkCount: Number(validKeypointsCount ?? 0),
    rawLandmarkCount: Number(rawKeypointsCount ?? 0),
    rawAverageConfidence: round(Number(averageConfidence), 3),
    errorCode,
    inputUri,
    preparedUri,
    uriScheme,
    debugImageUri,
  };
}

async function prepareImageAssetForExtraction(imageAsset, angle) {
  const originalUri = imageAsset?.uri ?? null;
  const uriScheme = getUriScheme(originalUri);

  if (!originalUri) {
    return {
      asset: imageAsset,
      originalUri,
      preparedUri: null,
      uriScheme,
      wasCopied: false,
      copyError: null,
    };
  }

  if (Platform.OS !== "android" || uriScheme !== "content") {
    return {
      asset: imageAsset,
      originalUri,
      preparedUri: originalUri,
      uriScheme,
      wasCopied: false,
      copyError: null,
    };
  }

  const baseDirectory = FileSystem.cacheDirectory ?? FileSystem.documentDirectory;
  if (!baseDirectory) {
    logDebug("STEP 1 URI preparation skipped", {
      angle,
      inputUri: originalUri,
      uriScheme,
      reason: "no_cache_directory",
    });

    return {
      asset: imageAsset,
      originalUri,
      preparedUri: originalUri,
      uriScheme,
      wasCopied: false,
      copyError: "no_cache_directory",
    };
  }

  const targetDirectory = `${baseDirectory}posture-cache/`;
  const destinationUri = `${targetDirectory}${angle}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}${getExtension(imageAsset?.fileName ?? originalUri)}`;

  try {
    await FileSystem.makeDirectoryAsync(targetDirectory, { intermediates: true });
    await FileSystem.copyAsync({ from: originalUri, to: destinationUri });

    logDebug("STEP 1 URI preparation success", {
      angle,
      inputUri: originalUri,
      uriScheme,
      preparedUri: destinationUri,
      provider: "content_to_file_copy",
    });

    return {
      asset: { ...imageAsset, uri: destinationUri },
      originalUri,
      preparedUri: destinationUri,
      uriScheme,
      wasCopied: true,
      copyError: null,
    };
  } catch (error) {
    logDebug("STEP 1 URI preparation failed", {
      angle,
      inputUri: originalUri,
      uriScheme,
      preparedUri: destinationUri,
      provider: "content_to_file_copy",
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? "copy_failed",
    });

    return {
      asset: imageAsset,
      originalUri,
      preparedUri: originalUri,
      uriScheme,
      wasCopied: false,
      copyError: error?.message ?? "copy_failed",
    };
  }
}

function buildHeuristicLandmarks(imageAsset, angle) {
  const width = Number(imageAsset?.width ?? 0);
  const height = Number(imageAsset?.height ?? 0);

  if (width <= 0 || height <= 0) return null;

  const aspectRatio = width / height;
  if (aspectRatio > 1.4 || aspectRatio < 0.25) return null;

  const cx = 0.5;
  const headY = 0.12;
  const shoulderY = 0.22;
  const hipY = 0.52;
  const kneeY = 0.72;
  const ankleY = 0.92;

  if (angle === "front" || angle === "back") {
    const shoulderSpread = 0.13;
    const hipSpread = 0.09;
    const kneeSpread = 0.07;

    return {
      nose: { x: round(cx), y: round(headY - 0.02), z: null, confidence: HEURISTIC_CONFIDENCE },
      leftEar: { x: round(cx - 0.04), y: round(headY), z: null, confidence: HEURISTIC_CONFIDENCE },
      rightEar: { x: round(cx + 0.04), y: round(headY), z: null, confidence: HEURISTIC_CONFIDENCE },
      leftShoulder: { x: round(cx - shoulderSpread), y: round(shoulderY), z: null, confidence: HEURISTIC_CONFIDENCE },
      rightShoulder: { x: round(cx + shoulderSpread), y: round(shoulderY), z: null, confidence: HEURISTIC_CONFIDENCE },
      leftHip: { x: round(cx - hipSpread), y: round(hipY), z: null, confidence: HEURISTIC_CONFIDENCE },
      rightHip: { x: round(cx + hipSpread), y: round(hipY), z: null, confidence: HEURISTIC_CONFIDENCE },
      leftKnee: { x: round(cx - kneeSpread), y: round(kneeY), z: null, confidence: HEURISTIC_CONFIDENCE },
      rightKnee: { x: round(cx + kneeSpread), y: round(kneeY), z: null, confidence: HEURISTIC_CONFIDENCE },
      leftAnkle: { x: round(cx - kneeSpread), y: round(ankleY), z: null, confidence: HEURISTIC_CONFIDENCE },
      rightAnkle: { x: round(cx + kneeSpread), y: round(ankleY), z: null, confidence: HEURISTIC_CONFIDENCE },
    };
  }

  const sideOffset = 0.03;
  return {
    nose: { x: round(cx + sideOffset * 2), y: round(headY - 0.02), z: null, confidence: HEURISTIC_CONFIDENCE },
    leftEar: { x: round(cx + sideOffset), y: round(headY), z: null, confidence: HEURISTIC_CONFIDENCE },
    rightEar: { x: round(cx + sideOffset), y: round(headY), z: null, confidence: HEURISTIC_CONFIDENCE },
    leftShoulder: { x: round(cx), y: round(shoulderY), z: null, confidence: HEURISTIC_CONFIDENCE },
    rightShoulder: { x: round(cx), y: round(shoulderY), z: null, confidence: HEURISTIC_CONFIDENCE },
    leftHip: { x: round(cx - sideOffset), y: round(hipY), z: null, confidence: HEURISTIC_CONFIDENCE },
    rightHip: { x: round(cx - sideOffset), y: round(hipY), z: null, confidence: HEURISTIC_CONFIDENCE },
    leftKnee: { x: round(cx - sideOffset), y: round(kneeY), z: null, confidence: HEURISTIC_CONFIDENCE },
    rightKnee: { x: round(cx - sideOffset), y: round(kneeY), z: null, confidence: HEURISTIC_CONFIDENCE },
  };
}

function validateImageReadability(imageAsset) {
  const width = Number(imageAsset?.width ?? 0);
  const height = Number(imageAsset?.height ?? 0);
  const hasUri = Boolean(imageAsset?.uri);
  const hasDimensions = width > 0 && height > 0;
  const aspectRatio = hasDimensions ? width / height : 0;
  const isPortraitLike = aspectRatio > 0.25 && aspectRatio < 1.4;
  const hasMinResolution = width >= 200 && height >= 300;

  return {
    readable: hasUri && hasDimensions,
    fullBodyLikely: isPortraitLike,
    enoughResolution: hasMinResolution,
    width,
    height,
    aspectRatio: round(aspectRatio, 3),
    rejectionReason: !hasUri
      ? "missing_uri"
      : !hasDimensions
        ? "missing_dimensions"
        : !isPortraitLike
          ? "wrong_aspect_ratio"
          : !hasMinResolution
            ? "low_resolution"
            : null,
  };
}

function createReadyResult({
  provider,
  landmarks,
  sourceSize,
  rawKeypointsCount,
  averageConfidence,
  processingMs,
  reason = null,
  inputUri,
  preparedUri,
  uriScheme,
  debugImageUri = null,
}) {
  const enrichedLandmarks = addDerivedLandmarks(normalizeLandmarks(landmarks));
  const validKeypointsCount = countValidLandmarks(enrichedLandmarks);

  return createExtractionResult({
    status: validKeypointsCount > 0 ? "ready" : "no_landmarks",
    provider,
    landmarks: enrichedLandmarks,
    rawKeypointsCount,
    validKeypointsCount,
    averageConfidence: computeAverageConfidence(enrichedLandmarks, averageConfidence),
    processingMs,
    reason: validKeypointsCount > 0 ? reason : (reason ?? "no_landmarks_detected"),
    sourceSize,
    inputUri,
    preparedUri,
    uriScheme,
    debugImageUri,
    errorCode: validKeypointsCount > 0 ? null : "no_landmarks",
  });
}

function createFailureResult({
  provider,
  sourceSize,
  reason,
  inputUri,
  preparedUri,
  uriScheme,
  processingMs = null,
  errorCode = null,
}) {
  return createExtractionResult({
    status: errorCode === "missing_input" ? "missing_input" : "extraction_failed",
    provider,
    landmarks: {},
    rawKeypointsCount: 0,
    validKeypointsCount: 0,
    averageConfidence: 0,
    processingMs,
    reason,
    sourceSize,
    inputUri,
    preparedUri,
    uriScheme,
    errorCode,
  });
}

async function extractWithNativeModule(preparedImage, prepared, angle) {
  const startedAt = Date.now();

  logProvider("native_selected", {
    angle,
    provider: "ml_native",
    platform: Platform.OS,
    inputUri: prepared.originalUri,
    preparedUri: prepared.preparedUri,
  });

  try {
    const rawResponse = await LANDMARK_MODULE.extractFromUri(preparedImage.uri);
    const sourceSize = normalizeSourceSize(rawResponse?.sourceSize, preparedImage);
    const rawLandmarks = rawResponse?.landmarks ?? {};
    const normalizedLandmarks = normalizeLandmarks(rawLandmarks);
    const rawKeypointsCount = Number(
      rawResponse?.landmarkCount ?? Object.keys(rawLandmarks).length ?? 0,
    );
    const averageConfidence = computeAverageConfidence(
      normalizedLandmarks,
      rawResponse?.averageConfidence,
    );
    const processingMs = Number(rawResponse?.processingMs ?? (Date.now() - startedAt));
    const result = createReadyResult({
      provider: "ml_native",
      landmarks: normalizedLandmarks,
      sourceSize,
      rawKeypointsCount,
      averageConfidence,
      processingMs,
      reason: rawResponse?.reason ?? (rawKeypointsCount > 0 ? "native_pose_detected" : "native_no_landmarks"),
      inputUri: prepared.originalUri,
      preparedUri: prepared.preparedUri,
      uriScheme: prepared.uriScheme,
      debugImageUri: rawResponse?.debugImageUri ?? null,
    });

    logDebug("STEP 1 Native raw result", {
      angle,
      inputUri: prepared.originalUri,
      uriScheme: prepared.uriScheme,
      width: sourceSize?.width ?? preparedImage?.width ?? null,
      height: sourceSize?.height ?? preparedImage?.height ?? null,
      provider: "ml_native",
      rawNativeResponse: rawResponse ?? null,
      rawLandmarkCount: rawKeypointsCount,
      rawConfidence: averageConfidence,
      normalizedLandmarkCount: result.validKeypointsCount,
      keypointsPresent: buildRawKeypointPresence(result.landmarks),
      status: result.status,
      reason: result.reason,
    });

    return result;
  } catch (error) {
    const processingMs = Date.now() - startedAt;
    logProvider("native_failed", {
      angle,
      provider: "ml_native",
      reason: error?.message ?? "native_extraction_failed",
      errorCode: error?.code ?? null,
      processingMs,
    });

    logDebug("STEP 1 Native raw result", {
      angle,
      inputUri: prepared.originalUri,
      preparedUri: prepared.preparedUri,
      uriScheme: prepared.uriScheme,
      width: preparedImage?.width ?? null,
      height: preparedImage?.height ?? null,
      provider: "ml_native",
      rawNativeResponse: null,
      rawLandmarkCount: 0,
      rawConfidence: null,
      errorCode: error?.code ?? null,
      errorMessage: error?.message ?? "native_extraction_failed",
    });

    return createFailureResult({
      provider: "ml_native",
      sourceSize: normalizeSourceSize(null, preparedImage),
      reason: error?.message ?? "native_extraction_failed",
      inputUri: prepared.originalUri,
      preparedUri: prepared.preparedUri,
      uriScheme: prepared.uriScheme,
      processingMs,
      errorCode: error?.code ?? "native_extraction_failed",
    });
  }
}

async function extractWithTFJSProvider(preparedImage, prepared, angle) {
  const startedAt = Date.now();

  logProvider("tfjs_selected", {
    angle,
    provider: "ml_tfjs",
    platform: Platform.OS,
    inputUri: prepared.originalUri,
    preparedUri: prepared.preparedUri,
  });

  try {
    if (Platform.OS === "android") {
      // STRICT RESOLUTION: Only Android is allowed to touch the tfjsMoveNetExtractor.android path
      const { extractWithMoveNet } = require("./tfjsMoveNetExtractor");

      const tfjsResult = await extractWithMoveNet(
        preparedImage.uri,
        Number(preparedImage.width ?? 0),
        Number(preparedImage.height ?? 0),
      );

      if (tfjsResult?.error || (tfjsResult?.landmarkCount ?? 0) <= 0) {
        logProvider("tfjs_failed", {
          angle,
          provider: "ml_tfjs",
          reason: tfjsResult?.error ?? "no_pose_detected",
          processingMs: tfjsResult?.performanceMs ?? (Date.now() - startedAt),
        });

        return null;
      }

      const sourceSize = normalizeSourceSize(null, preparedImage);
      const result = createReadyResult({
        provider: "ml_tfjs",
        landmarks: tfjsResult.landmarks ?? {},
        sourceSize,
        rawKeypointsCount: Number(tfjsResult.landmarkCount ?? 0),
        averageConfidence: tfjsResult.averageConfidence,
        processingMs: tfjsResult.performanceMs ?? (Date.now() - startedAt),
        reason: "tfjs_pose_detected",
        inputUri: prepared.originalUri,
        preparedUri: prepared.preparedUri,
        uriScheme: prepared.uriScheme,
      });

      logDebug("STEP 1 TFJS MoveNet result", {
        angle,
        inputUri: prepared.originalUri,
        uriScheme: prepared.uriScheme,
        width: preparedImage?.width ?? null,
        height: preparedImage?.height ?? null,
        provider: "ml_tfjs",
        rawNativeResponse: null,
        rawLandmarkCount: result.rawKeypointsCount,
        rawConfidence: result.averageConfidence,
        normalizedLandmarkCount: result.validKeypointsCount,
        keypointsPresent: buildRawKeypointPresence(result.landmarks),
        status: result.status,
        reason: result.reason,
      });

      return result;
    }

    // iOS/Web: Do not even attempt to bundle tfjsMoveNetExtractor
    return null;
  } catch (error) {
    logProvider("tfjs_failed", {
      angle,
      provider: "ml_tfjs",
      reason: error?.message ?? "tfjs_extraction_exception",
      processingMs: Date.now() - startedAt,
    });

    return null;
  }
}

function extractWithHeuristicProvider(preparedImage, prepared, angle, imageValidation) {
  const startedAt = Date.now();

  logProvider("heuristic_selected", {
    angle,
    provider: "heuristic",
    inputUri: prepared.originalUri,
    preparedUri: prepared.preparedUri,
    reason: "tfjs_unavailable_or_failed",
  });

  const heuristicLandmarks = buildHeuristicLandmarks(preparedImage, angle);

  if (!heuristicLandmarks) {
    logProvider("heuristic_failed", {
      angle,
      provider: "heuristic",
      reason: imageValidation.rejectionReason ?? "invalid_geometry",
    });

    return createFailureResult({
      provider: "heuristic",
      sourceSize: normalizeSourceSize(null, preparedImage),
      reason: imageValidation.rejectionReason ?? "heuristic_unavailable",
      inputUri: prepared.originalUri,
      preparedUri: prepared.preparedUri,
      uriScheme: prepared.uriScheme,
      processingMs: Date.now() - startedAt,
      errorCode: imageValidation.rejectionReason ?? "heuristic_unavailable",
    });
  }

  const result = createReadyResult({
    provider: "heuristic",
    landmarks: heuristicLandmarks,
    sourceSize: normalizeSourceSize(null, preparedImage),
    rawKeypointsCount: Object.keys(heuristicLandmarks).length,
    averageConfidence: HEURISTIC_CONFIDENCE,
    processingMs: Date.now() - startedAt,
    reason: "heuristic_fallback_used",
    inputUri: prepared.originalUri,
    preparedUri: prepared.preparedUri,
    uriScheme: prepared.uriScheme,
  });

  logDebug("STEP 1 Heuristic fallback", {
    angle,
    inputUri: prepared.originalUri,
    uriScheme: prepared.uriScheme,
    width: preparedImage?.width ?? null,
    height: preparedImage?.height ?? null,
    provider: "heuristic",
    rawNativeResponse: null,
    rawLandmarkCount: result.rawKeypointsCount,
    rawConfidence: result.averageConfidence,
    normalizedLandmarkCount: result.validKeypointsCount,
    keypointsPresent: buildRawKeypointPresence(result.landmarks),
    status: result.status,
    reason: result.reason,
    imageValidation,
  });

  return result;
}

async function extractImageLandmarks(imageAsset, angle) {
  const imageValidation = validateImageReadability(imageAsset);

  if (!imageAsset?.uri) {
    logDebug("STEP 1 Image validation", {
      angle,
      validation: imageValidation,
      provider: "missing_input",
    });

    return createExtractionResult({
      status: "missing_input",
      provider: "missing_input",
      landmarks: {},
      rawKeypointsCount: 0,
      validKeypointsCount: 0,
      averageConfidence: 0,
      processingMs: null,
      reason: "missing_input",
      sourceSize: normalizeSourceSize(null, imageAsset),
      inputUri: null,
      preparedUri: null,
      uriScheme: "unknown",
      errorCode: "missing_input",
    });
  }

  logDebug("STEP 1 Image validation", {
    angle,
    validation: imageValidation,
  });

  const prepared = await prepareImageAssetForExtraction(imageAsset, angle);
  const preparedImage = prepared.asset ?? imageAsset;

  // iOS STABILIZATION: Force heuristic mode on iOS to avoid tfjs/native crashes in Expo Go
  if (Platform.OS === "ios") {
    return extractWithHeuristicProvider(preparedImage, prepared, angle, imageValidation);
  }

  const nativeAvailable = Platform.OS === "android" && Boolean(LANDMARK_MODULE?.extractFromUri);

  if (nativeAvailable) {
    return extractWithNativeModule(preparedImage, prepared, angle);
  }

  const tfjsResult = await extractWithTFJSProvider(preparedImage, prepared, angle);
  if (tfjsResult) {
    return tfjsResult;
  }

  return extractWithHeuristicProvider(preparedImage, prepared, angle, imageValidation);
}

function resolveAggregateProvider(results) {
  if (results.some((result) => result?.provider === "heuristic")) {
    return "heuristic";
  }

  if (results.some((result) => result?.provider === "ml_tfjs")) {
    return "ml_tfjs";
  }

  if (results.some((result) => result?.provider === "ml_native")) {
    return "ml_native";
  }

  return results.find((result) => Boolean(result?.provider))?.provider ?? "unsupported";
}

function resolveAnalysisMode(results) {
  if (results.some((result) => result?.provider === "heuristic")) {
    return "heuristic";
  }

  if (results.some((result) => result?.provider === "ml_tfjs")) {
    return "ml";
  }

  if (results.some((result) => result?.provider === "ml_native")) {
    return "ml";
  }

  return "ml";
}

export async function extractSinglePostureImage(imageAsset, angle = "front") {
  return extractImageLandmarks(imageAsset, angle);
}

export async function extractPostureLandmarks({ frontImage, sideImage, backImage }) {
  const [front, side, back] = await Promise.all([
    extractImageLandmarks(frontImage, "front"),
    extractImageLandmarks(sideImage, "side"),
    extractImageLandmarks(backImage, "back"),
  ]);

  const results = [front, side, back].filter(Boolean);
  const provider = resolveAggregateProvider(results);
  const analysisMode = resolveAnalysisMode(results);

  logDebug("STEP 1 Extraction aggregate", {
    provider,
    analysisMode,
    front: {
      status: front.status,
      inputUri: front.inputUri,
      preparedUri: front.preparedUri,
      uriScheme: front.uriScheme,
      rawKeypointsCount: front.rawKeypointsCount,
      validKeypointsCount: front.validKeypointsCount,
      averageConfidence: front.averageConfidence,
      processingMs: front.processingMs,
      reason: front.reason,
    },
    side: {
      status: side.status,
      inputUri: side.inputUri,
      preparedUri: side.preparedUri,
      uriScheme: side.uriScheme,
      rawKeypointsCount: side.rawKeypointsCount,
      validKeypointsCount: side.validKeypointsCount,
      averageConfidence: side.averageConfidence,
      processingMs: side.processingMs,
      reason: side.reason,
    },
    back: {
      status: back?.status ?? "missing_input",
      inputUri: back?.inputUri ?? null,
      preparedUri: back?.preparedUri ?? null,
      uriScheme: back?.uriScheme ?? "unknown",
      rawKeypointsCount: back?.rawKeypointsCount ?? 0,
      validKeypointsCount: back?.validKeypointsCount ?? 0,
      averageConfidence: back?.averageConfidence ?? 0,
      processingMs: back?.processingMs ?? null,
      reason: back?.reason ?? null,
    },
  });

  return {
    provider,
    analysisMode,
    front,
    side,
    back,
  };
}
