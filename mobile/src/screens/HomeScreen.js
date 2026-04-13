/**
 * HomeScreen — minimal daily decision surface.
 * One command, one action, high-impact guidance.
 */

import { Share } from "react-native";
import { Pressable, SafeAreaView, ScrollView, Text, View, StyleSheet } from "react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { useFocusEffect } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import { resolvePrimeCore } from "../engine/PrimeCoreEngine";
import {
  buildPostureCommandSignal,
} from "../features/posture/postureCommandBridge";
import { buildPostureIdentityViewModel } from "../features/posture/posturePresentation";
import { getPostureHistory } from "../features/posture/postureStorage";
import {
  buildPostureTaskSuggestion,
  completePostureTask,
  isPostureScanTaskKind,
  loadActivePostureTask,
  getPostureTaskHistory,
} from "../features/posture/postureTaskBridge";
import { 
  calculateIssueProgress, 
  deriveCoachingState 
} from "../features/posture/postureCoachingEngine";
import { trackEvent } from "../utils/analytics";
import { useLanguage, tRaw } from "../i18n";

const READINESS_COLORS = {
  high:     "#295c41",
  moderate: "#b5750a",
  low:      "#8b2020",
};

function MetricPill({ label, value, color }) {
  return (
    <View style={[metricStyles.pill, { borderLeftColor: color }]}>
      <Text style={metricStyles.pillLabel}>{label}</Text>
      <Text style={metricStyles.pillValue}>{value}</Text>
    </View>
  );
}

function PostureIdentityCard({ view, onPress }) {
  if (!view) {
    return null;
  }

  const trendGlyph = view.trend === "up"
    ? "\u2191"
    : view.trend === "down"
      ? "\u2193"
      : "\u2192";

  return (
    <Pressable style={styles.postureIdentityCard} onPress={onPress}>
      <View style={styles.postureIdentityHeader}>
        <View style={styles.postureIdentityBadge}>
          <Text style={styles.postureIdentityBadgeText}>{view.badgeLabel}</Text>
        </View>

        {view.hasComparison && view.deltaText ? (
          <View style={styles.postureIdentityTrendBadge}>
            <Text style={styles.postureIdentityTrendGlyph}>{trendGlyph}</Text>
            <Text style={styles.postureIdentityTrendText}>{view.deltaText}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.postureIdentityMetrics}>
        <View style={styles.postureIdentityMetric}>
          <Text style={styles.postureIdentityMetricLabel}>{view.scoreLabel}</Text>
          <Text style={styles.postureIdentityScore}>{view.score}</Text>
        </View>

        <View style={styles.postureIdentityMetric}>
          <Text style={styles.postureIdentityMetricLabel}>{view.levelLabelCaption}</Text>
          <Text style={styles.postureIdentityLevel}>
            {view.levelNumber}. {view.levelLabel}
          </Text>
        </View>
      </View>

      <Text style={styles.postureIdentityMicroMessage}>{view.microMessage}</Text>
    </Pressable>
  );
}

export default function HomeScreen({ navigation }) {
  const {
    hasProfile,
    profileForm,
    goals,
    dailyCoach,
    dailySummary,
    hydrationData,
    hydrationState,
    todaySteps,
    stepInsight,
    sleepData,
    streakSummary,
    summaryState,
    completeDay,
  } = useApp();

  const { t, language } = useLanguage();
  const lastActionType = useRef(null);
  const [postureSignal, setPostureSignal] = useState(null);
  const [postureHistoryContext, setPostureHistoryContext] = useState({
    latestResult: null,
    previousResult: null,
  });
  const [postureTaskCandidate, setPostureTaskCandidate] = useState(null);
  const [postureTask, setPostureTask] = useState(null);
  const [postureTaskSaving, setPostureTaskSaving] = useState(false);
  const [showCompletionGlow, setShowCompletionGlow] = useState(false);

  useEffect(() => { trackEvent("home_opened"); }, []);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;

      async function loadPostureSupport() {
        try {
          const history = await getPostureHistory();
          const taskHistory = await getPostureTaskHistory();
          const latestResult = history[0] ?? null;
          const previousResult = history[1] ?? null;
          if (cancelled) return;
          
          const coachingState = action.directive ? deriveCoachingState(taskHistory, action.directive.issueId) : null;
          const issueProgress = action.directive ? calculateIssueProgress(action.directive.issueId, taskHistory, history) : 0;

          setPostureHistoryContext({ 
            latestResult, 
            previousResult, 
            taskHistory, 
            coachingState,
            issueProgress 
          });
          
          setPostureSignal(buildPostureCommandSignal(latestResult, { 
            previousResult, 
            taskHistory,
            t 
          }));
          setPostureTaskCandidate(buildPostureTaskSuggestion(latestResult, { 
            previousResult,
            history: taskHistory,
            fullHistory: history
          }));
          setPostureTask(null);
        } catch (_) {
          if (!cancelled) {
            setPostureHistoryContext({ latestResult: null, previousResult: null });
            setPostureSignal(null);
            setPostureTaskCandidate(null);
            setPostureTask(null);
          }
        }
      }

      loadPostureSupport();

      return () => {
        cancelled = true;
      };
    }, []),
  );

  // ── PRIME CORE ───────────────────────────────────────────────────────────
  const isLoading = summaryState === "Yükleniyor" || hydrationState === "Yükleniyor"; // internal state token — not displayed
  const stepGoal  = stepInsight?.adaptiveGoal || 10000;

  const isFirstSession = !hasProfile && (dailySummary?.meal_count || 0) === 0 && (hydrationData?.consumed_ml || 0) === 0;

  const action = useMemo(
    () =>
      resolvePrimeCore({
        hasProfile,
        goals,
        dailyCoach,
        dailySummary,
        hydrationData,
        sleepData,
        postureSignal,
        isLoading,
      }),
    [hasProfile, goals, dailyCoach, dailySummary, hydrationData, sleepData, postureSignal, isLoading]
  );

  useEffect(() => {
    if (action.actionType === lastActionType.current) return;
    lastActionType.current = action.actionType;
    trackEvent("primecore_action_shown", {
      type:           action.actionType,
      priority:       action.priority,
      readiness:      action.readiness,
      readinessScore: action.readinessScore,
      dataConfidence: action.dataConfidence,
    });
  }, [action]);

  // ── Share ────────────────────────────────────────────────────────────────
  const score = dailyCoach?.behavior_score ?? null;
  const hasHighScore = Number(score?.total ?? 0) >= 85 || score?.status === "strong";
  const hasShareableStreak = streakSummary.days >= 3;
  const canShare = hasShareableStreak || hasHighScore;

  async function handleShare() {
    trackEvent("share_tapped", { streak: streakSummary.days, trigger: hasShareableStreak ? "streak" : "score" });
    try {
      const shareText = hasShareableStreak
        ? t("home.shareTextStreak", { days: streakSummary.days })
        : t("home.shareTextScore",  { score: score?.total ?? "-" });
      await Share.share({ message: shareText });
    } catch (_) {}
  }

  // ── Action press ─────────────────────────────────────────────────────────
  function handleMainAction() {
    trackEvent("home_primary_action_tapped", { type: action.actionType, target: action.targetScreen });
    navigation.navigate(action.targetScreen);
  }

  // ── Calculations ──────────────────────────────────────────────────────────
  const proteinCurrent = dailyCoach?.actual_protein_g ?? dailySummary?.total_protein_g ?? 0;
  const proteinTarget  = goals?.protein_target_g ?? dailyCoach?.protein_target_g ?? 0;
  const proteinPct     = proteinTarget > 0 ? Math.min(Math.round((proteinCurrent / proteinTarget) * 100), 100) : 0;

  const hydConsumed = hydrationData?.consumed_ml ?? 0;
  const hydTarget   = goals?.water_target_ml ?? hydrationData?.target_ml ?? 2500;
  const hydPct      = hydTarget > 0 ? Math.min(Math.round((hydConsumed / hydTarget) * 100), 100) : 0;

  const stepCount = Number(todaySteps?.stepCount ?? 0);
  const stepPct   = stepGoal > 0 ? Math.min(Math.round((stepCount / stepGoal) * 100), 100) : 0;

  const sleepHours = sleepData?.total_sleep_minutes
    ? `${(sleepData.total_sleep_minutes / 60).toFixed(1)}s`
    : "-";

  // ── Localised date label — re-derives when language changes ──────────────
  const dateLabel = useMemo(() => {
    const d      = new Date();
    const days   = tRaw(language, "home.days")   ?? [];
    const months = tRaw(language, "home.months") ?? [];
    return `${d.getDate()} ${months[d.getMonth()]}, ${days[d.getDay()]}`;
  }, [language]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── CTA label ─────────────────────────────────────────────────────────────
  const ctaLabel = action.actionType === "profile"
    ? (isFirstSession ? t("home.startHere") : t("home.completeProfile"))
    : (t(`home.cta.${action.actionType}`) || t("home.defaultCta"));

  // ── Readiness label ───────────────────────────────────────────────────────
  const readinessLabel = t(`home.readiness.${action.readiness}`);

  // ── Coach command + support (language-agnostic codes from PrimeCoreEngine) ─
  const coachCommand = action.directive
    ? action.directive.command
    : (action.commandCode ? t(`home.coach.${action.commandCode}.command`, action.commandMeta) : "");

  const coachSupport = action.directive
    ? action.directive.feedback
    : (action.supportCode ? t(`home.coach.${action.supportCode}.support`, action.supportMeta) : "");
  // Posture tasks stay secondary to the core command surface.
  const showPostureTask = useMemo(() => {
    if (!postureTaskCandidate) {
      return false;
    }

    if (action.actionType === "loading") {
      return false;
    }

    if (action.priority === "critical" || action.priority === "high") {
      return false;
    }

    return true;
  }, [action.actionType, action.priority, postureTaskCandidate]);

  useEffect(() => {
    let cancelled = false;

    if (!showPostureTask || !postureTaskCandidate) {
      setPostureTask(null);
      return () => {
        cancelled = true;
      };
    }

    async function syncPostureTask() {
      try {
        const nextTask = await loadActivePostureTask({
          latestResult: postureHistoryContext.latestResult,
          previousResult: postureHistoryContext.previousResult,
          taskSuggestion: postureTaskCandidate,
        });

        if (!cancelled) {
          setPostureTask(nextTask);
        }
      } catch (_) {
        if (!cancelled) {
          setPostureTask(null);
        }
      }
    }

    syncPostureTask();

    return () => {
      cancelled = true;
    };
  }, [
    postureHistoryContext.latestResult,
    postureHistoryContext.previousResult,
    postureTaskCandidate,
    showPostureTask,
  ]);

  const showPostureSupport = useMemo(() => {
    if (!postureSignal) {
      return false;
    }

    if (postureTask?.kind === "rescan") {
      return false;
    }

    if (action.actionType === "posture") {
      return false;
    }

    if (action.priority === "critical") {
      return false;
    }

    if (action.priority === "high") {
      return postureSignal.kind === "support" && postureSignal.priorityTag === "medium";
    }

    return true;
  }, [action.priority, action.actionType, postureSignal, postureTask]);

  const postureBadgeLabel = postureSignal ? t("home.posture.badge") : "";
  const postureCommand = postureSignal
    ? t(`home.posture.command.${postureSignal.commandKey}`)
    : "";
  const postureCue = postureSignal
    ? t(`home.posture.cue.${postureSignal.cueKey}`)
    : "";
  const postureSupport = postureSignal
    ? t(`home.posture.support.${postureSignal.supportKey}`)
    : "";
  const postureTaskLabel = postureTask ? t("home.postureTask.label") : "";
  const postureTaskTitle = postureTask ? t(postureTask.titleKey) : "";
  const postureTaskSubtitle = postureTask ? t(postureTask.subtitleKey) : "";
  const postureTaskActionLabel = postureTask
    ? postureTask.completed
      ? t("home.postureTask.actions.completed")
      : t(`home.postureTask.actions.${postureTask.actionLabelKey}`)
    : "";
  const postureTaskPriorityLabel = postureTask
    ? t(`home.postureTask.priority.${postureTask.priority}`)
    : "";
  const postureIdentityView = useMemo(
    () => buildPostureIdentityViewModel(
      t,
      postureHistoryContext.latestResult,
      postureHistoryContext.previousResult,
    ),
    [postureHistoryContext.latestResult, postureHistoryContext.previousResult, t],
  );

  const handlePostureTaskAction = useCallback(async () => {
    if (!postureTask || postureTaskSaving) {
      return;
    }

    if (isPostureScanTaskKind(postureTask.kind)) {
      trackEvent("posture_task_opened", {
        taskId: postureTask.id,
        priority: postureTask.priority,
      });
      navigation.navigate(postureTask.targetScreen);
      return;
    }

    if (postureTask.completed) {
      return;
    }

    setPostureTaskSaving(true);

    try {
      const completedTask = await completePostureTask(postureTask);
      await completeDay();
      if (completedTask) {
        setPostureTask(completedTask);
        setShowCompletionGlow(true);
        setTimeout(() => setShowCompletionGlow(false), 2000);
      }
      trackEvent("posture_task_completed", {
        taskId: postureTask.id,
        priority: postureTask.priority,
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (_) {
    } finally {
      setPostureTaskSaving(false);
    }
  }, [completeDay, navigation, postureTask, postureTaskSaving]);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Header ─────────────────────────────────────────── */}
        <View style={styles.headerRow}>
          <Text style={styles.greetingText}>
            {profileForm?.name
              ? t("home.greeting", { name: profileForm.name })
              : t("home.greetingGeneric")}
          </Text>
          <Text style={styles.dateText}>{dateLabel}</Text>
        </View>

        {/* ── PRIME CORE Command ─────────────────────────────── */}
        <View style={styles.commandBlock}>
          {action.readiness !== "unknown" && READINESS_COLORS[action.readiness] && (
            <View style={[styles.readinessBadge, { borderColor: READINESS_COLORS[action.readiness] }]}>
              <View style={[styles.readinessDot, { backgroundColor: READINESS_COLORS[action.readiness] }]} />
              <Text style={[styles.readinessBadgeText, { color: READINESS_COLORS[action.readiness] }]}>
                {readinessLabel}
              </Text>
            </View>
          )}
          <Text style={styles.commandText}>{coachCommand}</Text>
          {!!coachSupport && (
            <Text style={styles.supportText}>{coachSupport}</Text>
          )}

          {showPostureSupport && !action.directive ? (
            <View style={styles.postureSupportCard}>
              <View style={styles.postureSupportHeader}>
                <View style={styles.postureSupportBadge}>
                  <Text style={styles.postureSupportBadgeText}>{postureBadgeLabel}</Text>
                </View>
                <Text style={styles.postureSupportCue}>
                  {t("home.posture.focusLabel")}: {postureCue}
                </Text>
              </View>

              <Text style={styles.postureCommandText}>{postureCommand}</Text>
              <Text style={styles.postureSupportText}>{postureSupport}</Text>

              {postureSignal?.ctaKey ? (
                <Pressable
                  style={styles.postureSupportLink}
                  onPress={() => navigation.navigate(postureSignal.targetScreen)}
                >
                  <Text style={styles.postureSupportLinkText}>
                    {t(`home.posture.cta.${postureSignal.ctaKey}`)}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          
          {action.directive && (
            <View style={[
              styles.postureCoachingCard,
              showCompletionGlow && styles.postureCoachingCardGlow
            ]}>
               <View style={styles.postureCoachingHeader}>
                 <Text style={styles.postureCoachingTier}>TIER {action.directive.tier}</Text>
                 <View style={styles.postureCoachingBadge}>
                   <Text style={styles.postureCoachingBadgeText}>COACH</Text>
                 </View>
               </View>
               <Text style={styles.postureCoachingCommand}>{action.directive.command}</Text>
               
               {/* V2: Progress Bar */}
               <View style={styles.progressContainer}>
                 <View style={styles.progressTrack}>
                   <View style={[styles.progressFill, { width: `${postureHistoryContext.issueProgress || 0}%` }]} />
                 </View>
                 <Text style={styles.progressLabel}>
                   {postureHistoryContext.issueProgress || 0}% {t("posture.coaching.progressLabel") || "İlerleme"}
                 </Text>
               </View>

               {/* V2: Anticipation Hint */}
               {action.directive.hint && (
                 <Text style={styles.postureCoachingHint}>{action.directive.hint}</Text>
               )}
            </View>
          )}
        </View>

        {/* ── Primary CTA ────────────────────────────────────── */}
        <Pressable
          style={[
            styles.primaryButton,
            (action.priority === "high" || action.priority === "critical") && styles.primaryButtonHigh,
            action.actionType === "loading" && styles.primaryButtonLoading,
            isFirstSession && styles.primaryButtonPulse,
          ]}
          onPress={handleMainAction}
          disabled={action.actionType === "loading"}
        >
          <Text style={styles.primaryButtonText}>{ctaLabel}</Text>
        </Pressable>

        {/* ── Compact daily metrics ──────────────────────────── */}
        <View style={styles.metricsWrapper}>
          <Text style={styles.metricsHeader}>{t("home.dailySummary")}</Text>
          <View style={styles.metricsGrid}>
            <MetricPill label={t("home.metrics.protein")} value={`${proteinPct}%`} color="#295c41" />
            <MetricPill label={t("home.metrics.water")}   value={`${hydPct}%`}     color="#4a90d9" />
            <MetricPill label={t("home.metrics.steps")}   value={`${stepPct}%`}    color="#2e7a51" />
            <MetricPill label={t("home.metrics.sleep")}   value={sleepHours}       color="#6b5fb5" />
          </View>
        </View>

        {/* ── Streak + share ──────────────────────────────────── */}
        <PostureIdentityCard
          view={postureIdentityView}
          onPress={() => navigation.navigate("PostureHistory")}
        />

        {showPostureTask && postureTask ? (
          <View style={styles.postureTaskCard}>
            <View style={styles.postureTaskHeader}>
              <View style={styles.postureTaskBadge}>
                <Text style={styles.postureTaskBadgeText}>{postureTaskLabel}</Text>
              </View>
              <Text style={styles.postureTaskPriority}>{postureTaskPriorityLabel}</Text>
            </View>

            <Text style={styles.postureTaskTitle}>{postureTaskTitle}</Text>
            <Text style={styles.postureTaskSubtitle}>{postureTaskSubtitle}</Text>

            {postureTask.completed ? (
              <Text style={styles.postureTaskCompleted}>
                {t("home.postureTask.completedNote")}
              </Text>
            ) : postureTask.countsTowardConsistency ? (
              <Text style={styles.postureTaskNote}>
                {t("home.postureTask.consistency")}
              </Text>
            ) : null}

            <Pressable
              style={[
                styles.postureTaskButton,
                postureTask.completed && styles.postureTaskButtonCompleted,
                postureTaskSaving && styles.postureTaskButtonDisabled,
              ]}
              onPress={handlePostureTaskAction}
              disabled={postureTaskSaving || postureTask.completed}
            >
              <Text
                style={[
                  styles.postureTaskButtonText,
                  postureTask.completed && styles.postureTaskButtonTextCompleted,
                ]}
              >
                {postureTaskActionLabel}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.footer}>
          {streakSummary.days > 0 ? (
            <View style={styles.streakBadge}>
              <Text style={styles.streakText}>
                {t("home.streakDays", { days: streakSummary.days })}
              </Text>
            </View>
          ) : null}
          {canShare ? (
            <Pressable onPress={handleShare} style={styles.shareButton} hitSlop={10}>
              <Text style={styles.shareText}>{t("home.shareWithFriends")}</Text>
            </Pressable>
          ) : null}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const metricStyles = StyleSheet.create({
  pill: {
    flex: 1,
    minWidth: "42%",
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    gap: 4,
    borderLeftWidth: 3,
  },
  pillLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7fa88a",
    textTransform: "uppercase",
  },
  pillValue: {
    fontSize: 20,
    fontWeight: "900",
    color: "#14301f",
  },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef4e8" },
  content: {
    paddingHorizontal: 28,
    paddingVertical: 24,
    gap: 28,
  },

  headerRow: {
    marginBottom: 4,
    gap: 4,
  },
  greetingText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#7fa88a",
    letterSpacing: 0.5,
  },
  dateText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#14301f",
    marginTop: 2,
  },

  commandBlock: {
    paddingVertical: 10,
    gap: 8,
  },
  readinessBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "#ffffff",
  },
  readinessDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  readinessBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  commandText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#14301f",
    lineHeight: 40,
    letterSpacing: -0.5,
  },
  supportText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7fa88a",
    lineHeight: 22,
  },
  postureSupportCard: {
    marginTop: 6,
    backgroundColor: "#f7fbf7",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  postureSupportHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
  },
  postureSupportBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  postureSupportBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  postureSupportCue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7fa88a",
    letterSpacing: 0.2,
  },
  postureCommandText: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.2,
  },
  postureSupportText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#4a6654",
  },
  postureSupportLink: {
    alignSelf: "flex-start",
    paddingVertical: 2,
  },
  postureSupportLinkText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.3,
  },

  primaryButton: {
    backgroundColor: "#295c41",
    borderRadius: 22,
    paddingVertical: 22,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
  },
  primaryButtonHigh:    { backgroundColor: "#1b442e" },
  primaryButtonLoading: { backgroundColor: "#9ab09e", elevation: 0 },
  primaryButtonPulse: {
    backgroundColor: "#14301f",
    borderWidth: 2,
    borderColor: "#4a90d9",
    elevation: 10,
  },
  primaryButtonText: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  metricsWrapper: { gap: 12 },
  metricsHeader: {
    fontSize: 12,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 1.5,
    marginLeft: 4,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  postureIdentityCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
    borderWidth: 1,
    borderColor: "#d8e9dc",
    shadowColor: "#295c41",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  postureIdentityHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    flexWrap: "wrap",
  },
  postureIdentityBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f0f7f1",
  },
  postureIdentityBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  postureIdentityTrendBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: "#f7fbf7",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  postureIdentityTrendGlyph: {
    fontSize: 13,
    fontWeight: "900",
    color: "#295c41",
  },
  postureIdentityTrendText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.4,
  },
  postureIdentityMetrics: {
    flexDirection: "row",
    gap: 12,
  },
  postureIdentityMetric: {
    flex: 1,
    backgroundColor: "#f7fbf7",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
    borderWidth: 1,
    borderColor: "#e1ebe2",
  },
  postureIdentityMetricLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 0.7,
    textTransform: "uppercase",
  },
  postureIdentityScore: {
    fontSize: 28,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.4,
  },
  postureIdentityLevel: {
    fontSize: 19,
    lineHeight: 25,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.3,
  },
  postureIdentityMicroMessage: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#4a6654",
  },
  postureTaskCard: {
    backgroundColor: "#ffffff",
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  postureTaskHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  postureTaskBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#f3f8f4",
  },
  postureTaskBadgeText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  postureTaskPriority: {
    fontSize: 11,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  postureTaskTitle: {
    fontSize: 21,
    lineHeight: 28,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.3,
  },
  postureTaskSubtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: "#4a6654",
  },
  postureTaskNote: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "700",
    color: "#7fa88a",
  },
  postureTaskCompleted: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    color: "#295c41",
  },
  postureTaskButton: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#295c41",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  postureTaskButtonCompleted: {
    backgroundColor: "#edf6ef",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  postureTaskButtonDisabled: {
    opacity: 0.6,
  },
  postureTaskButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  postureTaskButtonTextCompleted: {
    color: "#295c41",
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  streakBadge: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  streakText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 1,
  },
  shareButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "flex-end",
  },
  shareText: {
    color: "#7fa88a",
    fontWeight: "900",
    fontSize: 12,
    letterSpacing: 1,
  },
  postureCoachingCard: {
    backgroundColor: "#14301f",
    borderRadius: 16,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  postureCoachingCardGlow: {
    shadowColor: "#7fa88a",
    shadowOpacity: 0.8,
    shadowRadius: 12,
    elevation: 10,
    borderColor: "#7fa88a",
  },
  postureCoachingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  postureCoachingTier: {
    fontSize: 10,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 1,
  },
  postureCoachingBadge: {
    backgroundColor: "#7fa88a",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  postureCoachingBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#ffffff",
  },
  postureCoachingCommand: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
    lineHeight: 22,
  },
  progressContainer: {
    marginTop: 14,
    gap: 6,
  },
  progressTrack: {
    height: 6,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#7fa88a",
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7fa88a",
    letterSpacing: 0.5,
  },
  postureCoachingHint: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "600",
    color: "#7fa88a",
    fontStyle: "italic",
    opacity: 0.85,
  },
});
