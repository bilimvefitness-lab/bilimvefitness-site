import { 
  selectTaskByIssueAndTier, 
  getIssueFromFindings, 
  TASK_TIERS,
  FEEDBACK_POOLS,
  ANTICIPATION_HINTS,
} from "./postureCoachingModel";

function getRandomFeedback(tier, t) {
  const pool = FEEDBACK_POOLS[tier] || [];
  if (pool.length === 0) return t("posture.coaching.feedback.generic");
  const key = pool[Math.floor(Math.random() * pool.length)];
  return t(key);
}

function getAnticipationHint(tier, t) {
  const key = ANTICIPATION_HINTS[tier];
  return key ? t(key) : null;
}

/**
 * Calculates a 0-100 progress value for a specific issue.
 * Based on:
 * 1. Consistency (completion frequency in last 7 days)
 * 2. Trend (positive score changes in analysis history)
 */
export function calculateIssueProgress(issueId, taskHistory, analysisHistory) {
  if (!issueId || issueId === "maintenance") return 0;

  // 1. Consistency Component (40% weight)
  const last7Days = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const recentTasks = taskHistory.filter(h => 
    h.issueId === issueId && 
    h.completedAt && 
    (now - h.completedAt) < last7Days
  );
  
  // 3+ completions in a week is considered high consistency for a micro-task loop
  const consistencyScore = Math.min(100, (recentTasks.length / 3) * 100);

  // 2. Trend Component (60% weight)
  // Look at the delta between latest and previous relevant scans
  let trendScore = 0;
  if (analysisHistory.length >= 2) {
    const latest = analysisHistory[0];
    const previous = analysisHistory[1];
    const delta = (latest.score || 0) - (previous.score || 0);
    
    // Positive delta adds to trend score, negative or zero keeps it stable
    // We cap this to avoid huge jumps
    trendScore = Math.max(0, Math.min(100, delta * 5)); 
  }

  // Base progress from history length for that specific issue
  const experienceScore = Math.min(100, (taskHistory.filter(h => h.issueId === issueId && h.completedAt).length * 10));

  const totalProgress = (consistencyScore * 0.4) + (trendScore * 0.3) + (experienceScore * 0.3);
  
  return Math.round(Math.min(100, totalProgress));
}

/**
 * Derives the active coaching streak and tier for a given issue.
 */
export function deriveCoachingState(history, issueId) {
  const issueHistory = history.filter(h => h.issueId === issueId && h.completedAt);
  
  if (issueHistory.length === 0) {
    return { tier: TASK_TIERS.AWARENESS, streak: 0 };
  }

  // Calculate Streak (Consecutive days for this issue)
  // Actually, simplified for V1: use consecutive completions in history.
  let streak = 0;
  let currentTier = TASK_TIERS.AWARENESS;

  // Last completion
  const last = issueHistory[0];
  streak = last.streakCount || 0;
  currentTier = last.tier || TASK_TIERS.AWARENESS;

  // Progression Logic: 
  // Streak 2 on Awareness -> Unlock Activation
  // Streak 3 on Activation -> Unlock Correction
  // Streak 5 on Correction -> Unlock Habit
  
  let nextTier = currentTier;
  if (currentTier === TASK_TIERS.AWARENESS && streak >= 2) nextTier = TASK_TIERS.ACTIVATION;
  else if (currentTier === TASK_TIERS.ACTIVATION && streak >= 3) nextTier = TASK_TIERS.CORRECTION;
  else if (currentTier === TASK_TIERS.CORRECTION && streak >= 5) nextTier = TASK_TIERS.HABIT;

  return { tier: nextTier, streak };
}

/**
 * Selects the daily coaching task based on analysis, identity, and history.
 */
export function resolveDailyCoachingTask(latestResult, history, identity) {
  if (!latestResult || (latestResult.confidence === "low")) {
    // Fallback to basic Awareness Maintenance if low confidence
    return selectTaskByIssueAndTier("maintenance", TASK_TIERS.AWARENESS);
  }

  const issueId = getIssueFromFindings(latestResult.findings);
  const { tier, streak } = deriveCoachingState(history, issueId);

  // Rotation weighting based on identity level
  // Level 1-2: Favor Awareness/Activation
  // Level 3+: Favor Correction/Habit
  let finalTier = tier;
  const identityLevel = identity?.level?.number || 1;
  
  if (identityLevel >= 4 && tier < TASK_TIERS.HABIT) {
    // Speed up progression for advanced users
    finalTier = Math.min(tier + 1, TASK_TIERS.CORRECTION);
  }

  return selectTaskByIssueAndTier(issueId, finalTier);
}

export function buildCoachDirective(task, t) {
  if (!task) return null;
  
  return {
    command: t(task.directiveKey),
    feedback: getRandomFeedback(task.tier, t),
    hint: getAnticipationHint(task.tier, t),
    taskId: task.id,
    issueId: task.issueId,
    tier: task.tier,
  };
}
