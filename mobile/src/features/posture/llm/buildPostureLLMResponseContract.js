/**
 * @file buildPostureLLMResponseContract.js
 * @description The rigid JSON shape that the future LLM must output to properly sync with the application UI.
 */

import { PostureLLMSchema } from "./postureLLMSchema";

export function buildPostureLLMResponseContract() {
  // Returns the empty contract shape. In the actual LLM call, 
  // you stringify this structure to inform the prompt what keys are required.
  return PostureLLMSchema.createResponseContract();
}
