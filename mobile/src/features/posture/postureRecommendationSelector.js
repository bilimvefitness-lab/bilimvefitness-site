import { selectPostureRecommendations } from "./postureExerciseRecommendations";

export function selectPostureRecommendation({ findings, confidence, measurements }) {
  const selected = selectPostureRecommendations({
    findings,
    confidence,
    measurements,
    summary: measurements?.completeness?.hasAnySignal ? [] : ["insufficient_visibility"],
  });

  return selected[0] || "retake_guidance";
}
