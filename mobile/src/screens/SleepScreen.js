/**
 * SleepScreen — integration wrapper for the sleep module backbone.
 *
 * Owns a single SleepRepository instance (shared across all sub-screens so
 * cache reads and syncs are not duplicated).
 *
 * Navigation is callback-based: the four module screens call onOpen* props;
 * this wrapper manages which view is active via local state.
 *
 * Views:
 *   overview   → SleepOverviewScreen  (entry point)
 *   detail     → SleepDetailScreen
 *   manual     → SleepManualEntryScreen
 *   permission → SleepPermissionScreen
 *
 * AppContext is tapped only for userId, mealDate, and loadSleepDaily.
 * loadSleepDaily keeps the HomeScreen metric pill in sync.
 * The module backbone manages its own local data via SleepRepository.
 */

import React, { useCallback, useRef, useState } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useApp } from "../context/AppContext";
import { trackEvent } from "../utils/analytics";
import { useLanguage } from "../i18n";
import { createSleepRepository } from "../modules/sleep/domain/repository/SleepRepository";
import { SleepOverviewScreen } from "../modules/sleep/presentation/screens/SleepOverviewScreen";
import { SleepDetailScreen } from "../modules/sleep/presentation/screens/SleepDetailScreen";
import { SleepManualEntryScreen } from "../modules/sleep/presentation/screens/SleepManualEntryScreen";
import { SleepPermissionScreen } from "../modules/sleep/presentation/screens/SleepPermissionScreen";

// ── View state constants ───────────────────────────────────────────────────────

const VIEW = {
  OVERVIEW:   "overview",
  DETAIL:     "detail",
  MANUAL:     "manual",
  PERMISSION: "permission",
};

// ── Screen ────────────────────────────────────────────────────────────────────

export default function SleepScreen() {
  const { userId, mealDate, loadSleepDaily } = useApp();
  const { t } = useLanguage();

  const VIEW_TITLES = {
    [VIEW.OVERVIEW]:   t("nav.sleep"),
    [VIEW.DETAIL]:     t("sleep.viewTitles.detail"),
    [VIEW.MANUAL]:     t("sleep.viewTitles.manual"),
    [VIEW.PERMISSION]: t("sleep.viewTitles.permission"),
  };

  // Single repository instance — never recreated on re-render.
  const repositoryRef = useRef(createSleepRepository());
  const repo = repositoryRef.current;

  const [view, setView] = useState(VIEW.OVERVIEW);
  // Seed result from saveManualEntry so the overview shows data immediately on
  // remount without waiting for getOverview / syncRecentSleep to complete.
  const [seedResult, setSeedResult] = useState(null);

  useFocusEffect(
    useCallback(() => {
      trackEvent("sleep_opened");
      // Keep AppContext sleepData fresh for HomeScreen metric pill.
      if (userId) loadSleepDaily(userId, mealDate);
    }, [mealDate])
  );

  // On manual save: call getOverview so the overview reflects the persisted
  // summary (not just the in-memory save result).  Seed with the fresh result
  // so the overview renders immediately without a loading spinner.
  async function handleManualSaved(result) {
    try {
      const freshOverview = await repo.getOverview(mealDate);
      setSeedResult(freshOverview ?? result ?? null);
    } catch (e) {
      console.warn("[SleepScreen handleManualSaved] getOverview failed, falling back to save result", e);
      setSeedResult(result ?? null);
    }
    setView(VIEW.OVERVIEW);
  }

  // On permission resolved (granted): return to overview so a fresh sync fires.
  function handlePermissionResolved() {
    setView(VIEW.OVERVIEW);
  }

  const isOverview = view === VIEW.OVERVIEW;

  return (
    <SafeAreaView style={styles.safe}>

      {/* ── Sub-screen header with back navigation ──────────────── */}
      {!isOverview && (
        <View style={styles.header}>
          <Pressable
            onPress={() => setView(VIEW.OVERVIEW)}
            style={styles.backButton}
            hitSlop={12}
          >
            <Text style={styles.backText}>{t("sleep.back")}</Text>
          </Pressable>
          <Text style={styles.headerTitle}>{VIEW_TITLES[view]}</Text>
          {/* Spacer keeps title visually centred */}
          <View style={styles.headerSpacer} />
        </View>
      )}

      {/* ── View routing ────────────────────────────────────────── */}

      {view === VIEW.OVERVIEW && (
        <SleepOverviewScreen
          repository={repo}
          userId={userId}
          sleepDay={mealDate}
          seedResult={seedResult}
          onOpenDetails={() => setView(VIEW.DETAIL)}
          onOpenManualEntry={() => setView(VIEW.MANUAL)}
          onOpenPermission={() => setView(VIEW.PERMISSION)}
        />
      )}

      {view === VIEW.DETAIL && (
        <SleepDetailScreen
          repository={repo}
          userId={userId}
          sleepDay={mealDate}
        />
      )}

      {view === VIEW.MANUAL && (
        <SleepManualEntryScreen
          repository={repo}
          userId={userId}
          onSaved={handleManualSaved}
        />
      )}

      {/* SleepPermissionScreen renders as a bare card — wrap in a scroll
          container so it is reachable on small screens. */}
      {view === VIEW.PERMISSION && (
        <ScrollView
          style={styles.permissionScroll}
          contentContainerStyle={styles.permissionContent}
        >
          <SleepPermissionScreen
            repository={repo}
            onResolved={handlePermissionResolved}
          />
        </ScrollView>
      )}

    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef4e8",
  },

  // ── Sub-screen header ────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2ede5",
    backgroundColor: "#eef4e8",
  },
  backButton: {
    minWidth: 60,
  },
  backText: {
    color: "#295c41",
    fontSize: 15,
    fontWeight: "700",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: 0.2,
  },
  headerSpacer: {
    minWidth: 60,
  },

  // ── Permission screen wrapper ────────────────────────────────────────────────
  permissionScroll: {
    flex: 1,
  },
  permissionContent: {
    padding: 16,
  },
});
