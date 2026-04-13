/**
 * @file buildPostureTemplateOutput.js
 * @description A deterministic fallback generator that produces the exact shape of an LLM Response Contract using purely local Layer 3 output.
 */

import { buildPostureLLMResponseContract } from "./buildPostureLLMResponseContract";

const MEMORY_PREFIX = "[POSTURE_LLM_PREP]";

export function buildPostureTemplateOutput(knowledgeOutput) {
  console.log(`${MEMORY_PREFIX} Generating Template Fallback Output...`);

  const output = buildPostureLLMResponseContract();

  if (!knowledgeOutput) return output;

  // 1. Summary
  const primaryExp = knowledgeOutput.explanations?.[0];
  output.summary = primaryExp?.text || "Analiz tamamlandı.";

  // 2. Focus Message
  const primaryFocusData = knowledgeOutput.coaching?.primaryFocus;
  if (primaryFocusData) {
    output.focusMessage = `Bugün öncelikli odaklanmamız gereken bölge: ${primaryFocusData.focusArea}.`;
  }

  // 3. Coaching Message
  if (primaryFocusData?.dailyAction) {
    output.coachingMessage = `${primaryFocusData.dailyAction} ${primaryFocusData.coachingHint || ''}`.trim();
  }

  // 4. Confidence Message
  output.confidenceMessage = knowledgeOutput.explainability?.systemConfidence?.note || "";

  // 5. Trend Message
  output.trendMessage = knowledgeOutput.explainability?.trendExplanation || "";

  // 6. Capture Message
  if (knowledgeOutput.coaching?.urgentGuidance) {
    output.captureMessage = knowledgeOutput.coaching.urgentGuidance.hint;
  } else if (knowledgeOutput.explainability?.captureImpact) {
    output.captureMessage = knowledgeOutput.explainability.captureImpact.humanReadable;
  }

  return output;
}
