/**
 * @file buildPostureExplanationPackage.js
 * @description Builds human-readable analysis explanations.
 */

import { PostureKnowledgeSchema } from "./postureKnowledgeSchema";
import { PostureInterpretationMap } from "./postureInterpretationMap";
import { PostureSeverityLanguageMap } from "./postureSeverityLanguageMap";
import { PostureConfidenceLanguageMap } from "./postureConfidenceLanguageMap";

const MEMORY_PREFIX = "[POSTURE_KNOWLEDGE_MEMORY]";

export function buildPostureExplanationPackage(postureProfileState, layer1Result) {
  const packageData = PostureKnowledgeSchema.createExplanationPackage();

  if (!postureProfileState || !layer1Result) return packageData;

  const currentConfidence = postureProfileState.postureProfile?.currentState?.confidence || "low";
  const dominantSignals = postureProfileState.postureProfile?.currentState?.dominantSignals || [];
  
  // If we only want top 1-3 signals, we can slice here
  const targetSignals = dominantSignals.slice(0, 3);

  // We need severity of each signal to inject it. We can get this from Layer 1 findings.
  const layer1Signals = layer1Result.findings || {};

  targetSignals.forEach(signalType => {
    const interpretationInfo = PostureInterpretationMap[signalType];
    if (!interpretationInfo) return;

    let targetSev = "medium";
    // Convert e.g., forwardHead true to "medium" or keep kyphosis "low"
    // Since Layer 1 findings format is a bit loose, we'll try to map it.
    // E.g., layer1Signals.forwardHead = true -> "medium"
    const camelCased = signalType.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    const rawVal = layer1Signals[camelCased];
    
    if (rawVal === "low" || rawVal === "medium" || rawVal === "high") {
      targetSev = rawVal;
    } else if (rawVal === "marked_deviation") {
      targetSev = "high";
    } else if (rawVal === "slight_deviation" || rawVal === "left_low" || rawVal === "right_low" || rawVal === true) {
      targetSev = "medium";
    }

    const descriptionsObj = interpretationInfo.descriptions[targetSev] || { standard: interpretationInfo.neutralFallback, short: interpretationInfo.neutralFallback, expanded: interpretationInfo.neutralFallback };
    const severityMap = PostureSeverityLanguageMap[targetSev] || PostureSeverityLanguageMap["medium"];
    
    // Inject severity suffix for all variations
    const formatText = (template) => {
      let t = template.replace("{severity_suffix}", severityMap.suffix);
      // Apply confidence hedging
      const confidenceMap = PostureConfidenceLanguageMap[currentConfidence];
      if (confidenceMap && confidenceMap.templates) {
         t = confidenceMap.templates.observation.replace("{text}", t);
      }
      return t.replace(/\.\./g, ".").replace(/\. \./g, ".");
    };

    const textVariations = {
      short: formatText(descriptionsObj.short || descriptionsObj.standard),
      standard: formatText(descriptionsObj.standard),
      expanded: formatText(descriptionsObj.expanded || descriptionsObj.standard)
    };

    packageData.explanations.push({
      signal: signalType,
      text: textVariations.standard, // fallback default
      components: textVariations,
      sourceViews: [interpretationInfo.sourceViewHint],
      confidence: currentConfidence
    });
  });

  console.log(`${MEMORY_PREFIX} explanation package built`, {
    explanationsCount: packageData.explanations.length
  });

  return packageData;
}
