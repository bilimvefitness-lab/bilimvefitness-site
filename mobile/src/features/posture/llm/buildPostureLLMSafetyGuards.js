/**
 * @file buildPostureLLMSafetyGuards.js
 * @description Evaluates system state to raise flags that constrain the future LLM behavior.
 */

import { PostureLLMSchema } from "./postureLLMSchema";

const MEMORY_PREFIX = "[POSTURE_LLM_PREP]";

export function buildPostureLLMSafetyGuards(llmContextPacket) {
  console.log(`${MEMORY_PREFIX} Applying Safety Guards...`);

  const guards = PostureLLMSchema.createLLMSafetyGuards();

  if (!llmContextPacket || !llmContextPacket.postureContext) return guards;

  const current = llmContextPacket.postureContext.current;
  const baseline = llmContextPacket.postureContext.baseline;

  // 1. Confidence Guard
  if (current.confidence === "low") {
    guards.lowConfidenceGuard = true;
  }

  // 2. Limited Mode Guard
  if (current.limitedMode) {
    guards.limitedModeGuard = true;
  }

  // 3. Weak Evidence Guard (If no clear signals emerged)
  if (!current.primaryFocus || current.signals.length === 0) {
    guards.weakEvidenceGuard = true;
  }

  // 4. Trend Guard (If baseline is untrusted, warn against declaring absolute trends)
  if (!baseline.trusted) {
    guards.trendGuard = true;
  }

  // medicalEscalationFlag can be hooked to some explicit danger signs 
  // (e.g. user reports pain, or severity extremely high across spine). 
  // currently we keep it false unless extended in the future.
  
  return guards;
}
