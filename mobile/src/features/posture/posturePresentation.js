import { comparePostureResults } from "./postureHistoryUtils";
import { buildPostureRecommendationCards } from "./postureExerciseRecommendations";
import { buildPostureIdentitySnapshot } from "./postureIdentity";
import { resolveDailyCoachingTask, buildCoachDirective, calculateIssueProgress } from "./postureCoachingEngine";

function formatKyphosisFinding(t, value) {
  return t(`posture.result.findingLabels.kyphosis.${value || "unknown"}`);
}

function formatForwardHeadFinding(t, value) {
  const key = value === null ? "unknown" : String(Boolean(value));
  return t(`posture.result.findingLabels.forwardHead.${key}`);
}

function formatShoulderAsymmetryFinding(t, value) {
  return t(`posture.result.findingLabels.shoulderAsymmetry.${value || "unknown"}`);
}

function formatLordosisFinding(t, value) {
  return t(`posture.result.findingLabels.lordosis.${value || "unknown"}`);
}

function formatSpineAlignmentFinding(t, value) {
  return t(`posture.result.findingLabels.spineAlignment.${value || "unknown"}`);
}

function uniqueItems(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function formatViewSignalLabel(t, signalId, fallbackKey) {
  return t(`posture.result.viewSignalLabels.${signalId || fallbackKey}`);
}

function buildViewSignalLabels(t, viewKey, state) {
  const signalLabels = uniqueItems(
    (state?.signals ?? [])
      .filter((signal) => signal.present)
      .sort((left, right) => {
        const rank = { high: 0, medium: 1, low: 2, none: 3, missing: 4 };
        return (rank[left.severity] ?? 4) - (rank[right.severity] ?? 4);
      })
      .slice(0, 2)
      .map((signal) => (
        signal.severity === "none"
          ? formatViewSignalLabel(t, null, `${viewKey}_fallback`)
          : formatViewSignalLabel(t, signal.id, `${viewKey}_fallback`)
      )),
  );

  if (signalLabels.length) {
    return signalLabels;
  }

  if ((state?.landmarkCount ?? 0) > 0) {
    return [formatViewSignalLabel(t, null, `${viewKey}_fallback`)];
  }

  return [];
}

function buildExplanationItems(t, analysisResult) {
  const findings = analysisResult?.findings ?? {};
  const summary = Array.isArray(analysisResult?.summary) ? analysisResult.summary : [];
  const measurements = analysisResult?.measurements;
  const items = [];
  const severeVisibilityState = (
    summary.includes("no_person_detected") ||
    summary.includes("wrong_angle") ||
    summary.includes("insufficient_visibility") ||
    summary.includes("platform_limited")
  );

  if (
    !severeVisibilityState &&
    (
      findings.shoulderAsymmetry === "left_low" ||
      findings.shoulderAsymmetry === "right_low" ||
      findings.shoulderAsymmetry === "none"
    )
  ) {
    items.push({
      key: `shoulders-${findings.shoulderAsymmetry}`,
      title: t("posture.result.explanationLabels.shoulders"),
      description: t(
        `posture.result.explanationItems.shoulderAsymmetry.${findings.shoulderAsymmetry}`,
      ),
      view: "front",
      badges: [t("posture.result.preview.badges.shoulders")],
      priority: findings.shoulderAsymmetry === "none" ? 3 : 1,
    });
  }

  if (!severeVisibilityState && (findings.forwardHead === true || findings.forwardHead === false)) {
    const valueKey = String(Boolean(findings.forwardHead));

    items.push({
      key: `neck-${valueKey}`,
      title: t("posture.result.explanationLabels.neck"),
      description: t(`posture.result.explanationItems.forwardHead.${valueKey}`),
      view: "side",
      badges: [t("posture.result.preview.badges.neck")],
      priority: findings.forwardHead === false ? 3 : 1,
    });
  }

  if (
    !severeVisibilityState &&
    (
      findings.kyphosis === "low" ||
      findings.kyphosis === "medium" ||
      findings.kyphosis === "high"
    )
  ) {
    items.push({
      key: `upper-back-${findings.kyphosis}`,
      title: t("posture.result.explanationLabels.upperBack"),
      description: t(`posture.result.explanationItems.kyphosis.${findings.kyphosis}`),
      view: "side",
      badges: [t("posture.result.preview.badges.upperBack")],
      priority: findings.kyphosis === "low" ? 3 : 1,
    });
  }

  if (summary.includes("balanced_alignment")) {
    items.push({
      key: "overall-balanced",
      title: t("posture.result.explanationLabels.overall"),
      description: t("posture.result.explanationItems.overall.balanced_alignment"),
      view: null,
      badges: [t("posture.result.preview.badges.overall")],
      priority: 4,
    });
  }

  if (
    summary.includes("no_person_detected") ||
    summary.includes("wrong_angle") ||
    summary.includes("partial_visibility") ||
    summary.includes("insufficient_visibility") ||
    summary.includes("platform_limited")
  ) {
    const visibilityKey = summary.includes("no_person_detected")
      ? "no_person_detected"
      : summary.includes("wrong_angle")
        ? "wrong_angle"
        : summary.includes("platform_limited")
      ? "platform_limited"
      : summary.includes("insufficient_visibility")
        ? "insufficient_visibility"
        : "partial_visibility";

    items.push({
      key: `visibility-${visibilityKey}`,
      title: t("posture.result.explanationLabels.visibility"),
      description: t(`posture.result.explanationItems.visibility.${visibilityKey}`),
      view: null,
      badges: [],
      priority: 2,
    });
  }

  if (
    !severeVisibilityState &&
    (
      findings.spineAlignment === "slight_deviation" ||
      findings.spineAlignment === "marked_deviation" ||
      findings.spineAlignment === "straight"
    )
  ) {
    items.push({
      key: `spine-${findings.spineAlignment}`,
      title: t("posture.result.explanationLabels.spine"),
      description: t(`posture.result.explanationItems.spineAlignment.${findings.spineAlignment}`),
      view: "back",
      badges: [t("posture.result.preview.badges.overall")],
      priority: findings.spineAlignment === "straight" ? 3 : 1,
    });
  }

  [
    {
      key: "front",
      title: t("posture.result.preview.frontTitle"),
      state: measurements?.front,
    },
    {
      key: "side",
      title: t("posture.result.preview.sideTitle"),
      state: measurements?.side,
    },
    {
      key: "back",
      title: t("posture.result.preview.backTitle"),
      state: measurements?.back,
    },
  ].forEach(({ key, title, state }) => {
    if (severeVisibilityState || items.some((item) => item.view === key) || !state) {
      return;
    }

    const labels = buildViewSignalLabels(t, key, state);
    if (!labels.length) {
      return;
    }

    items.push({
      key: `${key}-fallback`,
      title,
      description: labels[0],
      view: key,
      badges: labels.slice(0, 2),
      priority: 2,
    });
  });

  return items
    .sort((left, right) => left.priority - right.priority)
    .slice(0, 3)
    .map(({ priority, ...item }) => item);
}

function buildPreviewCards(t, captures, explanationItems, measurements) {
  const showMinimalBadges = (
    measurements?.completeness?.wrongAngleDetected ||
    measurements?.completeness?.noPersonDetected ||
    measurements?.completeness?.extractionFailed
  );
  const frontBadges = buildViewSignalLabels(t, "front", measurements?.front);
  const sideBadges = buildViewSignalLabels(t, "side", measurements?.side);
  const backBadges = buildViewSignalLabels(t, "back", measurements?.back);

  const cards = [];

  if (captures?.front?.uri && measurements?.front?.usable) {
    cards.push({
      key: "front",
      title: t("posture.result.preview.frontTitle"),
      uri: captures.front.uri,
      badges: showMinimalBadges
        ? [t("posture.result.preview.badges.overall")]
        : frontBadges.length
          ? frontBadges
          : [formatViewSignalLabel(t, null, "front_fallback")],
    });
  } else if (captures?.front?.uri) {
    cards.push({
      key: "front",
      title: t("posture.result.preview.frontTitle"),
      uri: captures.front.uri,
      badges: showMinimalBadges
        ? [t("posture.result.preview.badges.overall")]
        : frontBadges.length
          ? frontBadges
          : [formatViewSignalLabel(t, null, "front_fallback")],
    });
  }

  if (captures?.side?.uri && measurements?.side?.usable) {
    cards.push({
      key: "side",
      title: t("posture.result.preview.sideTitle"),
      uri: captures.side.uri,
      badges: showMinimalBadges
        ? [t("posture.result.preview.badges.overall")]
        : sideBadges.length
          ? sideBadges
          : [formatViewSignalLabel(t, null, "side_fallback")],
    });
  } else if (captures?.side?.uri) {
    cards.push({
      key: "side",
      title: t("posture.result.preview.sideTitle"),
      uri: captures.side.uri,
      badges: showMinimalBadges
        ? [t("posture.result.preview.badges.overall")]
        : sideBadges.length
          ? sideBadges
          : [formatViewSignalLabel(t, null, "side_fallback")],
    });
  }

  if (captures?.back?.uri && measurements?.back?.usable) {
    cards.push({
      key: "back",
      title: t("posture.result.preview.backTitle"),
      uri: captures.back.uri,
      badges: showMinimalBadges
        ? [t("posture.result.preview.badges.overall")]
        : backBadges.length
          ? backBadges
          : [formatViewSignalLabel(t, null, "back_fallback")],
    });
  } else if (captures?.back?.uri) {
    cards.push({
      key: "back",
      title: t("posture.result.preview.backTitle"),
      uri: captures.back.uri,
      badges: backBadges.length
        ? backBadges
        : [formatViewSignalLabel(t, null, "back_fallback")],
    });
  }

  return cards;
}

function buildLowConfidenceNote(t, analysisResult) {
  if (analysisResult?.confidence !== "low") {
    return null;
  }

  if (Array.isArray(analysisResult?.summary) && analysisResult.summary.includes("platform_limited")) {
    return null;
  }

  return {
    title: t("posture.result.lowConfidence.title"),
    body: t("posture.result.lowConfidence.body"),
    hint: t("posture.result.lowConfidence.hint"),
  };
}

function buildProgressView(t, progressContext) {
  const currentEntry = progressContext?.currentEntry ?? null;
  const previousEntry = progressContext?.previousEntry ?? null;

  if (!currentEntry || !Number.isFinite(Number(currentEntry.score))) {
    return null;
  }

  const consistency = currentEntry?.consistency;
  const consistencyLevel = consistency?.consistencyLevel ?? (consistency?.isConsistent === false ? "low" : "high");
  const isConsistencyLow = consistencyLevel === "low";

  const comparison = comparePostureResults(currentEntry, previousEntry, t);
  const scoreDiff = Number(comparison.scoreDiff ?? 0);
  const diffPrefix = scoreDiff > 0 ? "+" : "";

  // Suppress delta when consistency is low — angles/distance changed too much
  const diffText = isConsistencyLow
    ? t("posture.result.accuracy.consistency.hints.low")
    : previousEntry
      ? `${diffPrefix}${scoreDiff} ${t("posture.progress.diffSuffix")}`
      : t("posture.progress.firstEntryDiff");

  return {
    title: t("posture.progress.title"),
    previousScoreLabel: t("posture.progress.previousScoreLabel"),
    currentScoreLabel: t("posture.progress.currentScoreLabel"),
    previousScoreText: previousEntry ? `${previousEntry.score}` : null,
    currentScoreText: `${currentEntry.score}`,
    trend: isConsistencyLow ? "same" : comparison.trend,
    trendLabel: t(`posture.progress.trendLabel.${isConsistencyLow ? "same" : comparison.trend}`),
    diffText,
    summaryText: isConsistencyLow
      ? t("posture.result.accuracy.consistency.hints.low")
      : comparison.summaryText,
    historyButtonLabel: t("posture.history.link"),
    isConsistencyLow,
    consistencyLevel,
  };
}

function buildFindingLabel(t, analysisResult, summaryCode) {
  if (
    summaryCode === "no_person_detected" ||
    summaryCode === "wrong_angle" ||
    summaryCode === "insufficient_visibility" ||
    summaryCode === "partial_visibility" ||
    summaryCode === "platform_limited" ||
    summaryCode === "balanced_alignment" ||
    summaryCode === "minor_alignment_shift"
  ) {
    return t(`posture.result.summaryLabels.${summaryCode}`);
  }

  if (summaryCode === "kyphosis") {
    return formatKyphosisFinding(t, analysisResult?.findings?.kyphosis);
  }
  if (summaryCode === "forwardHead") {
    return formatForwardHeadFinding(t, analysisResult?.findings?.forwardHead);
  }
  if (summaryCode === "shoulderAsymmetry") {
    return formatShoulderAsymmetryFinding(t, analysisResult?.findings?.shoulderAsymmetry);
  }
  if (summaryCode === "spineAlignment") {
    return formatSpineAlignmentFinding(t, analysisResult?.findings?.spineAlignment);
  }
  if (summaryCode === "lordosis") {
    return formatLordosisFinding(t, analysisResult?.findings?.lordosis);
  }
  return null;
}

function buildSummaryList(t, analysisResult) {
  const summaryItems = Array.isArray(analysisResult?.summary) ? analysisResult.summary : [];
  const mapped = summaryItems
    .map((summaryCode) => buildFindingLabel(t, analysisResult, summaryCode))
    .filter(Boolean);

  if (mapped.length) {
    return mapped;
  }

  return [
    formatKyphosisFinding(t, analysisResult?.findings?.kyphosis),
    formatForwardHeadFinding(t, analysisResult?.findings?.forwardHead),
    formatShoulderAsymmetryFinding(t, analysisResult?.findings?.shoulderAsymmetry),
    formatSpineAlignmentFinding(t, analysisResult?.findings?.spineAlignment),
    ...uniqueItems([
      ...buildViewSignalLabels(t, "front", analysisResult?.measurements?.front),
      ...buildViewSignalLabels(t, "side", analysisResult?.measurements?.side),
      ...buildViewSignalLabels(t, "back", analysisResult?.measurements?.back),
    ]),
  ].filter(Boolean).slice(0, 4);
}

export function buildPostureIdentityViewModel(t, latestResult, previousResult = null) {
  const identity = buildPostureIdentitySnapshot(latestResult, previousResult);

  if (!identity) {
    return null;
  }

  const { level, progression } = identity;

  // Gate delta on consistency: if angle/scale drifted too much, suppress score delta
  const consistency = latestResult?.consistency;
  const consistencyLevel = consistency?.consistencyLevel ?? (consistency?.isConsistent === false ? "low" : "high");
  const isDeltaReliable = consistencyLevel !== "low";
  const showDelta = progression.hasComparison && isDeltaReliable;

  return {
    score: identity.score,
    levelNumber: level.number,
    levelLabel: t(level.labelKey),
    badgeLabel: t("posture.identity.badge"),
    scoreLabel: t("posture.identity.scoreLabel"),
    levelLabelCaption: t("posture.identity.levelLabel"),
    microMessage: t(`posture.identity.messages.${identity.microMessageKey}`),
    trend: showDelta ? progression.trend : "same",
    hasComparison: showDelta,
    deltaText: showDelta
      ? t(`posture.identity.delta.${progression.trend}`, { diff: progression.absScoreDiff })
      : null,
    checkpointTitle: t("posture.result.checkpoint.title"),
    checkpointHeadline: showDelta
      ? t(`posture.identity.delta.${progression.trend}`, { diff: progression.absScoreDiff })
      : t("posture.result.checkpoint.firstScan"),
    checkpointMessage: t(
      `posture.result.checkpoint.messages.${identity.checkpointMessageKey}`,
    ),
  };
}

function resolveConsistencyLevel(consistency) {
  return consistency?.consistencyLevel ?? (consistency?.isConsistent === false ? "low" : "high");
}

function buildAccuracyView(t, analysisResult, progressContext) {
  const qualityLevel = analysisResult?.qualityLevel || "low";
  const qualityScore = analysisResult?.qualityScore ?? 0;
  const consistency = progressContext?.currentEntry?.consistency ?? analysisResult?.consistency;
  const consistencyLevel = resolveConsistencyLevel(consistency);
  const isConsistencyLow = consistencyLevel === "low";
  const hasPrevious = progressContext?.previousEntry != null;

  return {
    label: t("posture.result.accuracy.label"),
    levelLabel: t(`posture.result.confidence.${qualityLevel}`),
    qualityLevel,
    qualityScore,
    showHint: qualityLevel !== "high",
    hint: t("posture.result.accuracy.hint"),
    consistencyLabel: hasPrevious ? t("posture.result.accuracy.consistency.label") : null,
    consistencyLevel,
    consistencyLevelLabel: hasPrevious ? t(`posture.result.accuracy.consistency.levels.${consistencyLevel}`) : null,
    consistencyHint: consistencyLevel !== "high"
      ? t(`posture.result.accuracy.consistency.hints.${consistencyLevel}`)
      : null,
    isConsistencyLow,
  };
}

function buildTrustScorecard(t, analysisResult, progressContext) {
  const qualityLevel = analysisResult?.qualityLevel || "low";
  const consistency = progressContext?.currentEntry?.consistency ?? analysisResult?.consistency;
  const consistencyLevel = resolveConsistencyLevel(consistency);
  const hasPrevious = progressContext?.previousEntry != null;
  const confidence = analysisResult?.confidence || "low";

  const signals = [
    { key: "quality", label: t("posture.trust.signals.quality"), level: qualityLevel },
    { key: "confidence", label: t("posture.trust.signals.confidence"), level: confidence },
  ];

  if (hasPrevious) {
    signals.push({
      key: "consistency",
      label: t("posture.trust.signals.consistency"),
      level: consistencyLevel,
    });
  }

  return {
    title: t("posture.trust.title"),
    signals,
    overallLevel: [qualityLevel, confidence, hasPrevious ? consistencyLevel : "high"]
      .includes("low") ? "low"
      : [qualityLevel, confidence, hasPrevious ? consistencyLevel : "high"]
        .includes("medium") ? "medium"
        : "high",
  };
}

function buildRepeatabilityGuidance(t, analysisResult, progressContext) {
  const qualityLevel = analysisResult?.qualityLevel || "low";
  const consistency = progressContext?.currentEntry?.consistency ?? analysisResult?.consistency;
  const consistencyLevel = resolveConsistencyLevel(consistency);
  const hasPrevious = progressContext?.previousEntry != null;

  if (qualityLevel === "high" && (!hasPrevious || consistencyLevel === "high")) {
    return null;
  }

  const tips = [];

  if (qualityLevel !== "high") {
    tips.push(t("posture.trust.repeatability.lighting"));
    tips.push(t("posture.trust.repeatability.fullBody"));
  }

  if (hasPrevious && consistencyLevel !== "high") {
    tips.push(t("posture.trust.repeatability.sameSpot"));
    tips.push(t("posture.trust.repeatability.sameDistance"));
  }

  return tips.length
    ? { title: t("posture.trust.repeatability.title"), tips: tips.slice(0, 3) }
    : null;
}

function buildCoachingView(t, analysisResult, progressContext, identityViewModel) {
  if (!analysisResult || analysisResult.confidence === "low") {
    return null;
  }

  const identity = identityViewModel ? { level: { number: identityViewModel.levelNumber } } : null;
  const taskHistory = progressContext?.taskHistory || [];
  const analysisHistory = progressContext?.analysisHistory || []; // Need analysis history for trend
  const task = resolveDailyCoachingTask(analysisResult, taskHistory, identity);
  const directive = buildCoachDirective(task, t);

  if (!directive) return null;

  const issueProgress = calculateIssueProgress(task.issueId, taskHistory, analysisHistory);

  return {
    title: t("posture.coaching.sectionTitle"),
    directive,
    issueProgress,
    issueStatusLabel: t("posture.coaching.status.improving"), // Simplification for V2
    streakText: progressContext?.streakCount > 0 
      ? t("posture.coaching.streaks.count", { count: progressContext.streakCount })
      : null,
  };
}

export function buildPostureResultViewModel(t, analysisResult, captures, progressContext = null) {
  const hasScore = Number.isFinite(Number(analysisResult?.score));
  const safeScore = hasScore ? Number(analysisResult.score) : null;
  const explanationItems = buildExplanationItems(t, analysisResult);
  const measurements = analysisResult?.measurements;
  const identity = buildPostureIdentityViewModel(
    t,
    progressContext?.currentEntry ?? analysisResult,
    progressContext?.previousEntry ?? null,
  );
  const recommendationCards = buildPostureRecommendationCards(t, analysisResult, { limit: 2 });
  const fallbackRecommendation = t(
    `posture.result.recommendations.${analysisResult?.recommendation || "retake_guidance"}`,
  );

  const isHeuristic = analysisResult?.analysisMode === "heuristic";

  return {
    score: isHeuristic ? null : safeScore,
    hasScore: isHeuristic ? false : hasScore,
    scoreText: isHeuristic ? t("posture.result.scoreUnavailable") : (hasScore ? `${safeScore} / 100` : t("posture.result.scoreUnavailable")),
    analysisMode: analysisResult?.analysisMode || "ml",
    analysisModeLabel: t(`posture.analysisMode.${analysisResult?.analysisMode || "ml"}`),
    findings: isHeuristic ? [t("posture.result.summaryLabels.platform_limited")] : buildSummaryList(t, analysisResult),
    recommendation: isHeuristic ? t("posture.result.recommendations.capture_retry") : (recommendationCards[0]?.purpose || fallbackRecommendation),
    recommendationsTitle: t("posture.recommendations.sectionTitle"),
    recommendationsButtonLabel: t("posture.recommendations.viewAll"),
    recommendationCards: isHeuristic ? [] : recommendationCards,
    confidenceLabel: t(
      `posture.result.confidence.${analysisResult?.confidence || "low"}`,
    ),
    identity: isHeuristic ? null : identity,
    checkpoint: isHeuristic ? null : (identity
      ? {
          title: identity.checkpointTitle,
          headline: identity.checkpointHeadline,
          message: identity.checkpointMessage,
          levelLabelCaption: identity.levelLabelCaption,
          levelLabel: identity.levelLabel,
          levelNumber: identity.levelNumber,
          trend: identity.trend,
        }
      : null),
    explanationTitle: t("posture.result.explanationTitle"),
    explanationItems: isHeuristic ? [] : explanationItems,
    previewCards: buildPreviewCards(t, captures, explanationItems, measurements),
    usedAngles: [
      measurements?.front?.usable && t("posture.angles.front"),
      measurements?.side?.usable && t("posture.angles.side"),
      measurements?.back?.usable && t("posture.angles.back"),
    ].filter(Boolean),
    usedAnglesLabel: t("posture.result.usedAngles"),
    lowConfidenceNote: isHeuristic ? null : buildLowConfidenceNote(t, analysisResult),
    progress: isHeuristic ? null : buildProgressView(t, progressContext),
    accuracyView: buildAccuracyView(t, analysisResult, progressContext),
    trustScorecard: buildTrustScorecard(t, analysisResult, progressContext),
    repeatabilityGuidance: buildRepeatabilityGuidance(t, analysisResult, progressContext),
    coaching: isHeuristic ? null : buildCoachingView(t, analysisResult, progressContext, identity),
  };
}
