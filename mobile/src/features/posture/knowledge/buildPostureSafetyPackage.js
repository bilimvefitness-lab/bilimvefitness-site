/**
 * @file buildPostureSafetyPackage.js
 * @description Applies safety language rules and issues diagnostic block notes.
 */

import { PostureKnowledgeSchema } from "./postureKnowledgeSchema";
import { PostureSafetyLanguageRules } from "./postureSafetyLanguageRules";

const MEMORY_PREFIX = "[POSTURE_KNOWLEDGE_MEMORY]";

export function buildPostureSafetyPackage(layer1Result) {
  const packageData = PostureKnowledgeSchema.createSafetyPackage();
  
  if (!layer1Result) return packageData;

  const isLimited = layer1Result.uiMeta?.limitedMode || layer1Result.summary?.includes("platform_limited");
  packageData.safety.limitedMode = isLimited || false;

  if (isLimited) {
    packageData.safety.note = "Bu değerlendirme sınırlı koşullarda yapıldı (örn: yetersiz ışık, vücut hatlarının tam görünmemesi). Sonuçlar daha esnektir. " + PostureSafetyLanguageRules.preferredPhrases[3];
  } else if (layer1Result.confidence === "low") {
    packageData.safety.note = PostureSafetyLanguageRules.preferredPhrases[2] + ". " + PostureSafetyLanguageRules.preferredPhrases[3];
  }

  // A full text filter would optionally run here over other packages,
  // but for the knowledge output structure we flag the state.
  packageData.safety.blockedTermsFiltered = true; 

  console.log(`${MEMORY_PREFIX} safety package built`, {
    limitedMode: packageData.safety.limitedMode
  });

  return packageData;
}
