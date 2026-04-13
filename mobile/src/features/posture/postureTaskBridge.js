import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  getLatestPostureResult,
  isPostureResultFresh,
  POSTURE_FRESHNESS_WINDOW_DAYS,
} from "./postureCommandBridge";
import { selectPostureRecommendations } from "./postureExerciseRecommendations";
import {
  buildPostureIdentitySnapshot,
  getPostureTaskCadence,
} from "./postureIdentity";
import { resolveDailyCoachingTask } from "./postureCoachingEngine";

const POSTURE_TASK_HISTORY_STORAGE_KEY = "posture_task_history";
const MAX_POSTURE_TASK_ENTRIES = 32;
const MAX_POSTURE_TASKS_PER_WEEK = 3;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const SCAN_TASK_KINDS = new Set(["first_scan", "rescan"]);

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function localDateKey(dateValue = new Date()) {
  const date = new Date(dateValue);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function shiftDateKey(dateKey, offsetDays) {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return dateKey;
  }
  date.setDate(date.getDate() + offsetDays);
  return localDateKey(date);
}

function sanitizeTaskEntry(entry) {
  if (!entry || typeof entry !== "object" || !entry.id || !entry.taskId || !entry.dateKey) {
    return null;
  }

  return {
    id: String(entry.id),
    taskId: String(entry.taskId),
    dateKey: String(entry.dateKey).slice(0, 10),
    shownAt: Number(entry.shownAt || 0),
    completedAt: entry.completedAt ? Number(entry.completedAt) : null,
    kind: entry.kind || "exercise",
    priority: entry.priority || "low",
    issueId: entry.issueId || null,
    tier: entry.tier || null,
    streakCount: entry.streakCount || 0,
  };
}

function createTask({
  id,
  titleKey,
  subtitleKey,
  actionLabelKey,
  priority = "low",
  kind = "exercise",
  countsTowardConsistency = true,
  issueId = null,
  tier = null,
}) {
  return {
    id,
    titleKey,
    subtitleKey,
    actionLabelKey,
    domain: "posture",
    priority,
    kind,
    countsTowardConsistency,
    targetScreen: "PostureScreen",
    issueId,
    tier,
  };
}

function buildFirstScanTask() {
  return createTask({
    id: "posture_first_scan",
    titleKey: "home.postureTask.titles.firstScan",
    subtitleKey: "home.postureTask.subtitles.firstScan",
    actionLabelKey: "scan",
    kind: "first_scan",
  });
}

function buildRescanTask(subtitleKey) {
  return createTask({
    id: "posture_rescan",
    titleKey: "home.postureTask.titles.rescan",
    subtitleKey,
    actionLabelKey: "rescan",
    kind: "rescan",
  });
}

function buildExerciseTask(config) {
  return createTask({
    ...config,
    actionLabelKey: "complete",
    kind: "exercise",
  });
}

function isLowConfidenceResult(latestResult) {
  return (latestResult?.confidence ?? "low") === "low";
}

function buildBasePostureTask(latestResult, options = {}) {
  // STATE A — No posture analysis exists yet
  if (!latestResult) {
    return buildFirstScanTask();
  }

  const findings = latestResult.findings ?? {};
  const recommendationIds = selectPostureRecommendations(latestResult);
  const fresh = isPostureResultFresh(latestResult, options);
  const history = options.history || [];
  const lastTask = history[0] ?? null;
  const rotationIndex = history.length % 3;

  const identity = options.identity
    ?? buildPostureIdentitySnapshot(latestResult, options.previousResult ?? null, options.fullHistory || []);
  const correctivePriority = identity?.progression?.trend === "down" ? "medium" : "low";

  // STATE C — Posture result exists but is stale (older than window)
  if (!fresh) {
    return buildRescanTask("home.postureTask.subtitles.rescan");
  }

  // STATE D — Latest result has low confidence (poor visibility/angle)
  if (isLowConfidenceResult(latestResult)) {
    return null;
  }

  // Use Coaching Engine for specialized corrective tasks
  const coachingTask = resolveDailyCoachingTask(latestResult, history, identity);

  if (coachingTask) {
    return buildExerciseTask({
      id: coachingTask.id,
      titleKey: coachingTask.titleKey,
      subtitleKey: coachingTask.subtitleKey,
      priority: correctivePriority,
      issueId: coachingTask.issueId,
      tier: coachingTask.tier,
    });
  }

  // Fallback to simple maintenance if engine somehow fails
  return buildExerciseTask({
    id: "posture_alignment_reset",
    titleKey: "home.postureTask.titles.maintain",
    subtitleKey: "home.postureTask.subtitles.maintain",
    priority: identity?.level?.number >= 4 ? "low" : correctivePriority,
  });
}

function buildHistoryEntry(task, now = Date.now(), streakCount = 0) {
  return {
    id: createId(),
    taskId: task.id,
    dateKey: localDateKey(now),
    shownAt: now,
    completedAt: null,
    kind: task.kind,
    priority: task.priority,
    issueId: task.issueId,
    tier: task.tier,
    streakCount,
  };
}

function getRecentPostureTaskEntries(history, now, windowDays = POSTURE_FRESHNESS_WINDOW_DAYS) {
  return history.filter((entry) => {
    const entryDate = new Date(`${entry.dateKey}T12:00:00`).getTime();
    return Number.isFinite(entryDate) && now - entryDate <= windowDays * DAY_IN_MS;
  });
}

function hasConsecutiveDaySuppression(history, todayKey, now) {
  const yesterdayKey = shiftDateKey(todayKey, -1);
  return getRecentPostureTaskEntries(history, now).some((entry) => entry.dateKey === yesterdayKey);
}

function getTodayTaskEntry(history, todayKey) {
  return history.find((entry) => entry.dateKey === todayKey) ?? null;
}

function isPostureTaskEligible(history, now, cadence = {}) {
  const todayKey = localDateKey(now);
  const recentEntries = getRecentPostureTaskEntries(history, now);
  const maxTasksPerWeek = Number(cadence.maxTasksPerWeek ?? MAX_POSTURE_TASKS_PER_WEEK);
  const suppressConsecutiveDays = cadence.suppressConsecutiveDays !== false;

  if (recentEntries.length >= maxTasksPerWeek) {
    return false;
  }

  if (suppressConsecutiveDays && hasConsecutiveDaySuppression(history, todayKey, now)) {
    return false;
  }

  return true;
}

export async function getPostureTaskHistory() {
  try {
    const raw = await AsyncStorage.getItem(POSTURE_TASK_HISTORY_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map(sanitizeTaskEntry)
      .filter(Boolean)
      .sort((left, right) => right.shownAt - left.shownAt);
  } catch (_) {
    return [];
  }
}

async function writePostureTaskHistory(entries) {
  await AsyncStorage.setItem(
    POSTURE_TASK_HISTORY_STORAGE_KEY,
    JSON.stringify(entries.slice(0, MAX_POSTURE_TASK_ENTRIES)),
  );
}

export function buildPostureTaskSuggestion(latestResult, options = {}) {
  const identity = options.identity
    ?? buildPostureIdentitySnapshot(latestResult, options.previousResult ?? null);

  return buildBasePostureTask(latestResult, {
    ...options,
    identity,
  });
}

export function isPostureScanTaskKind(kind) {
  return SCAN_TASK_KINDS.has(kind);
}

export async function loadActivePostureTask(options = {}) {
  const now = Number(options.now ?? Date.now());
  const latestResult = options.latestResult ?? await getLatestPostureResult();
  const history = await getPostureTaskHistory();
  const fullHistory = options.fullHistory || []; // Analysis history
  
  const identity = options.identity
    ?? buildPostureIdentitySnapshot(latestResult, options.previousResult ?? null, fullHistory);
    
  const baseTask = options.taskSuggestion ?? buildBasePostureTask(latestResult, {
    ...options,
    identity,
    history,
    fullHistory,
  });
  const cadence = getPostureTaskCadence(identity);

  if (!baseTask) {
    return null;
  }

  const todayKey = localDateKey(now);
  const todayEntry = getTodayTaskEntry(history, todayKey);

  if (todayEntry) {
    if (todayEntry.taskId !== baseTask.id) {
      return null;
    }

    return {
      ...baseTask,
      completed: Boolean(todayEntry.completedAt),
      shownAt: todayEntry.shownAt,
      completedAt: todayEntry.completedAt,
    };
  }

  if (!isPostureTaskEligible(history, now, cadence)) {
    return null;
  }

  const nextEntry = buildHistoryEntry(baseTask, now);
  await writePostureTaskHistory([nextEntry, ...history]);

  return {
    ...baseTask,
    completed: false,
    shownAt: nextEntry.shownAt,
    completedAt: null,
  };
}

export async function completePostureTask(task, options = {}) {
  if (!task?.id) {
    return null;
  }

  const now = Number(options.now ?? Date.now());
  const history = await getPostureTaskHistory();
  const todayKey = localDateKey(now);
  const yesterdayKey = shiftDateKey(todayKey, -1);
  
  const existingIndex = history.findIndex(
    (entry) => entry.dateKey === todayKey && entry.taskId === task.id,
  );

  // Calculate Streak with Soft Reset logic
  let streakCount = 1;
  const lastIssueCompletion = history.find(h => h.issueId === task.issueId && h.completedAt);
  
  if (lastIssueCompletion) {
    const lastDate = new Date(`${lastIssueCompletion.dateKey}T12:00:00`).getTime();
    const todayDate = new Date(`${todayKey}T12:00:00`).getTime();
    const diffDays = Math.round((todayDate - lastDate) / DAY_IN_MS);

    if (diffDays === 1) {
      // Perfect streak
      streakCount = (lastIssueCompletion.streakCount || 0) + 1;
    } else if (diffDays === 2) {
      // Soft reset: Only 1 day missed. Decrease streak by 1 instead of zeroing.
      streakCount = Math.max(1, (lastIssueCompletion.streakCount || 1) - 1);
    } else {
      // Hard reset: More than 1 day missed.
      streakCount = 1;
    }
  }

  const nextEntry = existingIndex >= 0
    ? {
        ...history[existingIndex],
        completedAt: history[existingIndex].completedAt || now,
        streakCount: history[existingIndex].streakCount || streakCount,
      }
    : buildHistoryEntry(task, now, streakCount);

  if (existingIndex < 0) {
    nextEntry.completedAt = now;
  }

  const nextHistory = existingIndex >= 0
    ? history.map((entry, index) => (index === existingIndex ? nextEntry : entry))
    : [nextEntry, ...history];

  await writePostureTaskHistory(nextHistory);

  return {
    ...task,
    completed: true,
    completedAt: nextEntry.completedAt,
    streakCount: nextEntry.streakCount,
  };
}

export async function completeActivePostureScanTask(options = {}) {
  const now = Number(options.now ?? Date.now());
  const history = await getPostureTaskHistory();
  const todayKey = localDateKey(now);
  const existingIndex = history.findIndex(
    (entry) => entry.dateKey === todayKey && isPostureScanTaskKind(entry.kind),
  );

  if (existingIndex < 0) {
    return null;
  }

  const nextEntry = {
    ...history[existingIndex],
    completedAt: history[existingIndex].completedAt || now,
  };

  const nextHistory = history.map((entry, index) => (
    index === existingIndex ? nextEntry : entry
  ));

  await writePostureTaskHistory(nextHistory);

  return {
    id: nextEntry.taskId,
    kind: nextEntry.kind,
    priority: nextEntry.priority,
    countsTowardConsistency: true,
    completed: true,
    completedAt: nextEntry.completedAt,
  };
}
