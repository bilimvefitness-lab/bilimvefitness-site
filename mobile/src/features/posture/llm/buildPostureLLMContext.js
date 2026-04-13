/**
 * @file buildPostureLLMContext.js
 * @description Curates Layer 1-4 data for LLM consumption, stripping out raw mathematical noise.
 */

import { PostureLLMSchema } from "./postureLLMSchema";
import { PostureInterpretationMap } from "../knowledge/postureInterpretationMap";

const MEMORY_PREFIX = "[POSTURE_LLM_PREP]";

export function buildPostureLLMContext(layer1Result, postureProfileState, knowledgeOutput) {
  console.log(`${MEMORY_PREFIX} Building Curated Context...`);
  
  const ctx = PostureLLMSchema.createLLMContextPacket();
  
  if (!layer1Result || !postureProfileState?.postureProfile || !knowledgeOutput) return ctx;

  const profile = postureProfileState.postureProfile;
  const current = profile.currentState;
  const trendState = profile.trendState || {};
  const baselineState = profile.baselineState || {};
  const captureState = profile.captureState || {};
  
  // Clean signals format
  const currentSigns = Object.keys(layer1Result.findings || {}).filter(k => 
    layer1Result.findings[k] && layer1Result.findings[k] !== "none" && layer1Result.findings[k] !== "unknown"
  );
  
  const cleanSignals = currentSigns.map(sig => {
    return {
      type: sig,
      severity: layer1Result.findings[sig] === true ? "medium" : layer1Result.findings[sig],
      confidence: layer1Result.confidence || "low",
      sourceViews: [PostureInterpretationMap[sig]?.sourceViewHint || "unknown"]
    };
  });

  ctx.postureContext.current = {
    status: layer1Result.status || "fail",
    score: current.score,
    confidence: current.confidence,
    quality: current.quality,
    limitedMode: layer1Result.uiMeta?.limitedMode || layer1Result.summary?.includes("platform_limited") || false,
    viewsUsed: layer1Result.viewsUsed || [],
    primaryFocus: knowledgeOutput.focus?.primaryFocus || null,
    secondaryFocus: knowledgeOutput.focus?.secondaryFocus || null,
    signals: cleanSignals
  };

  ctx.postureContext.trend = {
    overall: trendState.scoreTrend || "unknown",
    signalTrends: trendState.signalTrends || {}
  };

  ctx.postureContext.baseline = {
    trusted: baselineState.trustedBaseline || false,
    baselineScore: baselineState.baselineScore || null
  };

  const captureIssues = [];
  if (captureState.weakAngles?.length > 0) {
    captureIssues.push(...captureState.weakAngles.map(a => `${a}_weak_angle`));
  }
  
  ctx.postureContext.capture = {
    issues: captureIssues,
    mostReliableAngle: postureProfileState.mostReliableAngle || null // Note: might not be directly available, fallback to null
  };

  ctx.postureContext.explainability = {
    focusExplanation: knowledgeOutput.explainability?.focusExplanation || null
  };

  // Explicitly avoid packing `layer1Result.measurements` or `layer1Result.landmarks`
  
  return ctx;
}
