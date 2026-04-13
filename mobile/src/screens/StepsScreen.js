/**
 * StepsScreen — step tracking workspace.
 * Coach, progress, manual input, trend.
 */

import React, { useState, useCallback } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useApp } from "../context/AppContext";
import { useLanguage } from "../i18n";
import { trackEvent } from "../utils/analytics";
import { buildStepScreenModel } from "../steps/screenModel";
import { buildActiveStepCoach } from "../steps/coach";
import { Bar, Block, Row, Divider, stepFmt } from "../components/SharedUI";

export default function StepsScreen() {
  const {
    todaySteps,
    stepPermission,
    stepHistory,
    stepInsight,
    loadStepsDashboard,
    addManualSteps,
    userId,
  } = useApp();

  const { t } = useLanguage();
  const [feedback, setFeedback] = useState(null);

  useFocusEffect(
    useCallback(() => {
      trackEvent("steps_opened");
      loadStepsDashboard();
    }, [])
  );

  const stepActiveCoach = buildActiveStepCoach({
    todaySteps,
    stepHistory,
    stepPermission,
  });

  const model = buildStepScreenModel({
    todaySteps,
    stepHistory,
    stepPermission,
    stepState: null,
    stepInsight,
    stepActiveCoach,
    stepGoal: stepInsight.adaptiveGoal || 10000,
  });

  const heroEyebrow  = t("steps." + model.hero.eyebrowCode);
  const heroLabel    = t("steps." + model.hero.labelCode);
  const heroSummary  = t("steps." + model.hero.summaryCode, model.hero.summaryMeta);
  const primeMessage = t("steps." + model.prime_message.code, model.prime_message.meta);
  const suggestedMessage = model.suggested_message
    ? t("steps." + model.suggested_message.code, model.suggested_message.meta)
    : null;
  const trendTitle   = t("steps." + model.report.trendTitleCode);
  const trendSummary = t("steps." + model.report.trendSummaryCode);

  async function handleStepsAdd(amount) {
    await addManualSteps(amount);
    setFeedback(amount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    trackEvent("home_quick_steps_used", { count: amount });
    setTimeout(() => setFeedback(null), 1500);
  }

  const stepReady = todaySteps?.available && stepPermission?.status === "granted";

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Hero ────────────────────────────────────────────── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEyebrow}>{heroEyebrow}</Text>
          <View style={styles.heroRow}>
            <Text style={styles.heroValue}>{stepFmt(model.today_steps)}</Text>
            <Text style={styles.heroLabel}>{heroLabel}</Text>
          </View>
          <Bar value={model.today_steps} target={model.goal_steps} color="#2e7a51" />
          <Text style={styles.heroSub}>
            {model.today_steps === 0 ? t("steps.hero_prompt") : heroSummary}
          </Text>
        </View>

        <Divider />

        {/* ── Coach message ───────────────────────────────────── */}
        <Block label={t("steps.block_coach")}>
          <View style={styles.blockBody}>
            <Text style={styles.coachMessage}>{primeMessage}</Text>
            {suggestedMessage ? (
              <Text style={styles.subNote}>{suggestedMessage}</Text>
            ) : null}
          </View>
        </Block>

        <Divider />

        {/* ── Manual add ─────────────────────────────────────── */}
        <Block label={t("steps.block_add")}>
          <View style={styles.blockBody}>
            {!stepReady && (
              <View style={styles.manualBanner}>
                <Text style={styles.manualTitle}>{t("steps.permission_banner_title")}</Text>
                <Text style={styles.subNote}>{t("steps.permission_banner_body")}</Text>
              </View>
            )}
            <View style={styles.buttonRow}>
              {[500, 1000, 2000, 5000].map((amount) => (
                <Pressable key={amount} style={styles.stepButton} onPress={() => handleStepsAdd(amount)}>
                  <Text style={styles.stepButtonText}>
                    {feedback === amount ? "✓" : `+${stepFmt(amount)}`}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Block>

        <Divider />

        {/* ── Report ─────────────────────────────────────────── */}
        <Block label={t("steps.block_report")}>
          <View style={styles.blockBody}>
            <Row label={t("steps.avg7d")} value={stepFmt(model.report.sevenDayAverage)} />
            <Row label={t("steps.trend")} value={trendTitle} />
            <Text style={styles.subNote}>{trendSummary}</Text>
          </View>
        </Block>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef4e8" },
  content: { padding: 22, paddingBottom: 40 },
  blockBody: { gap: 12 },
  subNote: { fontSize: 14, color: "#7fa88a", lineHeight: 20, fontWeight: "600" },

  heroCard: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    padding: 30,
    gap: 12,
    alignItems: "center",
    marginBottom: 8,
    shadowColor: "#295c41",
    shadowOpacity: 0.05,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  heroEyebrow: {
    fontSize: 12,
    fontWeight: "900",
    color: "#7fa88a",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 10,
  },
  heroValue: {
    fontSize: 44,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -1,
  },
  heroLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#4a6654",
  },
  heroSub: {
    fontSize: 15,
    fontWeight: "700",
    color: "#9ab09e",
    textAlign: "center",
  },

  coachMessage: {
    fontSize: 18,
    fontWeight: "800",
    color: "#14301f",
    lineHeight: 28,
  },

  manualBanner: {
    backgroundColor: "#ffffff",
    padding: 18,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d8e9dc",
    gap: 6,
    marginBottom: 4,
  },
  manualTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#295c41",
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
    flexWrap: "wrap",
  },
  stepButton: {
    flex: 1,
    minWidth: 80,
    backgroundColor: "#ffffff",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  stepButtonText: {
    color: "#295c41",
    fontSize: 16,
    fontWeight: "900",
  },
});
