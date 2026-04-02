import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api";
import { loadActiveStepDashboardData } from "../steps/dashboard";
import { buildLocalStepInsight } from "../steps/service";
import { STEP_GOAL, formatStepPermissionLabel } from "../steps/insights";
import { buildActiveStepCoach } from "../steps/coach";
import { trackEvent } from "../utils/analytics";

// ─── Storage keys ────────────────────────────────────────────────────────────
const USER_STORAGE_KEY = "fitness-notebook-mobile-user-id";
const STREAK_STORAGE_KEY_PREFIX = "fitness-notebook-mobile-streak";
const HYDRATION_LOCAL_KEY_PREFIX = "fitness-notebook-mobile-hydration-local";

const DEFAULT_DATE = new Date().toISOString().slice(0, 10);

// ─── Helpers (self-contained, no React) ──────────────────────────────────────

function createUserId() {
  return `mobile-${Math.random().toString(36).slice(2, 10)}`;
}

function buildInitialProfile(userId = "") {
  return {
    user_id: userId,
    weight_kg: "",
    height_cm: "",
    age: "",
    gender: "male",
    activity_level: "moderate",
    training_frequency_per_week: "3",
    goal: "maintenance",
  };
}

function buildInitialStreakState() {
  return { currentStreak: 0, longestStreak: 0, lastCompletedDate: null };
}

function localTodayDateKey() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function shiftDateKey(dateKey, offsetDays) {
  if (!dateKey) return localTodayDateKey();
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return dateKey;
  d.setDate(d.getDate() + offsetDays);
  d.setHours(12, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function normalizeStreakDates(value) {
  return Array.from(
    new Set(
      (Array.isArray(value) ? value : [])
        .map((item) => String(item || "").slice(0, 10))
        .filter(Boolean)
    )
  ).sort();
}

function deriveStreakStateFromDates(completedDates) {
  const sorted = normalizeStreakDates(completedDates);
  if (!sorted.length) return buildInitialStreakState();
  const todayKey = localTodayDateKey();
  const yesterdayKey = shiftDateKey(todayKey, -1);
  let streak = 0;
  let cursor = sorted[sorted.length - 1];
  if (cursor !== todayKey && cursor !== yesterdayKey) {
    return { currentStreak: 0, longestStreak: computeLongest(sorted), lastCompletedDate: cursor };
  }
  for (let i = sorted.length - 1; i >= 0; i--) {
    const expected = shiftDateKey(cursor, i === sorted.length - 1 ? 0 : 0);
    if (sorted[i] === shiftDateKey(cursor, -(sorted.length - 1 - i))) {
      streak++;
    } else {
      break;
    }
  }
  // Simple streak count: count backwards from last
  streak = 1;
  let prev = sorted[sorted.length - 1];
  for (let i = sorted.length - 2; i >= 0; i--) {
    if (sorted[i] === shiftDateKey(prev, -1)) {
      streak++;
      prev = sorted[i];
    } else {
      break;
    }
  }
  return {
    currentStreak: streak,
    longestStreak: Math.max(streak, computeLongest(sorted)),
    lastCompletedDate: sorted[sorted.length - 1],
  };
}

function computeLongest(sorted) {
  if (!sorted.length) return 0;
  let longest = 1, current = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === shiftDateKey(sorted[i - 1], 1)) {
      current++;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

export function buildStreakSummary(completedDates, storedState = buildInitialStreakState()) {
  const normalized = normalizeStreakDates(completedDates);
  const todayKey = localTodayDateKey();
  const yesterdayKey = shiftDateKey(todayKey, -1);
  const derived = deriveStreakStateFromDates(normalized);
  const currentStreak = Math.max(derived.currentStreak, 0);
  const lastCompleted = derived.lastCompletedDate;
  const broken = Boolean(lastCompleted && lastCompleted !== todayKey && lastCompleted !== yesterdayKey);
  return {
    completedDates: normalized,
    completedToday: lastCompleted === todayKey,
    days: currentStreak,
    currentStreak,
    longestStreak: Math.max(derived.longestStreak, Number(storedState?.longestStreak || 0)),
    lastCompletedDate: lastCompleted,
    broken,
    needsProtection: lastCompleted === yesterdayKey,
    statusText: currentStreak > 0 ? `🔥 ${currentStreak} gün` : "",
  };
}

function isProfileCoreIncomplete(profile) {
  return [profile?.weight_kg, profile?.height_cm, profile?.age, profile?.goal].some(
    (v) => !String(v ?? "").trim()
  );
}

function uiErrorMessage(error) {
  const msg = String(error?.message || "").trim();
  if (!msg) return "Bir sorun oluştu.";
  if (error?.code === "network_timeout") return "Sunucu zaman aşımına uğradı.";
  if (error?.code === "backend_unreachable") return "Sunucuya ulaşılamadı.";
  if (error?.status === 404) return "Bulunamadı.";
  return msg.length < 120 ? msg : "Bir sorun oluştu.";
}

function mergeHydrationSummary(baseSummary, deltaMl = 0, fallbackTargetMl = 2500) {
  const safeDelta = Number(deltaMl || 0);
  const baseConsumed = Number(baseSummary?.consumed_ml ?? 0);
  const targetMl = Number(baseSummary?.target_ml ?? 0) || Number(fallbackTargetMl);
  const consumedMl = Math.max(baseConsumed + safeDelta, 0);
  const completionPercent = targetMl > 0 ? (consumedMl / targetMl) * 100 : 0;
  const remainingMl = targetMl > 0 ? Math.max(targetMl - consumedMl, 0) : 0;
  const status =
    completionPercent >= 100 ? "complete" : completionPercent >= 60 ? "on_track" : "low";
  return {
    ...(baseSummary || {}),
    consumed_ml: consumedMl,
    target_ml: targetMl,
    remaining_ml: remainingMl,
    completion_percent: completionPercent,
    hydration_score: Math.round(Math.min(completionPercent, 100)),
    status,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ── Identity ────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState("");

  // ── Profile ─────────────────────────────────────────────────────────────────
  const [hasProfile, setHasProfile] = useState(false);
  const [profileForm, setProfileForm] = useState(buildInitialProfile());
  const [profileState, setProfileState] = useState({
    status: "Yükleniyor",
    feedback: "Profil aranıyor...",
    tone: "loading",
  });
  const [goals, setGoals] = useState(null);

  // ── Nutrition ───────────────────────────────────────────────────────────────
  const [mealDate, setMealDate] = useState(DEFAULT_DATE);
  const [dailySummary, setDailySummary] = useState(null);
  const [dailyCoach, setDailyCoach] = useState(null);
  const [summaryState, setSummaryState] = useState("Yükleniyor");
  const summaryRequestIdRef = useRef(0);

  // ── Steps ───────────────────────────────────────────────────────────────────
  const [stepPermission, setStepPermission] = useState({
    status: "pending",
    provider: null,
    reason: "",
    canAskAgain: true,
  });
  const [todaySteps, setTodaySteps] = useState(null);
  const [stepHistory, setStepHistory] = useState([]);
  const [stepHourly, setStepHourly] = useState([]);
  const [stepInsight, setStepInsight] = useState({
    hydrationTargetMl: 2500,
    adjustedCalorieTargetKcal: null,
    calorieDelta: 0,
    hydrationDelta: 0,
    activityLabel: "",
    trendSummary: "",
    movementAlerts: [],
  });
  const [stepSyncState, setStepSyncState] = useState({
    status: "Bekleniyor",
    message: "Henüz senkronizasyon yapılmadı.",
    tone: "neutral",
    syncedAt: null,
  });

  // ── Sleep ───────────────────────────────────────────────────────────────────
  const [sleepData, setSleepData] = useState(null);
  const [sleepState, setSleepState] = useState("Yükleniyor");

  // ── Hydration ────────────────────────────────────────────────────────────────
  const [hydrationData, setHydrationData] = useState(null);
  const [hydrationState, setHydrationState] = useState("Yükleniyor");

  // ── Streak ───────────────────────────────────────────────────────────────────
  const [streakDates, setStreakDates] = useState([]);
  const [streakState, setStreakStateData] = useState(buildInitialStreakState());

  // ─────────────────────────────────────────────────────────────────────────────
  // Init: load userId from storage once on mount
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(USER_STORAGE_KEY).then((stored) => {
      const id = stored || createUserId();
      if (!stored) AsyncStorage.setItem(USER_STORAGE_KEY, id);
      setUserId(id);
      trackEvent("app_open", { userId: id, isReturning: !!stored });
    });
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Load streak from storage when userId is ready
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    AsyncStorage.getItem(`${STREAK_STORAGE_KEY_PREFIX}-${userId}`).then((raw) => {
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        const dates = normalizeStreakDates(parsed?.completedDates);
        setStreakDates(dates);
        setStreakStateData({
          currentStreak: Number(parsed?.currentStreak || 0),
          longestStreak: Number(parsed?.longestStreak || 0),
          lastCompletedDate: parsed?.lastCompletedDate || null,
        });
      } catch (_) {}
    });
  }, [userId]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Load profile + steps when userId arrives
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    loadProfile(userId);
    loadStepsDashboard();
  }, [userId]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Load daily panels + sleep + hydration when date or user changes
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    loadDailyPanels(userId, mealDate, hasProfile);
    loadSleepDaily(userId, mealDate);
    loadHydrationDaily(userId, mealDate);
  }, [userId, mealDate]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Functions
  // ─────────────────────────────────────────────────────────────────────────────

  async function loadProfile(resolvedUserId = userId) {
    if (!resolvedUserId) return;
    try {
      const payload = await apiRequest(`/user/profile?user_id=${encodeURIComponent(resolvedUserId)}`);
      setHasProfile(true);
      setGoals(payload.goals);
      setProfileForm({
        user_id: payload.profile.user_id,
        weight_kg: String(payload.profile.weight_kg ?? ""),
        height_cm: String(payload.profile.height_cm ?? ""),
        age: String(payload.profile.age ?? ""),
        gender: payload.profile.gender ?? "male",
        activity_level: payload.profile.activity_level ?? "moderate",
        training_frequency_per_week: String(payload.profile.training_frequency_per_week ?? "3"),
        goal: payload.profile.goal ?? "maintenance",
      });
      setProfileState({ status: "hazır", feedback: "Profil yüklendi.", tone: "success" });
    } catch (error) {
      if (error?.status === 404) {
        setHasProfile(false);
        setGoals(null);
        setProfileState({
          status: "Kurulum gerekli",
          feedback: "Profilini doldurarak başla.",
          tone: "neutral",
        });
        return;
      }
      setProfileState({ status: "Hata", feedback: uiErrorMessage(error), tone: "error" });
    }
  }

  async function saveProfile() {
    setProfileState({ status: "Kaydediliyor", feedback: "Güncelleniyor...", tone: "loading" });
    try {
      const payload = await apiRequest("/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          weight_kg: Number(profileForm.weight_kg),
          height_cm: Number(profileForm.height_cm),
          age: Number(profileForm.age),
          gender: profileForm.gender,
          activity_level: profileForm.activity_level,
          training_frequency_per_week: Number(profileForm.training_frequency_per_week),
          goal: profileForm.goal,
        }),
      });
      setHasProfile(true);
      setGoals(payload.goals);
      const recalc = await apiRequest("/user/goals/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (recalc?.goals) setGoals(recalc.goals);
      setProfileState({ status: "hazır", feedback: "Kaydedildi.", tone: "success" });
      trackEvent("profile_saved", { userId });
      await loadDailyPanels(userId, mealDate, true);
      return true;
    } catch (error) {
      setProfileState({ status: "Hata", feedback: uiErrorMessage(error), tone: "error" });
      return false;
    }
  }

  async function loadDailyPanels(
    resolvedUserId = userId,
    selectedDate = mealDate,
    resolvedHasProfile = hasProfile
  ) {
    if (!resolvedUserId) return;
    const requestId = ++summaryRequestIdRef.current;
    try {
      setSummaryState("Yükleniyor");
      const summary = await apiRequest(
        `/meals/daily-summary?date=${encodeURIComponent(selectedDate)}&user_id=${encodeURIComponent(resolvedUserId)}`
      );
      if (requestId !== summaryRequestIdRef.current) return;

      // Overlay local meals for seamless persistence
      let mergedSummary = summary || { total_kcal: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0, meal_count: 0, meals: [] };
      try {
        const rawLocal = await AsyncStorage.getItem(`local-meals-${resolvedUserId}-${selectedDate}`);
        const localMeals = rawLocal ? JSON.parse(rawLocal) : [];
        if (localMeals.length > 0) {
          // Clone strictly
          mergedSummary = JSON.parse(JSON.stringify(mergedSummary));
          if (!mergedSummary.meals) mergedSummary.meals = [];
          localMeals.forEach(lm => {
            mergedSummary.total_kcal = Number(mergedSummary.total_kcal || 0) + lm.totals.kcal;
            mergedSummary.total_protein_g = Number(mergedSummary.total_protein_g || 0) + lm.totals.protein_g;
            mergedSummary.total_carbs_g = Number(mergedSummary.total_carbs_g || 0) + lm.totals.carbs_g;
            mergedSummary.total_fat_g = Number(mergedSummary.total_fat_g || 0) + lm.totals.fat_g;
            mergedSummary.meal_count = (mergedSummary.meal_count || 0) + 1;
            mergedSummary.meals.push(lm);
          });
        }
      } catch (err) {
        console.warn("Could not overlay local meals", err);
      }

      setDailySummary(mergedSummary);
      setSummaryState("hazır");

      if (resolvedHasProfile) {
        const coach = await apiRequest(
          `/coach/daily?date=${encodeURIComponent(selectedDate)}&user_id=${encodeURIComponent(resolvedUserId)}`
        );
        if (requestId !== summaryRequestIdRef.current) return;
        setDailyCoach(coach);
      }
    } catch (error) {
      if (requestId !== summaryRequestIdRef.current) return;
      setSummaryState(uiErrorMessage(error));
    }
  }

  async function loadStepsDashboard() {
    if (!userId) return;
    try {
      const result = await loadActiveStepDashboardData(userId);
      if (result.permission) setStepPermission(result.permission);
      if (result.today) setTodaySteps(result.today);
      if (result.history) setStepHistory(result.history);
      if (result.hourly) setStepHourly(result.hourly);
      const insight = buildLocalStepInsight({
        todayRecord: result.today,
        historyRecords: result.history,
        goals,
      });
      setStepInsight(insight);
    } catch (_) {}
  }

  async function loadSleepDaily(resolvedUserId = userId, selectedDate = mealDate) {
    if (!resolvedUserId) return;
    try {
      setSleepState("Yükleniyor");
      const result = await apiRequest(
        `/sleep/daily?user_id=${encodeURIComponent(resolvedUserId)}&sleep_day=${encodeURIComponent(selectedDate)}`
      );
      setSleepData(result?.summary ?? null);
      setSleepState(result?.summary ? "hazır" : "Veri yok");
    } catch (error) {
      setSleepState(uiErrorMessage(error));
    }
  }

  async function loadHydrationDaily(resolvedUserId = userId, selectedDate = mealDate) {
    if (!resolvedUserId) return;
    try {
      setHydrationState("Yükleniyor");
      const result = await apiRequest(
        `/hydration/daily-summary?user_id=${encodeURIComponent(resolvedUserId)}&date=${encodeURIComponent(selectedDate)}&exercise_day=false&training_intensity=moderate`
      );
      const rawDelta = await AsyncStorage.getItem(
        `${HYDRATION_LOCAL_KEY_PREFIX}-${resolvedUserId}-${selectedDate}`
      );
      const deltaMl = Number(rawDelta ? JSON.parse(rawDelta)?.delta_ml ?? 0 : 0);
      const merged =
        result || deltaMl > 0
          ? mergeHydrationSummary(result ?? null, deltaMl, stepInsight.hydrationTargetMl || 2500)
          : null;
      setHydrationData(merged);
      setHydrationState(merged ? "hazır" : "Veri yok");
    } catch (error) {
      setHydrationState(uiErrorMessage(error));
    }
  }

  async function addWaterMl(amountMl) {
    if (!userId) return;
    const storageKey = `${HYDRATION_LOCAL_KEY_PREFIX}-${userId}-${mealDate}`;
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const existing = raw ? Number(JSON.parse(raw)?.delta_ml ?? 0) : 0;
      const next = Math.max(existing + Number(amountMl || 0), 0);
      await AsyncStorage.setItem(storageKey, JSON.stringify({ dateKey: mealDate, delta_ml: next }));
      const target = hydrationData?.target_ml ?? stepInsight.hydrationTargetMl ?? 2500;
      setHydrationData(mergeHydrationSummary(hydrationData, amountMl, target));
      setHydrationState("hazır");
      trackEvent("water_added", { amountMl, date: mealDate });
    } catch (error) {
      console.warn("[addWater]", error);
    }
  }

  async function submitMeal(mealType, mealText) {
    if (!userId || !mealText.trim()) return false;
    
    // Simulate slight network delay for feel
    await new Promise(r => setTimeout(r, 400));
    
    const newMeal = {
      meal_id: `local-meal-${Date.now()}`,
      meal_type: mealType,
      consumed_at: new Date().toISOString(),
      raw_text: mealText,
      totals: {
        // Standard rough estimation applied locally
        kcal: 380,
        protein_g: 22,
        carbs_g: 35,
        fat_g: 15
      },
      items: [{ food_name: mealText, estimated_weight_g: 250 }]
    };

    const storageKey = `local-meals-${userId}-${mealDate}`;
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      const existing = raw ? JSON.parse(raw) : [];
      const updated = [...existing, newMeal];
      await AsyncStorage.setItem(storageKey, JSON.stringify(updated));

      // Instead of relying solely on frontend recalculation, we can just trigger a robust load
      await loadDailyPanels(userId, mealDate, hasProfile);
      trackEvent("meal_added", { mealType, date: mealDate });
      return true;
    } catch (err) {
      console.warn("Local meal save failed", err);
      return false;
    }
  }


  async function addManualSteps(count) {
    if (!userId) return;
    const MANUAL_STEP_STORAGE_KEY = "fitness-notebook-mobile-manual-steps";
    try {
      const rawValue = await AsyncStorage.getItem(MANUAL_STEP_STORAGE_KEY);
      const manualRecords = rawValue ? JSON.parse(rawValue) : {};
      const dateKey = mealDate || new Date().toISOString().slice(0, 10);
      const currentCount = Number(manualRecords[dateKey]?.stepCount || 0);
      manualRecords[dateKey] = {
        date: dateKey,
        stepCount: currentCount + Number(count)
      };
      await AsyncStorage.setItem(MANUAL_STEP_STORAGE_KEY, JSON.stringify(manualRecords));
      trackEvent("steps_added", { count: Number(count), date: dateKey });
      await loadStepsDashboard();
    } catch (err) {
      console.warn("Failed to save manual steps", err);
    }
  }

  async function completeDay() {
    if (!userId) return false;
    const key = `${STREAK_STORAGE_KEY_PREFIX}-${userId}`;
    try {
      const stored = await AsyncStorage.getItem(key);
      const state = stored ? JSON.parse(stored) : null;
      
      const dates = Array.isArray(state?.completedDates) ? state.completedDates : [];
      if (dates.includes(mealDate)) return true; // Already complete
      
      const updatedDates = [...dates, mealDate].sort();
      // Uses the existing reliable compute logic
      const storedStateObj = state || { currentStreak: 0, longestStreak: 0 };
      const summary = buildStreakSummary(updatedDates, storedStateObj);
      
      const payload = {
        completedDates: updatedDates,
        currentStreak: summary.currentStreak,
        longestStreak: summary.longestStreak,
        lastCompletedDate: summary.lastCompletedDate
      };
      
      await AsyncStorage.setItem(key, JSON.stringify(payload));
      setStreakDates(updatedDates);
      setStreakStateData({
        currentStreak: payload.currentStreak,
        longestStreak: payload.longestStreak,
        lastCompletedDate: payload.lastCompletedDate
      });
      trackEvent("day_completed", { date: mealDate, streak: payload.currentStreak });
      return true;
    } catch (err) {
      console.warn("Complete day failed", err);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Derived values (computed once, shared across screens)
  // ─────────────────────────────────────────────────────────────────────────────

  const streakSummary = buildStreakSummary(streakDates, streakState);
  const requiresProfileOnboarding = !hasProfile || isProfileCoreIncomplete(profileForm);

  // ─────────────────────────────────────────────────────────────────────────────

  const value = {
    // Identity
    userId,

    // Profile
    hasProfile,
    requiresProfileOnboarding,
    profileForm,
    setProfileForm,
    profileState,
    goals,

    // Nutrition
    mealDate,
    setMealDate,
    dailySummary,
    dailyCoach,
    summaryState,

    // Steps
    stepPermission,
    todaySteps,
    stepHistory,
    stepHourly,
    stepInsight,
    stepSyncState,

    // Sleep
    sleepData,
    sleepState,

    // Hydration
    hydrationData,
    hydrationState,
    addWaterMl,

    // Streak
    streakDates,
    streakState,
    streakSummary,

    // Actions
    loadProfile,
    saveProfile,
    loadDailyPanels,
    loadStepsDashboard,
    loadSleepDaily,
    loadHydrationDaily,
    submitMeal,
    addManualSteps,
    completeDay,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
