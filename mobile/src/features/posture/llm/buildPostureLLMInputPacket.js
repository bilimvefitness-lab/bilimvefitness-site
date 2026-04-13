/**
 * @file buildPostureLLMInputPacket.js
 * @description Assembles the final bundled context sent to the future Language Model.
 */

import { PostureLLMSchema } from "./postureLLMSchema";
import { buildPostureLLMContext } from "./buildPostureLLMContext";
import { buildPostureLLMSafetyGuards } from "./buildPostureLLMSafetyGuards";

const MEMORY_PREFIX = "[POSTURE_LLM_PREP]";

export function buildPostureLLMInputPacket(layer1Result, postureProfileState, knowledgeOutput) {
  console.log(`${MEMORY_PREFIX} Assembling Final LLM Input Packet...`);

  const packet = PostureLLMSchema.createLLMInputPacket();

  // 1. Gather Context
  packet.systemContext = buildPostureLLMContext(layer1Result, postureProfileState, knowledgeOutput);

  // 2. Apply Guards
  packet.safetyGuards = buildPostureLLMSafetyGuards(packet.systemContext);

  // 3. Inject Base Knowledge (To give the LLM the Layer 3 standard templates to enrich)
  packet.baseKnowledgeOutput = {
    summaryBaseline: knowledgeOutput.explanations?.[0]?.text || null,
    coachingBaseline: knowledgeOutput.coaching?.dailyAction || null,
    trendBaseline: knowledgeOutput.trend?.direction || null
  };

  return packet;
}
