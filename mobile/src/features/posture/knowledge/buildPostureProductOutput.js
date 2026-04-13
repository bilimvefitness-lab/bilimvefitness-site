/**
 * @file buildPostureProductOutput.js
 * @description Productization Layer - Transforms nested Posture Intelligence output into a clean, flat, premium, action-oriented UI object.
 */

const MEMORY_PREFIX = "[POSTURE_PRODUCT_OUTPUT]";

export function buildPostureProductOutput(knowledgeOutput, layer1Result) {
  console.log(`${MEMORY_PREFIX} Building Product UI Output...`);

  const isHeuristic =
    layer1Result?.uiMeta?.heuristicMode === true ||
    layer1Result?.analysisMode === "heuristic";

  const uiData = {
    heuristicMode: isHeuristic,
    hero: {
      title: "Ana odak: Duruş Farkındalığı",
      subtitle: "Bugün tek odak bu."
    },
    action: {
      primaryAction: "Şimdi. Temel duruşunu hizala.",
      secondaryAction: "Gün içinde postürünü kontrol et."
    },
    status: {
      score: null,
      scoreAvailable: false,
      confidenceLabel: "Düşük Güven"
    },
    explainability: {
      text: "Günlük değerlendirmen tamamlandı."
    },
    debug: {
      frontImageUri: null,
      sideImageUri: null
    },
    trend: {
      message: "Genel duruş profilin stabil durumda."
    },
    habit: {
      streakMessage: "Farkındalığı bugün başlat.",
      urgencyMessage: null
    }
  };

  if (!knowledgeOutput || !layer1Result) return uiData;

  // ─── HEURISTIC MODE: honest, limited output ───────────────────────
  if (isHeuristic) {
    uiData.hero.title = "Temel Görsel Kontrol";
    uiData.hero.subtitle = "Bu cihazda yalnızca temel görsel kontrol yapılabildi.";

    uiData.action.primaryAction = "Detaylı postür skoru için gelişmiş analiz gerekir.";
    uiData.action.secondaryAction = "Fotoğrafların alındı, temel değerlendirme yapıldı.";

    uiData.status.score = null;
    uiData.status.scoreAvailable = false;
    uiData.status.confidenceLabel = "Temel Mod";

    uiData.explainability.text = "Bu cihazda gelişmiş vücut taraması kullanılamıyor. Temel geometrik kontrol yapıldı.";

    uiData.trend.message = null;
    uiData.habit.streakMessage = "Düzenli çekim alışkanlığını sürdür.";
    uiData.habit.urgencyMessage = null;

    // Debug images still available
    if (layer1Result.diagnostics) {
      uiData.debug.frontImageUri = layer1Result.diagnostics.front?.debugImageUri || null;
      uiData.debug.sideImageUri = layer1Result.diagnostics.side?.debugImageUri || null;
    }

    return uiData;
  }

  // ─── SERVER MODE: real ML analysis from backend ───────────────────
  const isServerMode = layer1Result?.uiMeta?.serverMode === true || layer1Result?.provider === "ml_server";
  uiData.serverMode = isServerMode;

  if (isServerMode) {
    const serverIssues = layer1Result.serverResult?.issues ?? layer1Result.diagnostics?.issues ?? [];
    const serverScore = layer1Result.score ?? 0;
    const serverConf = layer1Result.confidence ?? "low";

    const confidenceLabels = {
      high: "Yüksek Güven",
      medium: "Orta Güven",
      low: "Düşük Güven",
      none: "Algılanamadı",
    };

    uiData.hero.title = serverScore >= 85
      ? "Duruşun harika görünüyor!"
      : serverScore >= 65
        ? "Bazı düzeltmeler önerilir"
        : serverScore >= 40
          ? "Dikkat gerektiren noktalar var"
          : "Ciddi düzeltmeler gerekiyor";
    uiData.hero.subtitle = layer1Result.message || "Gelişmiş analiz tamamlandı.";

    uiData.status.score = serverScore;
    uiData.status.scoreAvailable = true;
    uiData.status.confidenceLabel = confidenceLabels[serverConf] || "Düşük Güven";

    // Build action from top issues
    if (serverIssues.length > 0) {
      const topIssue = serverIssues.sort((a, b) => b.penalty - a.penalty)[0];
      uiData.action.primaryAction = `Öncelik: ${topIssue.label} düzeltmesi`;
      uiData.action.secondaryAction = serverIssues.length > 1
        ? `${serverIssues.length} sorun tespit edildi. Detayları incele.`
        : "Günlük duruş kontrolünü sürdür.";
    } else {
      uiData.action.primaryAction = "Mevcut duruşunu koru.";
      uiData.action.secondaryAction = "Düzenli kontrol ile farkındalığı artır.";
    }

    uiData.explainability.text = layer1Result.message || "Gelişmiş analiz tamamlandı.";
    uiData.trend.message = "Genel duruş profilin stabil durumda.";
    uiData.habit.streakMessage = "Düzenli analiz alışkanlığını sürdür.";

    return uiData;
  }

  // ─── ML MODE: full client-side analysis output ───────────────────

  // 1. HERO BLOCK
  const dailyFocus = knowledgeOutput.coach?.dailyFocus;
  if (dailyFocus) {
    uiData.hero.title = `Ana odak: ${dailyFocus}`;
  }

  // 2. ACTION BLOCK
  if (knowledgeOutput.coach) {
    uiData.action.primaryAction = knowledgeOutput.coach.primaryAction || uiData.action.primaryAction;
    uiData.action.secondaryAction = knowledgeOutput.coach.secondaryAction || uiData.action.secondaryAction;
  }

  // 3. STATUS BLOCK
  const rawScore = knowledgeOutput.postureContext?.current?.score ?? layer1Result.score ?? null;
  const conf = layer1Result.confidence || "low";

  const confidenceLabels = {
    high: "Yüksek Güven",
    medium: "Orta Güven",
    low: "Düşük Güven"
  };

  uiData.status.score = rawScore;
  uiData.status.scoreAvailable = rawScore !== null && rawScore !== undefined;
  uiData.status.confidenceLabel = confidenceLabels[conf] || "Düşük Güven";

  // 4. EXPLAINABILITY BLOCK
  const expReason = knowledgeOutput.explainability?.focusExplanation?.primary?.humanReadable;
  if (expReason) {
    uiData.explainability.text = expReason;
  }

  // 5. TREND BLOCK
  const trendExp = knowledgeOutput.explainability?.trendExplanation;
  const trendDir = knowledgeOutput.trend?.direction;
  if (trendDir === "improving") {
    uiData.trend.message = "Harika, duruş eğiliminde hafif iyileşme var.";
  } else if (trendExp) {
    uiData.trend.message = trendExp;
  }

  // 6. HABIT BLOCK
  if (knowledgeOutput.habit?.streak) {
    uiData.habit.streakMessage = knowledgeOutput.habit.streak.message;
    uiData.habit.urgencyMessage = knowledgeOutput.habit.streak.urgency;
  }

  // 7. DEBUG BLOCK
  if (layer1Result.diagnostics) {
    uiData.debug.frontImageUri = layer1Result.diagnostics.front?.debugImageUri || null;
    uiData.debug.sideImageUri = layer1Result.diagnostics.side?.debugImageUri || null;
  }

  return uiData;
}
