import { selectPostureRecommendations } from "./postureExerciseRecommendations";
import { getPostureHistory } from "./postureStorage";
import {
  buildPostureIdentitySnapshot,
  resolvePostureCommandPriority,
  resolvePostureSupportKey,
} from "./postureIdentity";

import { 
  resolveDailyCoachingTask, 
  buildCoachDirective 
} from "./postureCoachingEngine";
import { getIssueFromFindings } from "./postureCoachingModel";

const POSTURE_FRESHNESS_WINDOW_DAYS = 7;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

export async function getLatestPostureResult() {
  const history = await getPostureHistory();
  return history[0] ?? null;
}

export function isPostureResultFresh(entry, options = {}) {
  if (!entry?.date) {
    return false;
  }

  const maxAgeDays = Number(options.maxAgeDays ?? POSTURE_FRESHNESS_WINDOW_DAYS);
  const now = Number(options.now ?? Date.now());
  const ageMs = now - Number(entry.date);

  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= maxAgeDays * DAY_IN_MS;
}

function createSignal({
  kind,
  priorityTag,
  commandKey,
  cueKey,
  supportKey,
  confidence,
}) {
  return {
    kind,
    priorityTag,
    commandKey,
    cueKey,
    supportKey,
    actionDomain: "posture",
    confidence,
    targetScreen: "PostureScreen",
    ctaKey: kind === "retake" ? "rescan" : null,
  };
}

export function buildPostureCommandSignal(latestResult, options = {}) {
  if (!latestResult) {
    return null;
  }

  const fresh = isPostureResultFresh(latestResult, options);
  const confidence = latestResult.confidence ?? "low";
  const findings = latestResult.findings ?? {};
  const recommendationIds = selectPostureRecommendations(latestResult);
  const identity = options.identity
    ?? buildPostureIdentitySnapshot(latestResult, options.previousResult ?? null);
  const supportKey = resolvePostureSupportKey(identity);

  if (!fresh) {
    return null;
  }

  if (confidence === "low") {
    return null;
  }

  const coachingTask = resolveDailyCoachingTask(latestResult, options.taskHistory || [], identity);
  const directive = buildCoachDirective(coachingTask, options.t || ((k) => k));

  if (coachingTask && directive) {
    // V2: Loss Aversion logic
    const taskHistory = options.taskHistory || [];
    const lastCompletion = taskHistory.find(h => h.completedAt);
    if (lastCompletion) {
      const lastDate = new Date(`${lastCompletion.dateKey}T12:00:00`).getTime();
      const todayKey = coachingTask.dateKey || new Date().toISOString().split('T')[0];
      const todayDate = new Date(`${todayKey}T12:00:00`).getTime();
      const diffDays = Math.round((todayDate - lastDate) / (1000 * 60 * 60 * 24));

      if (diffDays >= 2) {
        // Soft skip reminder
        directive.feedback = `${options.t("posture.coaching.loss_aversion.skip_reminder")} ${directive.feedback}`;
      }
    }

    return createSignal({
      kind: "support",
      priorityTag: coachingTask.tier >= 3 ? "medium" : "low",
      commandKey: "coaching_directive",
      cueKey: "coaching_directive",
      supportKey: "coaching_streak",
      confidence,
      directive,
    });
  }

  return null;
}

export { POSTURE_FRESHNESS_WINDOW_DAYS };
