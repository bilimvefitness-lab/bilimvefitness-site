/**
 * @file postureServerAnalysis.js
 * @description Server-side posture analysis via MediaPipe backend.
 *
 * Flow:
 *   1. Upload front/side/back images as multipart form data
 *   2. Backend runs MediaPipe Pose Landmarker (heavy model)
 *   3. Returns score, confidence, issues, angles per view
 *   4. Client maps response into extraction pipeline format
 */

import { API_BASE_URL } from "../../api";

const LOG_PREFIX = "[POSTURE_SERVER]";
const ENDPOINT = "/posture/analyze";
const TIMEOUT_MS = 30000;

/**
 * Check if server-side analysis is reachable.
 * Fast health check — does not load the model.
 */
export async function isServerAnalysisAvailable() {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_BASE_URL}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Build a FormData entry for a single image file.
 */
function appendImage(formData, fieldName, uri) {
  if (!uri) return;

  const fileName = `${fieldName}.jpg`;
  formData.append(fieldName, {
    uri,
    type: "image/jpeg",
    name: fileName,
  });
}

/**
 * Send images to backend for full posture analysis.
 *
 * @param {{ frontUri?: string, sideUri?: string, backUri?: string }} images
 * @returns {Promise<object|null>} Server analysis result or null on failure
 */
export async function analyzePostureOnServer(images) {
  if (!images?.frontUri && !images?.sideUri && !images?.backUri) {
    console.log(`${LOG_PREFIX} No images provided`);
    return null;
  }

  const url = `${API_BASE_URL}${ENDPOINT}`;
  console.log(`${LOG_PREFIX} Sending to ${url}`);

  const formData = new FormData();
  appendImage(formData, "front", images.frontUri);
  appendImage(formData, "side", images.sideUri);
  appendImage(formData, "back", images.backUri);

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(url, {
      method: "POST",
      body: formData,
      signal: controller.signal,
      // Do NOT set Content-Type — fetch sets multipart boundary automatically
    });

    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      console.warn(`${LOG_PREFIX} Server error ${response.status}: ${errorText}`);
      return null;
    }

    const result = await response.json();

    console.log(`${LOG_PREFIX} Server result`, {
      score: result.score,
      confidence: result.confidence,
      issueCount: result.issues?.length ?? 0,
      views: Object.keys(result.views ?? {}),
      processingMs: result.processing_ms,
    });

    return result;
  } catch (error) {
    if (error?.name === "AbortError") {
      console.warn(`${LOG_PREFIX} Request timed out (${TIMEOUT_MS}ms)`);
    } else {
      console.warn(`${LOG_PREFIX} Request failed: ${error?.message}`);
    }
    return null;
  }
}

/**
 * Map server response angles into internal landmark format.
 * Creates synthetic landmarks from the server's angle measurements
 * so the existing pipeline can process them.
 */
function buildLandmarksFromServerView(viewData, viewAngles) {
  if (!viewData?.detected) return null;

  // The server returns angles and visibility, not raw landmarks.
  // We create normalized landmarks at canonical positions for the pipeline.
  const cx = 0.5;
  const conf = Math.min(viewData.avg_visibility, 0.99);

  return {
    nose:           { x: cx, y: 0.10, z: null, confidence: conf },
    leftEar:        { x: cx - 0.04, y: 0.10, z: null, confidence: conf },
    rightEar:       { x: cx + 0.04, y: 0.10, z: null, confidence: conf },
    leftShoulder:   { x: cx - 0.13, y: 0.22, z: null, confidence: conf },
    rightShoulder:  { x: cx + 0.13, y: 0.22, z: null, confidence: conf },
    leftHip:        { x: cx - 0.09, y: 0.52, z: null, confidence: conf },
    rightHip:       { x: cx + 0.09, y: 0.52, z: null, confidence: conf },
    leftKnee:       { x: cx - 0.07, y: 0.72, z: null, confidence: conf },
    rightKnee:      { x: cx + 0.07, y: 0.72, z: null, confidence: conf },
    leftAnkle:      { x: cx - 0.07, y: 0.92, z: null, confidence: conf },
    rightAnkle:     { x: cx + 0.07, y: 0.92, z: null, confidence: conf },
  };
}

/**
 * Convert server analysis result into the format expected by postureAnalysisEngine.
 * This allows the server result to bypass the client-side extraction + measurement pipeline
 * and feed directly into the scoring/presentation layer.
 *
 * @param {object} serverResult - Raw response from POST /posture/analyze
 * @returns {object} Formatted result compatible with the engine
 */
export function mapServerResultToEngineFormat(serverResult) {
  if (!serverResult) return null;

  return {
    provider: "ml_server",
    analysisMode: "ml",
    serverResult,
    score: serverResult.score,
    confidence: serverResult.confidence,
    issues: serverResult.issues ?? [],
    angles: serverResult.angles ?? {},
    message: serverResult.message ?? "",
    views: serverResult.views ?? {},
    processingMs: serverResult.processing_ms ?? 0,
  };
}
