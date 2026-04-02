import { Share } from "react-native";
import { Pressable, SafeAreaView, ScrollView, Text, View, StyleSheet } from "react-native";
import { useMemo } from "react";
import { useApp } from "../context/AppContext";
import { resolveProblem } from "../utils/problemEngine";

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
  } = useApp();

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

  // ── Share (only when streak ≥ 3 or strong score) ─────────────────────────
  const score = dailyCoach?.behavior_score ?? null;
  const hasHighScore = Number(score?.total ?? 0) >= 85 || score?.status === "strong";
  const hasShareableStreak = streakSummary.days >= 3;
  const canShare = hasShareableStreak || hasHighScore;
  const shareText = hasShareableStreak
    ? `${streakSummary.days} gündür hedeflerimi tutturuyorum 🔥`
    : `Bugün uyum skorum ${score?.total ?? "-"}/100. Hedeflerimi tutturuyorum 🚀`;

  async function handleShare() {
    try {
      await Share.share({ message: shareText });
    } catch (_) {}
  }

  // ── Action press ─────────────────────────────────────────────────────────
  function handleAction() {
    if (!problem.action) return;
    navigation.navigate(problem.action.screen);
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

        {/* ── Primary action ─────────────────────────────────────── */}
        {problem.action ? (
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
