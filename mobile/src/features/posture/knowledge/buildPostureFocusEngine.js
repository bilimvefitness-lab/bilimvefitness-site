/**
 * @file buildPostureFocusEngine.js
 * @description Analyzes posture signals and selects a primary and secondary focus for coaching.
 */

const SEVERITY_WEIGHTS = { high: 3, medium: 2, low: 1 };

export function buildPostureFocusEngine(layer1Result, postureProfileState) {
  if (!layer1Result || !postureProfileState?.postureProfile) return null;

  const currentSigns = Object.keys(layer1Result.findings || {}).filter(k => 
    layer1Result.findings[k] && layer1Result.findings[k] !== "none" && layer1Result.findings[k] !== "unknown"
  );

  const patternState = postureProfileState.postureProfile.patternState || {};
  const trendState = postureProfileState.postureProfile.trendState || {};
  const confidence = layer1Result.confidence || "low";
  const isLimitedMode = layer1Result.uiMeta?.limitedMode || layer1Result.summary?.includes("platform_limited");

  const scores = {};
  
  currentSigns.forEach(signal => {
    let focusScore = 0;

    // 1. Severity Score
    // Convert e.g., 'kyphosis' value to "medium"/"low"/"high"
    let severity = "low";
    const rawVal = layer1Result.findings[signal];
    if (rawVal === "low" || rawVal === "medium" || rawVal === "high") {
      severity = rawVal;
    } else if (rawVal === "marked_deviation") {
      severity = "high";
    } else if (rawVal === "slight_deviation" || rawVal === "left_low" || rawVal === "right_low" || rawVal === true) {
      severity = "medium";
    }

    focusScore += (SEVERITY_WEIGHTS[severity] || 0);

    // 2. Persistence Score
    if (patternState.persistentSignals?.includes(signal)) {
      focusScore += 2;
    } else if (patternState.emergingSignals?.includes(signal)) {
      focusScore += 1;
    }

    // 3. Trend Score
    const trend = trendState.signalTrends?.[signal];
    if (trend === "worsening") {
      focusScore += 1;
    } else if (trend === "improving") {
      focusScore -= 1;
    }

    // 4. Confidence & Limited Mode Dampening
    if (confidence === "low") {
      focusScore -= 1;
    }

    if (isLimitedMode) {
      focusScore = Math.max(0, focusScore - 1); // Reduce aggressiveness
    }

    scores[signal] = focusScore;
  });

  // Sort signals by score descending
  const sortedSignals = Object.keys(scores)
    .filter(sig => scores[sig] > 0)
    .sort((a, b) => scores[b] - scores[a]);

  if (sortedSignals.length === 0) {
    return {
      primaryFocus: null,
      secondaryFocus: null,
      ignoredSignals: currentSigns,
      scores,
      reason: "Bütün sinyaller düşük öncelikli veya odaklanmaya yetersiz."
    };
  }

  const primaryFocus = sortedSignals[0] || null;
  const secondaryFocus = sortedSignals[1] || null;
  const ignoredSignals = currentSigns.filter(sig => sig !== primaryFocus && sig !== secondaryFocus);

  return {
    primaryFocus,
    secondaryFocus,
    ignoredSignals,
    scores,
    reason: `Seçilen ana odak ${primaryFocus} çünkü skoru (${scores[primaryFocus]}) en yüksek.`
  };
}
