import { classifyStepActivity } from "./insights";
import { STEP_COACH_DEFAULT_GOAL, STEP_MILESTONE_RULES } from "./config";
import { buildSessionMiniGoals } from "./walkSession";

function safeNumber(value) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function roundToHundreds(value) {
  return Math.round(safeNumber(value) / 100) * 100;
}

function averageStepCounts(items = []) {
  const available = (items || []).filter((item) => item?.available);
  if (!available.length) {
    return 0;
  }
  return available.reduce((total, item) => total + safeNumber(item?.stepCount), 0) / available.length;
}

function buildScreenState(stepState, permissionStatus, manualMode) {
  if (stepState?.tone === "loading") {
    return "loading";
  }
  if (manualMode) {
    return "manual_mode";
  }
  if (permissionStatus === "granted") {
    return "active_tracking";
  }
  if (permissionStatus === "denied") {
    return "permission_denied";
  }
  if (permissionStatus === "unavailable") {
    return "unavailable";
  }
  return "permission_pending";
}

// Returns { code, meta } — no language strings.
function buildPrimeMessage({ steps, goalSteps, remainingSteps, hoursLeft, now }) {
  if (remainingSteps <= 0) {
    return { code: "prime_goal_done", meta: {} };
  }
  if (steps <= 0) {
    return { code: "prime_no_steps", meta: {} };
  }
  if (steps < 3000) {
    return { code: "prime_slow", meta: {} };
  }
  if (steps < goalSteps) {
    if (now.getHours() >= 21) {
      return { code: "prime_evening_close", meta: {} };
    }
    return { code: "prime_on_track", meta: {} };
  }
  if (steps >= goalSteps && steps < goalSteps + 2000) {
    return { code: "prime_goal_done_bonus", meta: {} };
  }
  return { code: "prime_strong", meta: {} };
}

// Returns { steps, messageCode, messageMeta } — no language strings.
function buildSuggestedSteps({ remainingSteps, hoursLeft, now }) {
  if (remainingSteps <= 0) {
    return { steps: 500, messageCode: "suggested_bonus", messageMeta: {} };
  }

  if (now.getHours() < 18) {
    const suggestion = Math.min(remainingSteps, Math.max(500, roundToHundreds(remainingSteps * 0.45)));
    return { steps: suggestion, messageCode: "suggested_morning", messageMeta: { suggestion } };
  }

  if (now.getHours() < 21) {
    const suggestion = Math.min(remainingSteps, Math.max(700, roundToHundreds(remainingSteps * 0.7)));
    return { steps: suggestion, messageCode: "suggested_evening", messageMeta: { suggestion } };
  }

  return {
    steps: remainingSteps,
    messageCode: hoursLeft <= 1.5 ? "suggested_deadline_short" : "suggested_deadline_spread",
    messageMeta: { remaining: remainingSteps },
  };
}

// Returns hero fields as codes — no language strings.
function buildHeroModel({ steps, goalSteps, remainingSteps, suggestedSteps }) {
  if (steps <= 0) {
    return {
      eyebrowCode: "hero_eyebrow_not_started",
      labelCode:   "hero_label_first500",
      summaryCode: "hero_summary_goal",
      summaryMeta: { goalSteps },
    };
  }

  if (remainingSteps <= 0) {
    return {
      eyebrowCode: "hero_eyebrow_done",
      labelCode:   "hero_label_steps",
      summaryCode: "hero_summary_bonus",
      summaryMeta: { bonusSteps: Math.max(steps - goalSteps, 0) },
    };
  }

  return {
    eyebrowCode: "hero_eyebrow_active",
    labelCode:   "hero_label_steps",
    summaryCode: "hero_summary_remaining",
    summaryMeta: { remainingSteps },
  };
}

function buildPermissionCard(permissionStatus) {
  if (permissionStatus === "denied") {
    return {
      titleCode:         "permission_denied_title",
      bodyCode:          "permission_denied_body",
      primaryLabelCode:  "permission_primary",
      secondaryLabelCode:"permission_secondary",
      tertiaryLabelCode: "permission_settings",
    };
  }

  if (permissionStatus === "unavailable") {
    return {
      titleCode:         "permission_unavailable_title",
      bodyCode:          "permission_unavailable_body",
      primaryLabelCode:  "",
      secondaryLabelCode:"permission_secondary",
      tertiaryLabelCode: "",
    };
  }

  return {
    titleCode:         "permission_pending_title",
    bodyCode:          "permission_pending_body",
    primaryLabelCode:  "permission_primary",
    secondaryLabelCode:"permission_secondary",
    tertiaryLabelCode: "",
  };
}

// Returns report with trend codes — no language strings.
function buildReport(history = [], trendSignals = {}) {
  const available = (history || []).filter((item) => item?.available);
  const bestDay = available.reduce((best, item) => {
    if (!best || safeNumber(item?.stepCount) > safeNumber(best?.stepCount)) {
      return item;
    }
    return best;
  }, null);

  let trendTitleCode = "trend_steady";
  if (trendSignals.direction3 === "down" || trendSignals.direction7 === "down") {
    trendTitleCode = "trend_down";
  } else if (trendSignals.direction3 === "up" || trendSignals.direction7 === "up") {
    trendTitleCode = "trend_up";
  }

  let trendSummaryCode = "trend_summary_steady";
  if (trendSignals.direction3 === "down" || trendSignals.direction7 === "down") {
    trendSummaryCode = "trend_summary_down";
  } else if (trendSignals.direction3 === "up" || trendSignals.direction7 === "up") {
    trendSummaryCode = "trend_summary_up";
  }

  return {
    sevenDayAverage: roundToHundreds(trendSignals.sevenDayAverage || averageStepCounts(available)),
    bestDay,
    trendTitleCode,
    trendSummaryCode,
  };
}

function buildMilestones(stepCount) {
  const current = safeNumber(stepCount);
  return STEP_MILESTONE_RULES.map((milestone) => ({
    ...milestone,
    reached: current >= milestone.threshold,
  }));
}

function buildMomentum(history = [], streakDays = 0) {
  const available = (history || []).filter((item) => item?.available);
  const activeDays7 = available.filter((item) => safeNumber(item?.stepCount) >= 3000).length;
  const totalSteps7 = available.reduce((total, item) => total + safeNumber(item?.stepCount), 0);

  return {
    streakDays: Math.max(safeNumber(streakDays), 0),
    activeDays7,
    totalSteps7,
  };
}

export function buildStepScreenModel({
  todaySteps,
  stepHistory = [],
  stepPermission,
  stepState,
  stepInsight,
  stepActiveCoach,
  stepGoal = STEP_COACH_DEFAULT_GOAL,
  manualMode = false,
  streakDays = 0,
  now = new Date(),
}) {
  const todayStepCount = safeNumber(todaySteps?.available ? todaySteps?.stepCount : 0);
  const goalSteps = Math.max(safeNumber(stepGoal), STEP_COACH_DEFAULT_GOAL);
  const remainingSteps = Math.max(goalSteps - todayStepCount, 0);
  const hoursLeft = safeNumber(stepActiveCoach?.hoursLeft);
  const progressPercent = Number(((todayStepCount / goalSteps) * 100).toFixed(1));
  const activity = stepInsight?.activityLabel ? stepInsight : classifyStepActivity(todayStepCount);
  const suggested = buildSuggestedSteps({ remainingSteps, hoursLeft, now });
  const hero = buildHeroModel({
    steps: todayStepCount,
    goalSteps,
    remainingSteps,
    suggestedSteps: suggested.steps,
  });
  const report = buildReport(stepHistory, stepActiveCoach?.trendSignals);
  const momentum = buildMomentum(stepHistory, streakDays);
  const screenState = buildScreenState(stepState, stepPermission?.status, manualMode);
  const primeMsg = buildPrimeMessage({ steps: todayStepCount, goalSteps, remainingSteps, hoursLeft, now });

  return {
    today_steps:           todayStepCount,
    goal_steps:            goalSteps,
    remaining_steps:       remainingSteps,
    activity_level:        activity?.activityLevel || null,
    activity_label:        activity?.activityLabel || "",
    prime_message:         primeMsg,
    trend_summary_code:    report.trendSummaryCode,
    permission_state:      stepPermission?.status || "pending",
    manual_entry_enabled:  true,
    screen_state:          screenState,
    progress_percent:      progressPercent,
    hero,
    suggested_steps:       suggested.steps,
    suggested_message:     { code: suggested.messageCode, meta: suggested.messageMeta },
    starter: {
      titleCode:       "starter_title",
      bodyCode:        "starter_body",
      actionLabelCode: "starter_action",
    },
    permission_card: buildPermissionCard(stepPermission?.status),
    report: {
      activityLabel:   activity?.activityLabel || "-",
      sevenDayAverage: report.sevenDayAverage,
      bestDay:         report.bestDay,
      trendTitleCode:  report.trendTitleCode,
      trendSummaryCode:report.trendSummaryCode,
      primeNote:       stepActiveCoach?.rewardMessage || "",
      last3Delta:      safeNumber(stepActiveCoach?.trendSignals?.delta3),
      last7Delta:      safeNumber(stepActiveCoach?.trendSignals?.delta7),
    },
    mini_goals: buildSessionMiniGoals(todayStepCount, goalSteps),
    momentum,
    milestones: buildMilestones(todayStepCount),
  };
}
