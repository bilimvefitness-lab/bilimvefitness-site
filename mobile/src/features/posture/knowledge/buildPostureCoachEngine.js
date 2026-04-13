/**
 * @file buildPostureCoachEngine.js
 * @description Layer 6 - Transforms posture analysis into clear, actionable, daily behavior guidance.
 */

import { PostureRecommendationKnowledge } from "./postureRecommendationKnowledge";

const MEMORY_PREFIX = "[POSTURE_COACH_ENGINE]";

export function buildPostureCoachEngine(focusEngineResult, knowledgeOutput, layer1Result, postureProfileState) {
  console.log(`${MEMORY_PREFIX} Building Coach Engine...`);

  const coach = {
    dailyFocus: "Duruş Farkındalığı",
    primaryAction: "Şimdi. Temel duruşunu hizala.",
    secondaryAction: "Gün içinde postürünü kontrol et.",
    microHabit: "Telefon veya bilgisayar kullanırken vücut ağırlığını eşit dağıt.",
    difficulty: "low",
    estimatedImpact: "medium"
  };

  if (!focusEngineResult || !layer1Result) return coach;

  const { primaryFocus, secondaryFocus } = focusEngineResult;
  const trend = knowledgeOutput?.trend?.direction || "stable";
  const confidence = layer1Result.confidence || "low";
  const isLimited = layer1Result.uiMeta?.limitedMode || false;

  // 1. Daily Focus
  if (primaryFocus && PostureRecommendationKnowledge[primaryFocus]) {
    coach.dailyFocus = PostureRecommendationKnowledge[primaryFocus].focusArea;
  }

  // 2. Primary Action Generation
  if (primaryFocus && PostureRecommendationKnowledge[primaryFocus]) {
    const rawAction = PostureRecommendationKnowledge[primaryFocus].dailyAction;
    
    if (confidence === "low" || isLimited) {
      coach.primaryAction = `Şu anki odak: ${rawAction.replace("yaklaştır.", "yaklaştırmayı dene.").replace("aç.", "açmaya çalış.")} (Farkındalık pratiği)`;
      coach.difficulty = "low";
    } else if (trend === "worsening") {
      coach.primaryAction = `Hemen şimdi! ${rawAction}`;
      coach.difficulty = "medium";
      coach.estimatedImpact = "high";
    } else if (trend === "improving") {
      coach.primaryAction = `Harika gidiyorsun. ${rawAction} alışkanlığını koru.`;
      coach.difficulty = "low";
      coach.estimatedImpact = "medium";
    } else {
      coach.primaryAction = `Şimdi. ${rawAction}`;
      coach.difficulty = "low";
    }
  }

  // 3. Secondary Action Generation
  if (secondaryFocus && PostureRecommendationKnowledge[secondaryFocus]) {
    const rawSecAction = PostureRecommendationKnowledge[secondaryFocus].dailyAction;
    coach.secondaryAction = `Destekleyici pratik: ${rawSecAction}`;
  } else if (primaryFocus) {
    coach.secondaryAction = "30 dk sonra duruşunu tekrar kontrol et.";
  }

  // 4. Micro Habit
  if (primaryFocus && PostureRecommendationKnowledge[primaryFocus]?.coachingHint) {
    coach.microHabit = PostureRecommendationKnowledge[primaryFocus].coachingHint;
  }

  return coach;
}
