/**
 * Posture Coaching Model
 * Defines the structured coaching loops, task tiers, and directives.
 */

export const POSTURE_ISSUES = {
  FORWARD_HEAD: "forward_head",
  KYPHOSIS: "kyphosis",
  SHOULDER_BALANCE: "shoulder_balance",
  MAINTENANCE: "maintenance",
};

export const TASK_TIERS = {
  AWARENESS: 1,  // Check screen height, no physical demand
  ACTIVATION: 2, // 30s shoulder pull back, light activation
  CORRECTION: 3, // 2 sets scapula squeeze, targeted
  HABIT: 4,      // Maintain position throughout day
};

export const STREAK_MILESTONES = {
  3: "posture.coaching.milestones.awareness",
  5: "posture.coaching.milestones.control",
  7: "posture.coaching.milestones.habit",
};

export const ISSUE_STATUS = {
  IMPROVING: "improving",
  STABLE: "stable",
  NEEDS_ATTENTION: "needs_attention",
};

export const COACHING_TASKS = [
  // --- FORWARD HEAD ---
  {
    id: "fh_awareness_screen",
    issueId: POSTURE_ISSUES.FORWARD_HEAD,
    tier: TASK_TIERS.AWARENESS,
    titleKey: "posture.coaching.tasks.fh_awareness_screen.title",
    subtitleKey: "posture.coaching.tasks.fh_awareness_screen.subtitle",
    directiveKey: "posture.coaching.directives.fh_awareness_screen",
    feedbackKey: "posture.coaching.feedback.awareness",
  },
  {
    id: "fh_activation_chin_tuck",
    issueId: POSTURE_ISSUES.FORWARD_HEAD,
    tier: TASK_TIERS.ACTIVATION,
    titleKey: "posture.coaching.tasks.fh_activation_chin_tuck.title",
    subtitleKey: "posture.coaching.tasks.fh_activation_chin_tuck.subtitle",
    directiveKey: "posture.coaching.directives.fh_activation_chin_tuck",
    feedbackKey: "posture.coaching.feedback.activation",
  },
  {
    id: "fh_correction_wall_reset",
    issueId: POSTURE_ISSUES.FORWARD_HEAD,
    tier: TASK_TIERS.CORRECTION,
    titleKey: "posture.coaching.tasks.fh_correction_wall_reset.title",
    subtitleKey: "posture.coaching.tasks.fh_correction_wall_reset.subtitle",
    directiveKey: "posture.coaching.directives.fh_correction_wall_reset",
    feedbackKey: "posture.coaching.feedback.correction",
  },
  {
    id: "fh_habit_eye_level",
    issueId: POSTURE_ISSUES.FORWARD_HEAD,
    tier: TASK_TIERS.HABIT,
    titleKey: "posture.coaching.tasks.fh_habit_eye_level.title",
    subtitleKey: "posture.coaching.tasks.fh_habit_eye_level.subtitle",
    directiveKey: "posture.coaching.directives.fh_habit_eye_level",
    feedbackKey: "posture.coaching.feedback.habit",
  },

  // --- KYPHOSIS / UPPER BACK ---
  {
    id: "ky_awareness_slump",
    issueId: POSTURE_ISSUES.KYPHOSIS,
    tier: TASK_TIERS.AWARENESS,
    titleKey: "posture.coaching.tasks.ky_awareness_slump.title",
    subtitleKey: "posture.coaching.tasks.ky_awareness_slump.subtitle",
    directiveKey: "posture.coaching.directives.ky_awareness_slump",
    feedbackKey: "posture.coaching.feedback.awareness",
  },
  {
    id: "ky_activation_shoulder_pull",
    issueId: POSTURE_ISSUES.KYPHOSIS,
    tier: TASK_TIERS.ACTIVATION,
    titleKey: "posture.coaching.tasks.ky_activation_shoulder_pull.title",
    subtitleKey: "posture.coaching.tasks.ky_activation_shoulder_pull.subtitle",
    directiveKey: "posture.coaching.directives.ky_activation_shoulder_pull",
    feedbackKey: "posture.coaching.feedback.activation",
  },
  {
    id: "ky_correction_scapula_squeeze",
    issueId: POSTURE_ISSUES.KYPHOSIS,
    tier: TASK_TIERS.CORRECTION,
    titleKey: "posture.coaching.tasks.ky_correction_scapula_squeeze.title",
    subtitleKey: "posture.coaching.tasks.ky_correction_scapula_squeeze.subtitle",
    directiveKey: "posture.coaching.directives.ky_correction_scapula_squeeze",
    feedbackKey: "posture.coaching.feedback.correction",
  },
  {
    id: "ky_habit_chest_up",
    issueId: POSTURE_ISSUES.KYPHOSIS,
    tier: TASK_TIERS.HABIT,
    titleKey: "posture.coaching.tasks.ky_habit_chest_up.title",
    subtitleKey: "posture.coaching.tasks.ky_habit_chest_up.subtitle",
    directiveKey: "posture.coaching.directives.ky_habit_chest_up",
    feedbackKey: "posture.coaching.feedback.habit",
  },

  // --- SHOULDER BALANCE ---
  {
    id: "sb_awareness_lean",
    issueId: POSTURE_ISSUES.SHOULDER_BALANCE,
    tier: TASK_TIERS.AWARENESS,
    titleKey: "posture.coaching.tasks.sb_awareness_lean.title",
    subtitleKey: "posture.coaching.tasks.sb_awareness_lean.subtitle",
    directiveKey: "posture.coaching.directives.sb_awareness_lean",
    feedbackKey: "posture.coaching.feedback.awareness",
  },
  {
    id: "sb_activation_single_shrug",
    issueId: POSTURE_ISSUES.SHOULDER_BALANCE,
    tier: TASK_TIERS.ACTIVATION,
    titleKey: "posture.coaching.tasks.sb_activation_single_shrug.title",
    subtitleKey: "posture.coaching.tasks.sb_activation_single_shrug.subtitle",
    directiveKey: "posture.coaching.directives.sb_activation_single_shrug",
    feedbackKey: "posture.coaching.feedback.activation",
  },

  // --- MAINTENANCE ---
  {
    id: "ma_habit_balance",
    issueId: POSTURE_ISSUES.MAINTENANCE,
    tier: TASK_TIERS.HABIT,
    titleKey: "posture.coaching.tasks.ma_habit_balance.title",
    subtitleKey: "posture.coaching.tasks.ma_habit_balance.subtitle",
    directiveKey: "posture.coaching.directives.ma_habit_balance",
    feedbackKey: "posture.coaching.feedback.habit",
  },
];

export function selectTaskByIssueAndTier(issueId, tier) {
  return COACHING_TASKS.find(t => t.issueId === issueId && t.tier === tier) || null;
}

export function getIssueFromFindings(findings) {
  if (findings.kyphosis === "high" || findings.kyphosis === "medium") return POSTURE_ISSUES.KYPHOSIS;
  if (findings.forwardHead === true) return POSTURE_ISSUES.FORWARD_HEAD;
  if (findings.shoulderAsymmetry === "left_low" || findings.shoulderAsymmetry === "right_low") return POSTURE_ISSUES.SHOULDER_BALANCE;
  return POSTURE_ISSUES.MAINTENANCE;
}

export const FEEDBACK_POOLS = {
  [TASK_TIERS.AWARENESS]: [
    "posture.coaching.feedback.pools.awareness.1",
    "posture.coaching.feedback.pools.awareness.2",
    "posture.coaching.feedback.pools.awareness.3",
  ],
  [TASK_TIERS.ACTIVATION]: [
    "posture.coaching.feedback.pools.activation.1",
    "posture.coaching.feedback.pools.activation.2",
    "posture.coaching.feedback.pools.activation.3",
  ],
  [TASK_TIERS.CORRECTION]: [
    "posture.coaching.feedback.pools.correction.1",
    "posture.coaching.feedback.pools.correction.2",
    "posture.coaching.feedback.pools.correction.3",
  ],
  [TASK_TIERS.HABIT]: [
    "posture.coaching.feedback.pools.habit.1",
    "posture.coaching.feedback.pools.habit.2",
  ],
};

export const ANTICIPATION_HINTS = {
  [TASK_TIERS.AWARENESS]: "posture.coaching.hints.to_activation",
  [TASK_TIERS.ACTIVATION]: "posture.coaching.hints.to_correction",
  [TASK_TIERS.CORRECTION]: "posture.coaching.hints.to_habit",
  [TASK_TIERS.HABIT]: "posture.coaching.hints.maintain",
};
