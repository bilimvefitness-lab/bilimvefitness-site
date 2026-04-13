import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { API_BASE_URL, API_BASE_SOURCE, IS_PHYSICAL_DEVICE_MISSING_CONFIG, apiRequest, buildApiUrl } from "../api";
import { loadActiveStepDashboardData } from "../steps/dashboard";
import { buildLocalStepInsight } from "../steps/service";
import { STEP_GOAL, formatStepPermissionLabel } from "../steps/insights";
import { buildActiveStepCoach } from "../steps/coach";
import { trackEvent } from "../utils/analytics";
import { calculateGoalsLocally } from "../utils/goalEngine";

// ─── Storage keys ────────────────────────────────────────────────────────────
const USER_STORAGE_KEY = "fitness-notebook-mobile-user-id";
const STREAK_STORAGE_KEY_PREFIX = "fitness-notebook-mobile-streak";
const HYDRATION_LOCAL_KEY_PREFIX = "fitness-notebook-mobile-hydration-local";
const PUBLIC_USER_ID_KEY  = "fitness-notebook-mobile-public-user-id";
const DEVICE_TOKEN_KEY    = "fitness-notebook-mobile-device-token";
const PHOTO_URI_KEY       = "fitness-notebook-mobile-photo-uri";

// LOCAL date — "today" is always a local-time concept.
// toISOString() gives UTC which can be ±1 day vs. the user's clock.
const DEFAULT_DATE = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

// ─── Helpers (self-contained, no React) ──────────────────────────────────────

/**
 * Normalizes the goals object returned by the backend into the flat shape
 * that all consumers (ProfileScreen, NutritionScreen, Dashboard) expect.
 *
 * Backend shape (GoalCalculation):
 *   { calorie_target_kcal, protein: { grams, ... }, fat: { grams, ... }, carbs_g, ... }
 *
 * Flat consumer shape:
 *   { calorie_target_kcal, protein_target_g, fat_target_g, carbs_target_g, ... }
 *
 * Called at every setGoals() site — single transformation point.
 */
function normalizeGoals(raw) {
  if (!raw) return null;
  return {
    calorie_target_kcal: raw.calorie_target_kcal             ?? null,
    protein_target_g:    raw.protein?.grams ?? raw.protein_target_g ?? null,
    fat_target_g:        raw.fat?.grams     ?? raw.fat_target_g     ?? null,
    carbs_target_g:      raw.carbs_g        ?? raw.carbs_target_g   ?? null,
    tdee_kcal:           raw.tdee_kcal                       ?? null,
    bmr_kcal:            raw.bmr_kcal                        ?? null,
    water_target_ml:     raw.water_target_ml                 ?? null,
  };
}

function createUserId() {
  return `mobile-${Math.random().toString(36).slice(2, 10)}`;
}

function buildInitialProfile(userId = "") {
  return {
    user_id: userId,
    name: "",
    weight_kg: "",
    height_cm: "",
    age: "",
    gender: "male",
    activity_level: "moderate",
    training_frequency_per_week: "3",
    goal: "maintenance",
    optimization_mode: "balanced",
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

  return {
    ...(baseSummary || {}),
    consumed_ml: consumedMl,
    target_ml: targetMl,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // ── Identity ────────────────────────────────────────────────────────────────
  const [userId, setUserId] = useState("");
  const [publicUserId, setPublicUserId] = useState(null);
  const [deviceToken, setDeviceToken] = useState(null);
  const [photoUri, setPhotoUriState] = useState(null);
  // Ref keeps deviceToken readable inside async closures without stale-capture
  const deviceTokenRef = useRef(null);

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
  // Warn once on startup when running on a physical device without EXPO_PUBLIC_API_BASE_URL.
  // Covers both iOS (localhost fallback) and Android (10.0.2.2 fallback) via expo-device.
  useEffect(() => {
    if (IS_PHYSICAL_DEVICE_MISSING_CONFIG) {
      Alert.alert(
        "Bağlantı Uyarısı",
        "Fiziksel cihazda varsayılan API adresi kullanılamaz.\n\n" +
        "EXPO_PUBLIC_API_BASE_URL ortam değişkenini bilgisayarının LAN IP adresine ayarla:\n" +
        "http://192.168.1.X:8001/api/v1",
        [{ text: "Tamam" }]
      );
    }
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(USER_STORAGE_KEY).then((stored) => {
      const id = stored || createUserId();
      if (!stored) AsyncStorage.setItem(USER_STORAGE_KEY, id);
      setUserId(id);
      trackEvent("app_open", { userId: id, isReturning: !!stored });
    });
    // Load cached public user ID immediately — this ensures the AG-XXXXXX ID is
    // visible on ProfileScreen as soon as the app opens, without waiting for userId
    // to resolve from storage first (which is a separate async read).
    AsyncStorage.getItem(PUBLIC_USER_ID_KEY).then((id) => {
      if (id) setPublicUserId(id);
    });
    // Load cached photo URI
    AsyncStorage.getItem(PHOTO_URI_KEY).then((uri) => {
      if (uri) setPhotoUriState(uri);
    });
    // Load cached device token into both state and ref
    AsyncStorage.getItem(DEVICE_TOKEN_KEY).then((tok) => {
      if (tok) { setDeviceToken(tok); deviceTokenRef.current = tok; }
    });
    // IS_PHYSICAL_DEVICE_MISSING_CONFIG now covers both iOS and Android physical
    // devices via expo-device (Device.isDevice). No separate Android fallback needed.
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
      } catch (e) { console.warn("[streak restore]", e); }
    });
  }, [userId]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Load profile + steps when userId arrives
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return;
    loadProfile(userId);
    loadStepsDashboard();
    // Bootstrap identity from backend — always overwrites cached values so backend
    // is the single source of truth. Cache is used only for the instant first render
    // (loaded in the mount useEffect above); here we replace it with the authoritative
    // backend response regardless of whether the values match or have changed.
    (async () => {
      try {
        const res = await apiRequest("/friends/public-id", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: userId, display_name: "" }),
        });
        // Overwrite both ID and token atomically — the backend always returns both
        // together. Separating them would risk a window where a new token references
        // an old ID (or vice versa) if a backend data reset occurred.
        const newId    = res?.public_user_id;
        const newToken = res?.device_token;
        if (newId) {
          setPublicUserId(newId);                          // overwrite regardless of prior value
          AsyncStorage.setItem(PUBLIC_USER_ID_KEY, newId);
        }
        if (newToken) {
          setDeviceToken(newToken);
          deviceTokenRef.current = newToken;
          AsyncStorage.setItem(DEVICE_TOKEN_KEY, newToken);
        }
        // If backend has a photo, prefer the versioned remote URL (cross-device sync)
        if (res?.has_photo) {
          const version = res?.photo_version || 0;
          const remoteUrl = buildApiUrl(`/friends/photo/${encodeURIComponent(userId)}?v=${version}`);
          setPhotoUriState(remoteUrl);
          AsyncStorage.setItem(PHOTO_URI_KEY, remoteUrl);
        }
      } catch (_) { /* backend offline — cache values loaded in mount useEffect remain */ }
    })();
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
      
      // If backend returns goals, use them. Otherwise, we might need a recalculate check.
      if (payload.goals) {
        setGoals(normalizeGoals(payload.goals));
      } else if (payload.profile) {
        // Soft trigger recalculate if profile exists but goals are missing
        const recalc = await apiRequest("/user/goals/recalculate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: resolvedUserId }),
        }).catch(() => null);
        if (recalc?.goals) setGoals(normalizeGoals(recalc.goals));
      }

      setProfileForm({
        user_id: payload.profile.user_id,
        name: payload.profile.name ?? "",
        weight_kg: String(payload.profile.weight_kg ?? ""),
        height_cm: String(payload.profile.height_cm ?? ""),
        age: String(payload.profile.age ?? ""),
        gender: payload.profile.gender ?? "male",
        activity_level: payload.profile.activity_level ?? "moderate",
        training_frequency_per_week: String(payload.profile.training_frequency_per_week ?? "3"),
        goal: payload.profile.goal ?? "maintenance",
        optimization_mode: payload.profile.optimization_mode ?? "balanced",
      });
      setProfileState({ status: "hazır", feedback: "Profil yüklendi.", tone: "success" });
    } catch (error) {
      if (error?.status === 404) {
        // Backend says no profile exists — check local fallback
        const localRaw = await AsyncStorage.getItem(`fitness-notebook-mobile-profile-${resolvedUserId}`).catch(() => null);
        if (localRaw) {
          const local = JSON.parse(localRaw);
          setHasProfile(true);
          setProfileForm({
            user_id: local.user_id,
            name: local.name ?? "",
            weight_kg: String(local.weight_kg ?? ""),
            height_cm: String(local.height_cm ?? ""),
            age: String(local.age ?? ""),
            gender: local.gender ?? "male",
            activity_level: local.activity_level ?? "moderate",
            training_frequency_per_week: String(local.training_frequency_per_week ?? "3"),
            goal: local.goal ?? "maintenance",
            optimization_mode: local.optimization_mode ?? "balanced",
          });
          setProfileState({ status: "hazır", feedback: "Yerel profil yüklendi.", tone: "success" });
          return;
        }
        setHasProfile(false);
        setGoals(null);
        setProfileState({
          status: "Kurulum gerekli",
          feedback: "Profilini doldurarak başla.",
          tone: "neutral",
        });
        return;
      }

      // Network / server error — try local fallback before showing error
      const localRaw = await AsyncStorage.getItem(`fitness-notebook-mobile-profile-${resolvedUserId}`).catch(() => null);
      if (localRaw) {
        try {
          const local = JSON.parse(localRaw);
          setHasProfile(true);
          setProfileForm({
            user_id: local.user_id,
            name: local.name ?? "",
            weight_kg: String(local.weight_kg ?? ""),
            height_cm: String(local.height_cm ?? ""),
            age: String(local.age ?? ""),
            gender: local.gender ?? "male",
            activity_level: local.activity_level ?? "moderate",
            training_frequency_per_week: String(local.training_frequency_per_week ?? "3"),
            goal: local.goal ?? "maintenance",
            optimization_mode: local.optimization_mode ?? "balanced",
          });
          setProfileState({ status: "hazır", feedback: "Yerel profil yüklendi.", tone: "success" });
          return;
        } catch (e) { console.warn("[profile local parse]", e); }
      }
      setProfileState({ status: "Hata", feedback: uiErrorMessage(error), tone: "error" });
    }
  }

  async function saveProfile() {
    setProfileState({ status: "Kaydediliyor", feedback: "Güncelleniyor...", tone: "loading" });

    // 1. Always persist locally first — this is the source of truth for offline-first
    const localProfileData = {
      user_id: userId,
      name: profileForm.name || "",
      weight_kg: Number(profileForm.weight_kg),
      height_cm: Number(profileForm.height_cm),
      age: Number(profileForm.age),
      gender: profileForm.gender,
      activity_level: profileForm.activity_level,
      training_frequency_per_week: Number(profileForm.training_frequency_per_week),
      goal: profileForm.goal,
      optimization_mode: profileForm.optimization_mode || "balanced",
    };

    try {
      await AsyncStorage.setItem(
        `fitness-notebook-mobile-profile-${userId}`,
        JSON.stringify(localProfileData)
      );
    } catch (localErr) {
      console.warn("[saveProfile] local save failed", localErr);
      setProfileState({ status: "Hata", feedback: "Profil kaydedilemedi.", tone: "error" });
      return false;
    }

    // 2. Local save succeeded → update app state immediately
    setHasProfile(true);
    setProfileState({ status: "hazır", feedback: "Kaydedildi.", tone: "success" });
    trackEvent("profile_saved", { userId });

    // 3. Best-effort backend sync — errors are logged, never shown to user
    try {
      const payload = await apiRequest("/user/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(localProfileData),
      });
      if (payload?.goals) setGoals(normalizeGoals(payload.goals));

      const recalc = await apiRequest("/user/goals/recalculate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (recalc?.goals) setGoals(normalizeGoals(recalc.goals));
      await loadDailyPanels(userId, mealDate, true);
    } catch (syncErr) {
      console.warn("[saveProfile] backend sync failed (offline-safe)", syncErr);
    }

    // 4. Sync display name to friend system (best-effort)
    if (publicUserId && profileForm.name) {
      apiRequest("/friends/display-name", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, display_name: profileForm.name }),
      }).catch(() => {});
    }

    return true;
  }

  async function loadDailyPanels(
    resolvedUserId = userId,
    selectedDate = mealDate,
    resolvedHasProfile = hasProfile
  ) {
    if (!resolvedUserId) return;
    const requestId = ++summaryRequestIdRef.current;
    setSummaryState("Yükleniyor");

    // ── Phase 1: backend summary (optional — offline-safe) ───────────────────
    let backendSummary = null;
    try {
      backendSummary = await apiRequest(
        `/meals/daily-summary?date=${encodeURIComponent(selectedDate)}&user_id=${encodeURIComponent(resolvedUserId)}`
      );
    } catch (_) {
      // backend unreachable — we still show local meals below
    }

    if (requestId !== summaryRequestIdRef.current) return;

    // ── Phase 2: merge local meals (always runs) ─────────────────────────────
    let mergedSummary = backendSummary
      || { total_kcal: 0, total_protein_g: 0, total_carbs_g: 0, total_fat_g: 0, meal_count: 0, meals: [] };

    try {
      const rawLocal = await AsyncStorage.getItem(`local-meals-${resolvedUserId}-${selectedDate}`);
      const localMeals = rawLocal ? JSON.parse(rawLocal) : [];
      if (localMeals.length > 0) {
        mergedSummary = JSON.parse(JSON.stringify(mergedSummary));
        if (!mergedSummary.meals) mergedSummary.meals = [];
        localMeals.forEach((lm) => {
          // All local meals have source:"backend" and real totals (submitMeal
          // enforces this). Guard against any stale data from old app versions.
          if (lm.totals != null) {
            mergedSummary.total_kcal      = Number(mergedSummary.total_kcal      || 0) + (lm.totals.kcal      || 0);
            mergedSummary.total_protein_g = Number(mergedSummary.total_protein_g || 0) + (lm.totals.protein_g || 0);
            mergedSummary.total_carbs_g   = Number(mergedSummary.total_carbs_g   || 0) + (lm.totals.carbs_g   || 0);
            mergedSummary.total_fat_g     = Number(mergedSummary.total_fat_g     || 0) + (lm.totals.fat_g     || 0);
          }
          mergedSummary.meal_count = (mergedSummary.meal_count || 0) + 1;
          mergedSummary.meals.push(lm);
        });
      }
    } catch (err) {
      console.warn("[loadDailyPanels] local meal overlay failed", err);
    }

    if (requestId !== summaryRequestIdRef.current) return;
    console.log(`[DAILY_SYNC_DEBUG] Setting dailySummary - kcal: ${mergedSummary.total_kcal}, protein: ${mergedSummary.total_protein_g}, meals: ${mergedSummary.meals?.length}, localMeals merged: ${mergedSummary.meal_count}`);
    setDailySummary(mergedSummary);
    setSummaryState("hazır");

    // ── Phase 3: coach advice (requires backend + profile) ───────────────────
    if (backendSummary && resolvedHasProfile) {
      try {
        const coach = await apiRequest(
          `/coach/daily?date=${encodeURIComponent(selectedDate)}&user_id=${encodeURIComponent(resolvedUserId)}`
        );
        if (requestId === summaryRequestIdRef.current) setDailyCoach(coach);
      } catch (_) {
        // coach is optional — silent fail
      }
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
    } catch (e) { console.warn("[step insight]", e); }
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
          ? mergeHydrationSummary(result ?? null, deltaMl, goals?.water_target_ml || stepInsight.hydrationTargetMl || 2500)
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
      
      // Store as a log entry for history delete support
      const logKey = `${HYDRATION_LOCAL_KEY_PREFIX}-logs-${userId}-${mealDate}`;
      const rawLogs = await AsyncStorage.getItem(logKey);
      const logs = rawLogs ? JSON.parse(rawLogs) : [];
      logs.push({ id: `h-${Date.now()}`, amount_ml: Number(amountMl), at: new Date().toISOString() });
      
      await AsyncStorage.setItem(storageKey, JSON.stringify({ dateKey: mealDate, delta_ml: next }));
      await AsyncStorage.setItem(logKey, JSON.stringify(logs));
      
      const target = hydrationData?.target_ml ?? goals?.water_target_ml ?? stepInsight.hydrationTargetMl ?? 2500;
      setHydrationData(mergeHydrationSummary(hydrationData, amountMl, target));
      setHydrationState("hazır");
      trackEvent("water_added", { amountMl, date: mealDate });
    } catch (error) {
      console.warn("[addWater]", error);
    }
  }

  async function removeWaterMl(logId) {
    if (!userId) return;
    const storageKey = `${HYDRATION_LOCAL_KEY_PREFIX}-${userId}-${mealDate}`;
    const logKey = `${HYDRATION_LOCAL_KEY_PREFIX}-logs-${userId}-${mealDate}`;
    try {
      const rawLogs = await AsyncStorage.getItem(logKey);
      if (!rawLogs) return;
      let logs = JSON.parse(rawLogs);
      const index = logs.findIndex(l => l.id === logId);
      if (index === -1) return;
      
      const removedAmount = logs[index].amount_ml;
      logs.splice(index, 1);
      
      const rawDelta = await AsyncStorage.getItem(storageKey);
      const existingDelta = rawDelta ? Number(JSON.parse(rawDelta)?.delta_ml ?? 0) : 0;
      const nextDelta = Math.max(existingDelta - removedAmount, 0);
      
      await AsyncStorage.setItem(storageKey, JSON.stringify({ dateKey: mealDate, delta_ml: nextDelta }));
      await AsyncStorage.setItem(logKey, JSON.stringify(logs));
      
      await loadHydrationDaily(userId, mealDate);
      trackEvent("water_removed", { amountMl: removedAmount, date: mealDate });
    } catch (error) {
      console.warn("[removeWater]", error);
    }
  }

  async function submitMeal(mealType, mealText, previewData) {
    if (!userId || !mealText.trim()) {
      throw new Error("Kullanıcı kimliği veya öğün metni eksik.");
    }

    if (!previewData) {
      throw new Error("Önizleme verisi eksik.");
    }

    if (previewData.needsClarification) {
      throw new Error("Lütfen tüm belirsiz öğeleri netleştirin.");
    }

    if (!previewData.items || previewData.items.length === 0) {
      throw new Error("Kaydedilecek geçerli bir öğün öğesi bulunamadı.");
    }

    if (!previewData.totals) {
      throw new Error("Öğün toplamları hesaplanamadı. Lütfen tekrar deneyin.");
    }

    // Persist verified meal locally
    const newMeal = {
      meal_id:      `local-meal-${Date.now()}`,
      meal_type:    mealType,
      consumed_at:  new Date().toISOString(),
      raw_text:     mealText,
      totals:       previewData.totals,
      items: previewData.items.map((item) => ({
        food_name:          item.canonical_display_name || item.food_name || mealText,
        estimated_weight_g: item.estimated_weight_g || 0,
        nutrition:          item.nutrition || null,
      })),
      source: "backend",
    };

    const storageKey = `local-meals-${userId}-${mealDate}`;
    try {
      const raw      = await AsyncStorage.getItem(storageKey);
      const existing = raw ? JSON.parse(raw) : [];
      await AsyncStorage.setItem(storageKey, JSON.stringify([...existing, newMeal]));
      await loadDailyPanels(userId, mealDate, hasProfile);
      trackEvent("meal_added", { mealType, date: mealDate, source: "backend", itemCount: previewData.items.length });
      return true;
    } catch (err) {
      throw err;
    }
  }

  async function deleteMeal(mealId) {
    if (!userId || !mealId) return false;
    const storageKey = `local-meals-${userId}-${mealDate}`;
    try {
      // 1. Remove from local storage
      const raw = await AsyncStorage.getItem(storageKey);
      if (raw) {
        const existing = JSON.parse(raw);
        const updated = existing.filter((m) => m.meal_id !== mealId);
        await AsyncStorage.setItem(storageKey, JSON.stringify(updated));
      }

      // 2. Best-effort backend deletion if meal was from backend
      if (!mealId.startsWith("local-meal-")) {
        try {
          await apiRequest(`/meals/delete?meal_id=${encodeURIComponent(mealId)}&user_id=${encodeURIComponent(userId)}`, {
            method: "DELETE",
          });
        } catch (_) {
          // Silent fail — it stays deleted locally
        }
      }

      // 3. Update state
      await loadDailyPanels(userId, mealDate, hasProfile);
      trackEvent("meal_deleted", { mealId });
      return true;
    } catch (err) {
      console.warn("Delete meal failed", err);
      return false;
    }
  }

  async function loadNutritionPreview(text, overrides = {}) {
    if (!userId || !text.trim()) return null;

    // Parse — errors propagate so the screen catch can show specific error
    const parseResult = await apiRequest("/nutrition/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, user_id: userId }),
    });

    // ── Contract guard — catch backend shape drift immediately ──────────────────
    // Backend → snake_case. Frontend → camelCase. Mapping happens HERE and ONLY HERE.
    if (!parseResult.parsed_items) {
      throw new Error("Invalid nutrition response shape: parsed_items missing");
    }

    let parsedItems = parseResult.parsed_items           || [];
    let needsClarif = parseResult.needs_clarification    || false;
    let questions   = parseResult.clarification_questions || [];

    // Apply any resolved overrides (user picked a portion size from a previous clarification)
    if (Object.keys(overrides).length > 0) {
      parsedItems = parsedItems.map((item, idx) => {
        const override = overrides[idx];
        // Ensure the override still matches the same food name to prevent stale portion drift
        if (override?.grams > 0 && override.foodName === item.raw_text) {
          return { ...item, estimated_weight_g: override.grams, amount: override.grams, unit: "g",
                   confidence_level: "high", needs_clarification: false };
        }
        return item;
      });
      questions   = questions.filter(q => !overrides[q.item_index] || overrides[q.item_index].foodName !== q.raw_text);
      needsClarif = parsedItems.some(item => item.needs_clarification === true) || questions.length > 0;
    }

    if (parsedItems.length === 0) return null;

    // Calculate — errors propagate; no local fallback
    const calcResult = await apiRequest("/nutrition/calculate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: parsedItems, user_id: userId }),
    });

    // Calculate may surface fresh clarification questions
    if (calcResult.needs_clarification && questions.length === 0) {
      const freshQuestions = (calcResult.clarification_questions || []).filter(q => !overrides[q.item_index]);
      if (freshQuestions.length > 0) {
        needsClarif = true;
        questions   = freshQuestions;
      }
    }

    if (!calcResult.meal_totals && !needsClarif) {
      return null;
    }

    return {
      needsClarification: needsClarif,
      questions,
      items:  calcResult.items  || parsedItems,
      totals: calcResult.meal_totals || null,
    };
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

  async function setPhotoUri(uri) {
    // Pre-flight: physical iOS device without EXPO_PUBLIC_API_BASE_URL configured.
    // localhost resolves to the device itself — all requests fail. Fail fast with a
    // precise developer-facing message rather than a misleading generic upload error.
    if (IS_PHYSICAL_DEVICE_MISSING_CONFIG) {
      const cfgError = new Error(
        "[DEV CONFIG] Fiziksel iPhone'da localhost kullanılamaz. " +
        "EXPO_PUBLIC_API_BASE_URL ortam değişkenini LAN IP adresinize ayarlayın " +
        "(örn. http://192.168.1.5:8001/api/v1)."
      );
      cfgError.code = "wrong_api_base_url";
      throw cfgError;
    }

    const prev = photoUri; // capture for rollback on failure
    setPhotoUriState(uri); // optimistic: show selected image immediately

    // Helper: one upload attempt with a 30s timeout.
    // Always reads the token fresh from the ref so a re-bootstrap between attempts
    // is automatically picked up.
    async function attemptUpload() {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const formData = new FormData();
        if (Platform.OS === "web") {
          const blobRes = await fetch(uri);
          const blob = await blobRes.blob();
          formData.append("file", blob, "photo.jpg");
        } else {
          formData.append("file", { uri, type: "image/jpeg", name: "photo.jpg" });
        }
        // Always re-read ref here — a concurrent re-bootstrap may have updated it
        const token = deviceTokenRef.current || await AsyncStorage.getItem(DEVICE_TOKEN_KEY).catch(() => null);
        const uploadUrl = buildApiUrl(`/friends/photo?user_id=${encodeURIComponent(userId)}`);
        const res = await fetch(uploadUrl, {
          method: "POST",
          body: formData,
          signal: controller.signal,
          headers: token ? { "X-Device-Token": token } : {},
        });
        if (!res.ok) throw new Error(`Upload HTTP ${res.status}`);
        return await res.json(); // { ok: true, photo_version: number }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    try {
      let result;
      try {
        result = await attemptUpload();
      } catch (firstErr) {
        const msg = String(firstErr?.message || "");
        if (firstErr?.name === "AbortError" || msg.startsWith("Upload HTTP 5")) {
          // Transient: network timeout or backend 5xx — wait then retry once
          await new Promise((r) => setTimeout(r, 2000));
          result = await attemptUpload();
        } else if (msg === "Upload HTTP 401") {
          // Auth failure: token is missing, stale, or mismatched (can happen when
          // the backend data was reset while the app still holds an old cached token,
          // or when upload is triggered before the bootstrap POST /public-id finishes).
          // Self-heal: re-bootstrap identity to get a fresh token, then retry once.
          try {
            const bootstrapRes = await apiRequest("/friends/public-id", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ user_id: userId, display_name: "" }),
            });
            if (bootstrapRes?.device_token) {
              setDeviceToken(bootstrapRes.device_token);
              deviceTokenRef.current = bootstrapRes.device_token;
              await AsyncStorage.setItem(DEVICE_TOKEN_KEY, bootstrapRes.device_token);
            }
          } catch {
            // bootstrap itself failed — let the retry fail naturally with a real error
          }
          result = await attemptUpload();
        } else {
          throw firstErr;
        }
      }
      // Use photo_version for cache-busting so any CDN/browser gets the latest
      const version = result?.photo_version || Date.now();
      const remoteUrl = buildApiUrl(`/friends/photo/${encodeURIComponent(userId)}?v=${version}`);
      setPhotoUriState(remoteUrl);
      await AsyncStorage.setItem(PHOTO_URI_KEY, remoteUrl);
    } catch (rawErr) {
      // Tag error with a discriminable code so ProfileScreen can show a precise message.
      // Only tag when no code exists (preserves wrong_api_base_url from pre-flight).
      // Safe assignment: Error objects are normally mutable, but a frozen or sealed
      // error (e.g. from a native module or some library) would throw on property write.
      // We catch that and wrap instead of mutating, guaranteeing the code is always set.
      let err = rawErr;
      if (!rawErr?.code) {
        const emsg = String(rawErr?.message || "");
        let newCode;
        if (emsg.includes("Upload HTTP 401")) {
          newCode = "auth_error";        // 401 survived the self-heal — token definitively invalid
        } else if (
          rawErr?.name === "AbortError" ||
          rawErr?.name === "TypeError" ||  // "Network request failed" on iOS/Android native
          rawErr?.category === "network"   // apiRequest-tagged errors (network_timeout, backend_unreachable)
        ) {
          newCode = "network_error";
        }
        if (newCode) {
          try {
            rawErr.code = newCode;        // mutate in place (works for normal Error instances)
          } catch {
            // Frozen or sealed — wrap it so the code property is always guaranteed
            err = Object.assign(new Error(rawErr?.message || ""), {
              code: newCode,
              name: rawErr?.name,
              category: rawErr?.category,
              cause: rawErr,
            });
          }
        }
      }
      // Rollback to previous photo on ultimate failure
      setPhotoUriState(prev);
      if (prev) {
        await AsyncStorage.setItem(PHOTO_URI_KEY, prev);
      } else {
        await AsyncStorage.removeItem(PHOTO_URI_KEY);
      }
      throw err; // caller (ProfileScreen) shows Alert
    }
  }

  // Callable from screens on focus — re-syncs publicUserId, device token, photo from backend
  const refreshIdentity = useCallback(async () => {
    if (!userId) return;
    try {
      const res = await apiRequest("/friends/public-id", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, display_name: "" }),
      });
      // Always overwrite — backend is the single source of truth.
      // Update ID and token atomically to prevent token/ID drift after backend resets.
      const newId    = res?.public_user_id;
      const newToken = res?.device_token;
      if (newId) {
        setPublicUserId(newId);
        AsyncStorage.setItem(PUBLIC_USER_ID_KEY, newId);
      }
      if (newToken) {
        setDeviceToken(newToken);
        deviceTokenRef.current = newToken;
        AsyncStorage.setItem(DEVICE_TOKEN_KEY, newToken);
      }
      if (res?.has_photo) {
        const version = res?.photo_version || 0;
        const remoteUrl = buildApiUrl(`/friends/photo/${encodeURIComponent(userId)}?v=${version}`);
        setPhotoUriState(remoteUrl);
        AsyncStorage.setItem(PHOTO_URI_KEY, remoteUrl);
      }
    } catch (_) { /* backend offline — current values remain */ }
  }, [userId]);

  const value = {
    // Identity
    userId,
    publicUserId,
    deviceToken,
    photoUri,
    setPhotoUri,
    refreshIdentity,

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
    removeWaterMl,

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
    deleteMeal,
    loadNutritionPreview,
    addManualSteps,
    completeDay,
    recalculateGoalsLocally: (form) => {
      const g = calculateGoalsLocally(form);
      if (g) setGoals(normalizeGoals(g));
    },
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  return useContext(AppContext);
}
