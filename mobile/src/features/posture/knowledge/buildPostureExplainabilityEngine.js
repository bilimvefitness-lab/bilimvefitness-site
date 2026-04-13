/**
 * @file buildPostureExplainabilityEngine.js
 * @description Provides a human-readable transparent explanation of the system's reasoning for focus selection, confidence, and trends.
 */

import { PostureInterpretationMap } from "./postureInterpretationMap";
import { PostureCaptureGuidanceKnowledge } from "./postureCaptureGuidanceKnowledge";

const MEMORY_PREFIX = "[POSTURE_EXPLAINABILITY_ENGINE]";

function generateFocusExplanation(signal, focusEngineResult, postureProfileState, isPrimary) {
  if (!signal) return null;

  const scoreInfo = focusEngineResult?.scores?.[signal] || 0;
  const patternState = postureProfileState?.postureProfile?.patternState || {};
  const trendState = postureProfileState?.postureProfile?.trendState?.signalTrends || {};

  let reasonFragments = [];
  let humanReadable = "";
  const label = PostureInterpretationMap[signal]?.label || "Bu bulgu";

  // Reason generation
  if (scoreInfo >= 3) reasonFragments.push("yüksek öncelikli");
  else if (scoreInfo >= 2) reasonFragments.push("orta öncelikli");
  
  if (patternState.persistentSignals?.includes(signal)) {
    reasonFragments.push("tekrarlayan eğilim");
    humanReadable = `${label}, geçmiş ölçümlerde de tekrarlayan bir eğilim gösterdiği için ${isPrimary ? 'ana odak' : 'ikincil odak'} seçildi.`;
  } else if (patternState.emergingSignals?.includes(signal)) {
    reasonFragments.push("yeni ortaya çıkan durum");
    humanReadable = `${label}, son analizlerde yeni ortaya çıkan bir eğilim olduğu için ${isPrimary ? 'ana odak' : 'ikincil odak'} seçildi.`;
  } else {
    humanReadable = `${label}, mevcut analizdeki ağırlığı nedeniyle ${isPrimary ? 'ana odak' : 'ikincil odak'} olarak belirlendi.`;
  }

  const trendVal = trendState[signal];
  let trendNote = "stabil";
  if (trendVal === "worsening") trendNote = "gelişim yönü zayıflıyor";
  if (trendVal === "improving") trendNote = "iyileşme eğiliminde";

  return {
    signal,
    reason: reasonFragments.join(" ve ") || "mevcut şiddet",
    confidenceNote: "mevcut güven seviyesine göre değerlendirildi",
    trendNote,
    humanReadable
  };
}

export function buildPostureExplainabilityEngine(layer1Result, postureProfileState, focusEngineResult) {
  console.log(`${MEMORY_PREFIX} building explainability output...`);

  const explainability = {
    focusExplanation: {
      primary: null,
      secondary: null
    },
    signalBreakdown: [],
    systemConfidence: {
      overall: "low",
      note: ""
    },
    trendExplanation: "Yeterli veri yok.",
    captureImpact: null
  };

  if (!layer1Result || !postureProfileState?.postureProfile) return explainability;

  // 1. Focus Explanation
  explainability.focusExplanation.primary = generateFocusExplanation(
    focusEngineResult?.primaryFocus, 
    focusEngineResult, 
    postureProfileState, 
    true
  );
  explainability.focusExplanation.secondary = generateFocusExplanation(
    focusEngineResult?.secondaryFocus, 
    focusEngineResult, 
    postureProfileState, 
    false
  );

  // 2. Signal Breakdown
  const currentSigns = Object.keys(layer1Result.findings || {}).filter(k => 
    layer1Result.findings[k] && layer1Result.findings[k] !== "none" && layer1Result.findings[k] !== "unknown"
  );
  const patternState = postureProfileState.postureProfile.patternState || {};

  explainability.signalBreakdown = currentSigns.map(sig => {
    let patternType = "occasional";
    if (patternState.persistentSignals?.includes(sig)) patternType = "persistent";
    else if (patternState.emergingSignals?.includes(sig)) patternType = "emerging";

    return {
      signal: sig,
      detectedFrom: [PostureInterpretationMap[sig]?.sourceViewHint || "unknown"],
      confidence: layer1Result.confidence || "low",
      severity: layer1Result.findings[sig] === true ? "medium" : layer1Result.findings[sig],
      pattern: patternType
    };
  });

  // 3. System Confidence Explanation
  const conf = layer1Result.confidence || "low";
  const isLimited = layer1Result.uiMeta?.limitedMode || false;
  explainability.systemConfidence.overall = conf;
  
  if (isLimited) {
    explainability.systemConfidence.note = "Sistem kısıtlı görüş modunda. Sonuçlar sınırlı veri noktasıyla değerlendirildi.";
  } else if (conf === "high") {
    explainability.systemConfidence.note = "Çekim şartları optimal, yüksek güvenle değerlendirildi.";
  } else if (conf === "medium") {
    explainability.systemConfidence.note = "Ortalama görüntü kalitesi üzerinden makul bir güven düzeyiyle yorumlandı.";
  } else {
    explainability.systemConfidence.note = "Düşük görünürlük nedeniyle sistem çok temkinli bir değerlendirme yaptı.";
  }

  // 4. Trend Explanation
  const trendScore = postureProfileState.postureProfile.trendState?.scoreTrend || "stable";
  if (trendScore === "improving") {
    explainability.trendExplanation = "Genel duruş profilin önceki ölçümlere kıyasla iyileşme gösteriyor.";
  } else if (trendScore === "worsening") {
    explainability.trendExplanation = "Son dönemde duruş eğiliminde hafif bir zayıflama var, odaklanmak faydalı olabilir.";
  } else {
    explainability.trendExplanation = "Genel duruş profilin stabil durumda.";
  }

  // 5. Capture Impact
  const captureIssues = postureProfileState.postureProfile.captureState?.weakAngles || [];
  const historyIssues = postureProfileState.postureProfile.memoryMeta?.historyCount > 0 ? postureProfileState.postureProfile.captureState.weakAngles : [];
  
  if (captureIssues.length > 0) {
    explainability.captureImpact = {
      issue: captureIssues[0] + " açısı zayıf",
      humanReadable: "Bazı açılardan yeterli veri alınamadığı için o bölgelerin analizi sınırlı tutuldu."
    };
  } else if (layer1Result.measurements?.side?.unusableReason) {
     explainability.captureImpact = {
       issue: layer1Result.measurements.side.unusableReason,
       humanReadable: "Yan görünüşteki hatalar nedeniyle omuza ve başa dair güven azaldı."
     };
  }

  return explainability;
}
