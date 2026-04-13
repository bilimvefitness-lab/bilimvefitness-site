const POSTURE_LEVELS = [
  { minScore: 90, number: 5, id: "balanced" },
  { minScore: 75, number: 4, id: "good" },
  { minScore: 60, number: 3, id: "growing" },
  { minScore: 45, number: 2, id: "starting" },
  { minScore: 0, number: 1, id: "awareness" },
];

function toNumericScore(result) {
  const score = Number(result?.score);
  return Number.isFinite(score) ? score : null;
}

function hasIssueFinding(value) {
  return value != null && value !== "none" && value !== "unknown" && value !== false;
}

function resolveTrend(scoreDiff) {
  if (scoreDiff >= 2) return "up";
  if (scoreDiff <= -2) return "down";
  return "same";
}

function resolveMicroMessageKey(level, progression, qualityLevel) {
  if (progression.hasComparison) {
    if (progression.trend === "up") {
      // High quality + big diff → strong message; otherwise tempered
      if (qualityLevel === "high" && progression.absScoreDiff >= 5) {
        return "alignment_growing_strong";
      }
      return "alignment_improving";
    }

    if (progression.trend === "down") {
      return "small_shift";
    }
  }

  if (level.number >= 5) {
    return "alignment_balanced";
  }

  if (level.number >= 4) {
    return "alignment_stable";
  }

  if (level.number >= 3) {
    return "alignment_building";
  }

  return "awareness_building";
}

function resolveCheckpointMessageKey(current, previous, progression, qualityLevel) {
  if (!progression.hasComparison || !previous) {
    return "first_scan_saved";
  }

  const currentFindings = current?.findings ?? {};
  const previousFindings = previous?.findings ?? {};
  const previousKyphosisTendency =
    previousFindings.kyphosis === "medium" || previousFindings.kyphosis === "high";
  const currentKyphosisTendency =
    currentFindings.kyphosis === "medium" || currentFindings.kyphosis === "high";

  // Only claim specific finding improvements when quality is at least medium
  if (qualityLevel !== "low") {
    if (previousFindings.forwardHead === true && currentFindings.forwardHead !== true) {
      return "head_alignment_better";
    }

    if (
      hasIssueFinding(previousFindings.shoulderAsymmetry) &&
      currentFindings.shoulderAsymmetry === "none"
    ) {
      return "shoulder_balance_better";
    }

    if (previousKyphosisTendency && !currentKyphosisTendency) {
      return "upper_back_balance_better";
    }
  }

  if (progression.trend === "up") {
    // Temper strong growth claims when quality is low
    if (qualityLevel === "high" && progression.absScoreDiff >= 6) {
      return "growth_momentum";
    }
    return "alignment_improving";
  }

  if (progression.trend === "same") {
    if (currentFindings.shoulderAsymmetry === "none" && currentFindings.forwardHead === false) {
      return "balanced_stasis";
    }

    return "alignment_stable";
  }

  return "small_shift";
}

export function derivePostureLevel(score) {
  const numericScore = Number(score);
  if (!Number.isFinite(numericScore)) {
    return null;
  }

  const match = POSTURE_LEVELS.find((level) => numericScore >= level.minScore)
    ?? POSTURE_LEVELS[POSTURE_LEVELS.length - 1];

  return {
    ...match,
    labelKey: `posture.identity.levels.${match.id}`,
  };
}

export function comparePostureProgress(current, previous) {
  const currentScore = toNumericScore(current);
  const previousScore = toNumericScore(previous);

  if (currentScore === null || previousScore === null) {
    return {
      hasComparison: false,
      scoreDiff: 0,
      absScoreDiff: 0,
      trend: "same",
    };
  }

  const scoreDiff = Math.round(currentScore - previousScore);

  return {
    hasComparison: true,
    scoreDiff,
    absScoreDiff: Math.abs(scoreDiff),
    trend: resolveTrend(scoreDiff),
  };
}

export function buildPostureIdentitySnapshot(current, previous = null, history = []) {
  const currentScore = toNumericScore(current);

  if (currentScore === null) {
    return null;
  }

  const rawLevel = derivePostureLevel(currentScore);
  const progression = comparePostureProgress(current, previous);
  
  let finalLevel = rawLevel;
  const previousScore = toNumericScore(previous);
  const beforePrevious = history[1] ?? null;
  const beforePreviousScore = toNumericScore(beforePrevious);

  // Hardening: Level-Up Damping — require 2 consecutive improvements
  if (previous && rawLevel.number > (previous.level?.number ?? 0)) {
    const isConsecutiveImprovement =
      progression.trend === "up" &&
      beforePreviousScore !== null &&
      previousScore > beforePreviousScore;

    if (!isConsecutiveImprovement) {
      finalLevel = previous.level ?? rawLevel;
    }
  }

  // Hardening: Level-Down Protection — require consistent decline before dropping a level
  if (previous && rawLevel.number < (previous.level?.number ?? rawLevel.number)) {
    const isConsistentDecline =
      progression.trend === "down" &&
      beforePreviousScore !== null &&
      previousScore < beforePreviousScore;

    if (!isConsistentDecline) {
      // Single-scan drop: stay at previous level until confirmed decline
      finalLevel = previous.level ?? rawLevel;
    }
  }

  const qualityLevel = current?.qualityLevel || "low";

  return {
    score: currentScore,
    level: finalLevel,
    rawLevel,
    progression,
    latestResult: current,
    previousResult: previous,
    microMessageKey: resolveMicroMessageKey(finalLevel, progression, qualityLevel),
    checkpointMessageKey: resolveCheckpointMessageKey(current, previous, progression, qualityLevel),
  };
}

export function resolvePostureCommandPriority(basePriority, identity) {
  if (!identity) {
    return basePriority;
  }

  if (identity.progression.hasComparison && identity.progression.trend === "up") {
    return basePriority === "medium" ? "mild" : basePriority;
  }

  if (identity.progression.hasComparison && identity.progression.trend === "down") {
    return "medium";
  }

  if (identity.level.number >= 4 && basePriority === "medium") {
    return "mild";
  }

  return basePriority;
}

export function resolvePostureSupportKey(identity) {
  if (!identity?.progression?.hasComparison) {
    return "fresh";
  }

  if (identity.progression.trend === "up") {
    return "improving";
  }

  if (identity.progression.trend === "down") {
    return "watch";
  }

  return "steady";
}

export function getPostureTaskCadence(identity) {
  let maxTasksPerWeek = 3;

  if (identity?.level?.number >= 4) {
    maxTasksPerWeek = 1;
  } else if (identity?.level?.number === 3) {
    maxTasksPerWeek = 2;
  }

  if (identity?.progression?.hasComparison && identity.progression.trend === "down") {
    maxTasksPerWeek = Math.min(maxTasksPerWeek + 1, 3);
  }

  return {
    maxTasksPerWeek,
    suppressConsecutiveDays: true,
  };
}
