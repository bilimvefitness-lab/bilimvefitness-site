import { Share } from "react-native";
import { Pressable, SafeAreaView, ScrollView, Text, View, StyleSheet } from "react-native";
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Haptics from "expo-haptics";
import { useApp } from "../context/AppContext";
import { resolveProblem } from "../utils/problemEngine";
import { trackEvent } from "../utils/analytics";

export default function HomeScreen({ navigation }) {
  const {
    hasProfile,
    goals,
    dailyCoach,
    dailySummary,
    hydrationData,
    todaySteps,
    stepPermission,
    sleepData,
    streakSummary,
    addWaterMl,
    addManualSteps,
  } = useApp();
  
  const [waterFeedback, setWaterFeedback] = useState(null);
  const [stepsFeedback, setStepsFeedback] = useState(null);
  const lastProblemKey = useRef(null);

  useEffect(() => { trackEvent("home_opened"); }, []);

  // ── Problem engine: one problem, one action ──────────────────────────────
  const problem = useMemo(
    () =>
      resolveProblem({
        hasProfile,
        goals,
        dailyCoach,
        dailySummary,
        hydrationData,
        todaySteps,
        stepPermission,
        sleepData,
      }),
    [hasProfile, goals, dailyCoach, dailySummary, hydrationData, todaySteps, stepPermission, sleepData]
  );

  // ── Track which problem is shown (deduplicated) ──────────────────────────
  useEffect(() => {
    const key = `${problem.priority}::${problem.text}`;
    if (key === lastProblemKey.current) return;
    lastProblemKey.current = key;
    trackEvent("problem_shown", {
      priority: problem.priority,
      text: problem.text,
      actionLabel: problem.action?.label ?? null,
      quickAction: problem.quickAction ?? null,
      hour: new Date().getHours(),
    });
  }, [problem]);

  // ── Share (only when streak ≥ 3 or strong score) ─────────────────────────
  const score = dailyCoach?.behavior_score ?? null;
  const hasHighScore = Number(score?.total ?? 0) >= 85 || score?.status === "strong";
  const hasShareableStreak = streakSummary.days >= 3;
  const canShare = hasShareableStreak || hasHighScore;
  const shareText = hasShareableStreak
    ? `${streakSummary.days} gündür hedeflerimi tutturuyorum 🔥`
    : `Bugün uyum skorum ${score?.total ?? "-"}/100. Hedeflerimi tutturuyorum 🚀`;

  async function handleShare() {
    trackEvent("share_tapped", {
      streak: streakSummary.days,
      problemPriority: problem.priority,
      trigger: hasShareableStreak ? "streak" : "score",
    });
    try {
      await Share.share({ message: shareText });
    } catch (_) {}
  }

  // ── Action press ─────────────────────────────────────────────────────────
  function handleAction() {
    if (!problem.action) return;
    trackEvent("problem_action_tapped", {
      priority: problem.priority,
      text: problem.text,
      actionLabel: problem.action.label,
      quickAction: problem.quickAction ?? null,
      hour: new Date().getHours(),
    });
    navigation.navigate(problem.action.screen);
  }

  async function handleQuickWater(amount) {
    await addWaterMl(amount);
    setWaterFeedback(amount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    trackEvent("home_quick_water_used", { amountMl: amount });
    setTimeout(() => setWaterFeedback(null), 1500);
  }

  async function handleQuickSteps(amount) {
    await addManualSteps(amount);
    setStepsFeedback(amount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    trackEvent("home_quick_steps_used", { count: amount });
    setTimeout(() => setStepsFeedback(null), 1500);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Problem block ──────────────────────────────────────── */}
        <View style={styles.problemBlock}>
          <Text style={styles.problemText}>{problem.text}</Text>
          {problem.context ? (
            <Text style={styles.problemContext}>{problem.context}</Text>
          ) : null}
        </View>

        {/* ── Primary or Quick Action ────────────────────────────── */}
        {problem.quickAction === "water" ? (
          <View style={styles.quickActionCard}>
            <Text style={styles.quickActionLabel}>Hızlı Ekle</Text>
            <View style={styles.quickActionRow}>
              {[200, 300, 500].map((amount) => (
                <Pressable
                  key={amount}
                  style={styles.quickActionButton}
                  onPress={() => handleQuickWater(amount)}
                >
                  <Text style={styles.quickActionText}>
                    {waterFeedback === amount ? "✓" : `+${amount}ml`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : problem.quickAction === "steps" ? (
          <View style={styles.quickActionCard}>
            <Text style={styles.quickActionLabel}>Manuel Adım Ekle</Text>
            <View style={styles.quickActionRow}>
              {[500, 1000].map((amount) => (
                <Pressable
                  key={amount}
                  style={styles.quickActionButton}
                  onPress={() => handleQuickSteps(amount)}
                >
                  <Text style={styles.quickActionText}>
                    {stepsFeedback === amount ? "✓" : `+${amount}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : problem.action ? (
          <Pressable style={styles.actionButton} onPress={handleAction}>
            <Text style={styles.actionButtonText}>{problem.action.label}</Text>
          </Pressable>
        ) : null}

        {/* ── Streak + share ─────────────────────────────────────── */}
        <View style={styles.footer}>
          {streakSummary.days > 0 ? (
            <Text style={styles.streakText}>🔥 {streakSummary.days}</Text>
          ) : null}

          {canShare ? (
            <Pressable onPress={handleShare} style={styles.shareButton}>
              <Text style={styles.shareText}>Paylaş</Text>
            </Pressable>
          ) : null}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef4e8",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 40,
    gap: 28,
  },

  // Problem
  problemBlock: {
    gap: 10,
  },
  problemText: {
    fontSize: 28,
    fontWeight: "900",
    color: "#14301f",
    lineHeight: 36,
  },
  problemContext: {
    fontSize: 18,
    fontWeight: "600",
    color: "#4a6654",
    lineHeight: 26,
  },

  // Action
  actionButton: {
    backgroundColor: "#295c41",
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 17,
    fontWeight: "800",
  },
  
  // Quick Actions
  quickActionCard: {
    backgroundColor: "#d8e9dc",
    padding: 18,
    borderRadius: 16,
    gap: 12,
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#295c41",
    textTransform: "uppercase",
  },
  quickActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  quickActionButton: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  quickActionText: {
    color: "#295c41",
    fontSize: 16,
    fontWeight: "800",
  },

  // Footer row
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    marginTop: 4,
  },
  streakText: {
    fontSize: 22,
    fontWeight: "800",
    color: "#295c41",
  },
  shareButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#dfeee1",
  },
  shareText: {
    color: "#295c41",
    fontWeight: "700",
    fontSize: 14,
  },
});
