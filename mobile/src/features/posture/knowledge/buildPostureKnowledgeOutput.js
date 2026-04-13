/**
 * @file buildPostureKnowledgeOutput.js
 * @description The master composer. Consumes Layer 1 and Layer 2 outputs to produce the final Layer 3 Knowledge Output.
 */

import { buildPostureExplanationPackage } from "./buildPostureExplanationPackage";
import { buildPostureCoachingPackage } from "./buildPostureCoachingPackage";
import { buildPostureSafetyPackage } from "./buildPostureSafetyPackage";
import { buildPostureTrendPackage } from "./buildPostureTrendPackage";
import { buildPostureFocusEngine } from "./buildPostureFocusEngine";
import { buildPostureExplainabilityEngine } from "./buildPostureExplainabilityEngine";
import { buildPostureCoachEngine } from "./buildPostureCoachEngine";
import { buildPostureHabitEngine } from "./buildPostureHabitEngine";
import { PostureSafetyLanguageRules } from "./postureSafetyLanguageRules";

const MEMORY_PREFIX = "[POSTURE_KNOWLEDGE_MEMORY]";

function applySafetyFilter(text) {
  if (!text) return text;
  let filteredText = text;
  PostureSafetyLanguageRules.forbiddenPhrases.forEach(phrase => {
    // Basic replacement for safety
    const regex = new RegExp(phrase, "gi");
    filteredText = filteredText.replace(regex, PostureSafetyLanguageRules.preferredPhrases[0]);
  });
  return filteredText;
}

export function buildPostureKnowledgeOutput(layer1Result, postureProfileState) {
  console.log(`${MEMORY_PREFIX} building knowledge output...`);

  const focusEngineResult = buildPostureFocusEngine(layer1Result, postureProfileState);
  const explainabilityResult = buildPostureExplainabilityEngine(layer1Result, postureProfileState, focusEngineResult);
  
  const explanationPackage = buildPostureExplanationPackage(postureProfileState, layer1Result);
  const coachingPackage = buildPostureCoachingPackage(postureProfileState, focusEngineResult);
  const safetyPackage = buildPostureSafetyPackage(layer1Result);
  const trendPackage = buildPostureTrendPackage(postureProfileState);

  // Apply final safety text filter over explanations
  explanationPackage.explanations = explanationPackage.explanations.map(exp => ({
    ...exp,
    text: applySafetyFilter(exp.text),
    components: exp.components ? {
      short: applySafetyFilter(exp.components.short),
      standard: applySafetyFilter(exp.components.standard),
      expanded: applySafetyFilter(exp.components.expanded)
    } : exp.components
  }));

  const knowledgeOutputPartial = {
    focus: focusEngineResult || null,
    ...explanationPackage,
    ...coachingPackage,
    ...safetyPackage,
    ...trendPackage,
    explainability: explainabilityResult || null
  };

  const coachResult = buildPostureCoachEngine(focusEngineResult, knowledgeOutputPartial, layer1Result, postureProfileState);

  // Note: userActionLogs would typically come from an external profile or state. 
  // Passing an empty object here causes it to try inferring from history count.
  const habitResult = buildPostureHabitEngine(coachResult, {}, postureProfileState);

  const knowledgeOutput = {
    ...knowledgeOutputPartial,
    coach: coachResult,
    habit: habitResult
  };

  console.log(`${MEMORY_PREFIX} knowledge output complete`);

  return knowledgeOutput;
}
