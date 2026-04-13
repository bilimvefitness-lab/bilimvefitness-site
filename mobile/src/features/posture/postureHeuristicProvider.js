/**
 * Posture Heuristic Provider (Validation-Only)
 * 
 * Provides a minimal fallback when ML extraction fails.
 * Does NOT generate pseudo-landmarks or findings.
 * Used only for capture quality metadata and UI gating.
 */

function getLimitedExtraction(imageAsset) {
  return {
    status: "limited_mode",
    sourceSize: {
      width: imageAsset?.width ?? 1080,
      height: imageAsset?.height ?? 1920,
    },
    landmarks: {},
    landmarkCount: 0,
    errorCode: "ml_unavailable",
    provider: "heuristic_engine",
    analysisMode: "heuristic",
  };
}

export async function generateHeuristicExtraction({ frontImage, sideImage, backImage }) {
  console.log("[POSTURE_FIX_DEBUG] Heuristic provider invoked");

  return {
    provider: "heuristic_engine",
    analysisMode: "heuristic",
    front: getLimitedExtraction(frontImage),
    side: getLimitedExtraction(sideImage),
    back: backImage ? getLimitedExtraction(backImage) : null,
  };
}
