const apiBase =
  window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
    ? "http://127.0.0.1:8000/api/v1"
    : `${window.location.origin}/api/v1`;

const uploadForm = document.getElementById("upload-form");
const fileInput = document.getElementById("pdf-file");
const uploadResult = document.getElementById("upload-result");
const refreshDocumentsButton = document.getElementById("refresh-documents");
const documentsContainer = document.getElementById("documents");
const chatForm = document.getElementById("chat-form");
const documentIdInput = document.getElementById("document-id");
const questionInput = document.getElementById("question");
const chatResult = document.getElementById("chat-result");
const trainingForm = document.getElementById("training-form");
const trainingProgramInput = document.getElementById("training-program");
const analysisStatus = document.getElementById("analysis-status");
const reportStatus = document.getElementById("report-status");
const analysisResult = document.getElementById("analysis-result");
const reportResult = document.getElementById("report-result");
const profileForm = document.getElementById("profile-form");
const profileStatus = document.getElementById("profile-status");
const profileFeedback = document.getElementById("profile-feedback");
const goalTargetsContainer = document.getElementById("goal-targets");
const profileWeightInput = document.getElementById("profile-weight");
const profileHeightInput = document.getElementById("profile-height");
const profileAgeInput = document.getElementById("profile-age");
const profileGenderInput = document.getElementById("profile-gender");
const profileActivityInput = document.getElementById("profile-activity");
const profileTrainingFrequencyInput = document.getElementById("profile-training-frequency");
const profileGoalInput = document.getElementById("profile-goal");
const nutritionForm = document.getElementById("nutrition-form");
const mealTypeInput = document.getElementById("meal-type");
const mealDateInput = document.getElementById("meal-date");
const quickAddRecentFoods = document.getElementById("quick-add-recent-foods");
const quickAddFavoriteFoods = document.getElementById("quick-add-favorite-foods");
const quickAddFavoriteMeals = document.getElementById("quick-add-favorite-meals");
const nutritionInput = document.getElementById("nutrition-input");
const nutritionSuggestions = document.getElementById("nutrition-suggestions");
const nutritionStatus = document.getElementById("nutrition-status");
const nutritionClarifications = document.getElementById("nutrition-clarifications");
const nutritionLiveHint = document.getElementById("nutrition-live-hint");
const nutritionResult = document.getElementById("nutrition-result");
const nutritionFavoriteMealButton = document.getElementById("nutrition-favorite-meal");
const nutritionSaveButton = document.getElementById("nutrition-save");
const dailyCommandStatus = document.getElementById("daily-command-status");
const dailyCommandCard = document.getElementById("daily-command-card");
const dailySummaryStatus = document.getElementById("daily-summary-status");
const dailyActionBar = document.getElementById("daily-action-bar");
const dailyCoachContainer = document.getElementById("daily-coach");
const dailySummaryContainer = document.getElementById("daily-summary");
const hydrationStatus = document.getElementById("hydration-status");
const hydrationSummaryContainer = document.getElementById("hydration-summary");
const hydrationProgressFill = document.getElementById("hydration-progress-fill");
const hydrationFeedback = document.getElementById("hydration-feedback");
const hydrationLogsContainer = document.getElementById("hydration-logs");
const hydrationOpenQuickLogButton = document.getElementById("hydration-open-quick-log");
const hydrationOpenRemindersButton = document.getElementById("hydration-open-reminders");
const hydrationOpenWeeklyStatsButton = document.getElementById("hydration-open-weekly-stats");
const hydrationProfileForm = document.getElementById("hydration-profile-form");
const hydrationTargetStatus = document.getElementById("hydration-target-status");
const hydrationWeightInput = document.getElementById("hydration-weight");
const hydrationGlassInput = document.getElementById("hydration-glass");
const hydrationTargetModeInput = document.getElementById("hydration-target-mode");
const hydrationManualTargetInput = document.getElementById("hydration-manual-target");
const hydrationAdjustmentEnabledInput = document.getElementById("hydration-adjustment-enabled");
const hydrationLogForm = document.getElementById("hydration-log-form");
const hydrationAmountInput = document.getElementById("hydration-amount");
const hydrationUnitInput = document.getElementById("hydration-unit");
const hydrationNoteInput = document.getElementById("hydration-note");
const hydrationModal = document.getElementById("hydration-modal");
const hydrationModalEyebrow = document.getElementById("hydration-modal-eyebrow");
const hydrationModalTitle = document.getElementById("hydration-modal-title");
const hydrationModalContent = document.getElementById("hydration-modal-content");
const hydrationModalCloseButton = document.getElementById("hydration-modal-close");

let nutritionDraftItems = [];
let nutritionMealTotals = null;
let nutritionSuggestTimer = null;
let nutritionParseTimer = null;
let nutritionRecalculateTimer = null;
let nutritionParseRequestId = 0;
let nutritionRecalculateRequestId = 0;
let nutritionClarificationQuestions = [];
let dailyCommandRequestId = 0;
let currentDailyCommand = null;
let dailyCommandFeedbackState = null;
let dailySummaryRequestId = 0;
let dailyActionTrackRequestId = 0;
const defaultProteinTarget = 160;
const defaultCalorieTarget = 2200;
let currentNutritionTargets = {
  protein_target_g: defaultProteinTarget,
  calorie_target_kcal: defaultCalorieTarget,
};
let quickAddCache = {
  last_10_foods: [],
  favorite_foods: [],
  favorite_meals: [],
};
let hydrationProfile = null;
let currentHydrationSummary = null;
let currentHydrationReminderSettings = null;
let currentHydrationWeeklyStats = null;
let hydrationSummaryRequestId = 0;
let hydrationReminderRequestId = 0;
let hydrationWeeklyRequestId = 0;
let hydrationModalMode = null;
let hydrationReminderNotice = null;
const currentUserId = getOrCreateLocalUserId();
let currentDailyActionState = null;
let currentPrimeAudio = null;
let lastPlayedVoiceKey = null;
const voicePlaybackCache = new Map();
const primeVoiceMuteStorageKey = "prime-voice-muted";
let primeVoiceMuted = window.localStorage.getItem(primeVoiceMuteStorageKey) === "true";

const GENERIC_FOOD_NAME_RULES = [
  { tr: "Tavuk Göğsü", aliases: ["chicken breast", "cooked chicken breast", "grilled chicken breast"] },
  { tr: "Yulaf Ezmesi", aliases: ["oatmeal", "cooked oatmeal", "rolled oats", "oats"] },
  { tr: "Beyaz Pirinç", aliases: ["white rice"] },
  { tr: "Pirinç", aliases: ["rice"] },
  { tr: "Esmer Pirinç", aliases: ["brown rice"] },
  { tr: "Süzme Yoğurt", aliases: ["greek yogurt"] },
  { tr: "Yoğurt", aliases: ["yogurt"] },
  { tr: "Lor Peyniri", aliases: ["cottage cheese"] },
  { tr: "Yumurta Beyazı", aliases: ["egg white", "egg whites"] },
  { tr: "Yumurta", aliases: ["whole egg", "whole eggs"] },
  { tr: "Haşlanmış Yumurta", aliases: ["boiled egg", "boiled eggs"] },
  { tr: "Çırpılmış Yumurta", aliases: ["scrambled eggs"] },
  { tr: "Muz", aliases: ["banana"] },
  { tr: "Elma", aliases: ["apple"] },
  { tr: "Ton Balığı", aliases: ["tuna"] },
  { tr: "Somon", aliases: ["salmon"] },
  { tr: "Dana Kıyma", aliases: ["ground beef", "beef mince"] },
  { tr: "Az Yağlı Dana Kıyma", aliases: ["lean ground beef"] },
  { tr: "Patates", aliases: ["potato"] },
  { tr: "Tatlı Patates", aliases: ["sweet potato"] },
  { tr: "Brokoli", aliases: ["broccoli"] },
  { tr: "Whey Protein", aliases: ["whey protein"] },
  { tr: "Protein Bar", aliases: ["protein bar"] },
];

mealDateInput.value = getLocalDateInputValue();
applyTurkishUICopy();
prefillHydrationWeightFromProfile();
updateHydrationManualTargetState();

nutritionInput.addEventListener("input", () => {
  scheduleNutritionSuggestions();
  scheduleRealtimeNutritionParse();
});

nutritionInput.addEventListener("blur", () => {
  window.setTimeout(() => {
    nutritionSuggestions.classList.add("hidden");
  }, 150);
});

nutritionInput.addEventListener("focus", () => {
  if (nutritionInput.value.trim()) {
    scheduleNutritionSuggestions();
  }
});

uploadForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = fileInput.files[0];
  if (!file) {
    setMessage(uploadResult, "Select a PDF first.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  setMessage(uploadResult, "Uploading PDF...", "loading");

  try {
    const payload = await request(`${apiBase}/upload`, {
      method: "POST",
      body: formData,
    });

    documentIdInput.value = payload.document_id;
    setMessage(
      uploadResult,
      `${payload.filename} uploaded successfully. ${payload.page_count} pages, ${payload.chunk_count} chunks, vector status: ${payload.vector_store_status}.`,
      "success",
    );
    await loadDocuments();
  } catch (error) {
    setMessage(uploadResult, error.message, "error");
  }
});

function normalizeFoodNameKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function localizedFoodName(name, item = null) {
  const fallback = String(name || "").trim();
  if (!fallback) {
    return "Besin";
  }
  if (item?.is_branded_product || item?.brand || item?.product_name) {
    return fallback;
  }
  const normalized = normalizeFoodNameKey(fallback);
  const matchedRule = GENERIC_FOOD_NAME_RULES.find((rule) => rule.aliases.includes(normalized));
  return matchedRule?.tr || fallback;
}

function displayFoodName(item, fallback = "Besin") {
  const baseName =
    item?.display_name_tr ||
    item?.canonical_display_name ||
    item?.food_name ||
    item?.label;
  return localizedFoodName(baseName || fallback, item);
}

profileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveUserProfile();
});

refreshDocumentsButton.addEventListener("click", () => {
  void loadDocuments();
});

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  chatResult.innerHTML = '<p class="muted-text">Generating answer from retrieved chunks...</p>';

  try {
    const payload = await request(`${apiBase}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        question: questionInput.value,
        document_id: documentIdInput.value || null,
        top_k: 5,
      }),
    });

    renderChat(payload);
  } catch (error) {
    chatResult.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
  }
});

trainingForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  analysisStatus.textContent = "Analyzing...";
  reportStatus.textContent = "Waiting for analysis...";
  analysisResult.innerHTML = '<p class="muted-text">Running training analysis...</p>';
  reportResult.innerHTML = '<p class="muted-text">Preparing report...</p>';

  try {
    const analysis = await request(`${apiBase}/training/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        program_text: trainingProgramInput.value,
      }),
    });

    analysisStatus.textContent = "Analysis ready";
    renderAnalysis(analysis);

    const report = await request(`${apiBase}/training/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(analysis),
    });

    reportStatus.textContent = "Report ready";
    renderReport(report);
  } catch (error) {
    analysisStatus.textContent = "Error";
    reportStatus.textContent = "Error";
    analysisResult.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
    reportResult.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
  }
});

nutritionForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void runRealtimeNutritionParse();
});

nutritionFavoriteMealButton.addEventListener("click", async () => {
  const quickText = nutritionInput.value.trim();
  if (!quickText || !nutritionDraftItems.length) {
    nutritionClarifications.className = "message-box message-error";
    nutritionClarifications.textContent = "Favori öğün eklemek için önce bir öğün yaz.";
    return;
  }

  try {
    await request(`${apiBase}/meals/quick-add/favorite-meal`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: currentUserId,
        title: buildFavoriteMealTitle(),
        quick_text: quickText,
        meal_type: mealTypeInput.value || null,
        item_count: nutritionDraftItems.length,
        active: true,
      }),
    });

    nutritionClarifications.className = "message-box message-success";
    nutritionClarifications.textContent = "Öğün favorilere eklendi.";
    await loadQuickAddOptions();
  } catch (error) {
    nutritionClarifications.className = "message-box message-error";
    nutritionClarifications.textContent = error.message;
  }
});

nutritionSaveButton.addEventListener("click", async () => {
  if (!nutritionDraftItems.length || !nutritionMealTotals) {
    nutritionClarifications.className = "message-box message-error";
    nutritionClarifications.textContent = "Ã–nce Ã¶ÄŸÃ¼nÃ¼ analiz et.";
    return;
  }

  try {
    const savedMeal = await request(`${apiBase}/meals/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: currentUserId,
        meal_type: mealTypeInput.value,
        items: nutritionDraftItems,
        totals: nutritionMealTotals,
        date: mealDateInput.value,
      }),
    });

    nutritionStatus.textContent = "Kaydedildi";
    nutritionClarifications.className = "message-box message-success";
    nutritionClarifications.textContent = `${savedMeal.meal_type} kaydedildi. GÃ¼nlÃ¼k Ã¶zet gÃ¼ncellendi.`;
    await completeDailyActionByType("log_meal");
    await loadDailySummary(mealDateInput.value);
    await loadDailyCommand(mealDateInput.value);
    await loadQuickAddOptions();
  } catch (error) {
    nutritionClarifications.className = "message-box message-error";
    nutritionClarifications.textContent = error.message;
  }
});

mealDateInput.addEventListener("change", () => {
  void loadDailySummary(mealDateInput.value);
  void loadHydrationSummary(mealDateInput.value);
  void loadDailyCommand(mealDateInput.value);
  if (hydrationModalMode === "weekly") {
    void loadHydrationWeeklyStats(mealDateInput.value);
  }
});

hydrationTargetModeInput.addEventListener("change", updateHydrationManualTargetState);

hydrationProfileForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await saveHydrationProfile();
});

hydrationLogForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await createHydrationLog({
    amount: Number(hydrationAmountInput.value),
    unit: hydrationUnitInput.value,
    note: hydrationNoteInput.value.trim() || null,
  });
});

document.querySelectorAll('[data-role="hydration-quick-add"]').forEach((button) => {
  button.addEventListener("click", () => {
    void createHydrationLog({
      amount: Number(button.dataset.amount),
      unit: button.dataset.unit,
      note: null,
    });
  });
});

hydrationOpenQuickLogButton?.addEventListener("click", () => {
  void openHydrationModal("quick-log");
});

hydrationOpenRemindersButton?.addEventListener("click", () => {
  void openHydrationModal("reminders");
});

hydrationOpenWeeklyStatsButton?.addEventListener("click", () => {
  void openHydrationModal("weekly");
});

hydrationModalCloseButton?.addEventListener("click", closeHydrationModal);
hydrationModal?.querySelectorAll('[data-role="hydration-modal-close"]').forEach((element) => {
  element.addEventListener("click", closeHydrationModal);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && hydrationModalMode) {
    closeHydrationModal();
  }
});

async function request(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json();

  if (!response.ok) {
    const error = new Error(payload.detail || "Request failed");
    error.status = response.status;
    throw error;
  }

  return payload;
}

async function saveUserProfile() {
  profileStatus.textContent = "Kaydediliyor...";
  profileFeedback.className = "message-box message-loading";
  profileFeedback.textContent = "Profil hesaplari guncelleniyor...";

  try {
    const payload = await request(`${apiBase}/user/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildUserProfilePayload()),
    });

    profileStatus.textContent = "Hazir";
    profileFeedback.className = "message-box message-success";
    profileFeedback.textContent = "Profil kaydedildi. Gunluk hedefler kisisellestirildi.";
    populateUserProfileForm(payload.profile);
    renderGoalTargets(payload.goals, payload.profile.goal);
    await loadDailySummary(mealDateInput.value);
    await loadHydrationProfile();
    await loadHydrationSummary(mealDateInput.value);
    await loadDailyCommand(mealDateInput.value);
  } catch (error) {
    profileStatus.textContent = "Hata";
    profileFeedback.className = "message-box message-error";
    profileFeedback.textContent = error.message;
  }
}

async function loadUserProfile() {
  profileStatus.textContent = "Yukleniyor...";

  try {
    const payload = await request(`${apiBase}/user/profile?user_id=${encodeURIComponent(currentUserId)}`);
    profileStatus.textContent = "Hazir";
    populateUserProfileForm(payload.profile);
    renderGoalTargets(payload.goals, payload.profile.goal);
    profileFeedback.className = "message-box message-success";
    profileFeedback.textContent = "Profil yuklendi. Gunluk hedefler hazir.";
    await loadDailySummary(mealDateInput.value);
    await loadHydrationProfile();
    await loadHydrationSummary(mealDateInput.value);
    await loadDailyCommand(mealDateInput.value);
  } catch (error) {
    if (error.status === 404) {
      profileStatus.textContent = "Kurulum gerekli";
      profileFeedback.className = "message-box empty-state";
      profileFeedback.textContent = "Ilk kez kullaniyorsan profilini doldur. Hedefler buna gore hesaplanacak.";
      goalTargetsContainer.className = "report-view empty-state";
      goalTargetsContainer.textContent = "BMR, TDEE, kalori hedefi ve makro hedefleri burada görünür.";
      prefillHydrationWeightFromProfile();
      return;
    }

    profileStatus.textContent = "Hata";
    profileFeedback.className = "message-box message-error";
    profileFeedback.textContent = error.message;
  }
}

async function saveHydrationProfile() {
  hydrationTargetStatus.textContent = "Kaydediliyor...";
  setMessage(hydrationFeedback, "Su hedefi kaydediliyor...", "loading");

  try {
    const payload = await request(`${apiBase}/hydration/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildHydrationProfilePayload()),
    });

    hydrationProfile = payload;
    updateHydrationTargetStatus(payload);
    populateHydrationProfileForm(payload.profile);
    setMessage(hydrationFeedback, "Su hedefi kaydedildi. Günlük takip hazır.", "success");
    await loadHydrationSummary(mealDateInput.value);
    if (hydrationModalMode === "weekly") {
      await loadHydrationWeeklyStats(mealDateInput.value);
    } else {
      refreshHydrationModalIfReady();
    }
    await loadDailyCommand(mealDateInput.value);
  } catch (error) {
    hydrationTargetStatus.textContent = "Hata";
    setMessage(hydrationFeedback, error.message, "error");
  }
}

async function loadHydrationProfile() {
  hydrationTargetStatus.textContent = "Yükleniyor...";

  try {
    const payload = await request(`${apiBase}/hydration/profile?user_id=${encodeURIComponent(currentUserId)}`);
    hydrationProfile = payload;
    updateHydrationTargetStatus(payload);
    populateHydrationProfileForm(payload.profile);
    refreshHydrationModalIfReady();
    if (!hydrationFeedback.classList.contains("message-success")) {
      hydrationFeedback.className = "message-box empty-state";
      hydrationFeedback.textContent = "Su takibi hazır. İstersen hızlı butonlarla hemen giriş yap.";
    }
  } catch (error) {
    hydrationProfile = null;
    hydrationTargetStatus.textContent = error.status === 404 ? "Kurulum gerekli" : "Hata";
    prefillHydrationWeightFromProfile();
    updateHydrationManualTargetState();
    refreshHydrationModalIfReady();
    if (error.status === 404) {
      setMessage(
        hydrationFeedback,
        "Su hedefi için kilo ve hedef modunu ayarla. İstersen profil kilon otomatik kullanılır.",
        "loading",
      );
      return;
    }
    setMessage(hydrationFeedback, error.message, "error");
  }
}

function updateHydrationTargetStatus(payload) {
  if (!payload?.target?.target_ml) {
    hydrationTargetStatus.textContent = "Hazır";
    return;
  }
  hydrationTargetStatus.textContent = `Hazır · ${Number(payload.target.target_ml).toFixed(0)} ml`;
}

function buildHydrationProfilePayload() {
  return {
    user_id: currentUserId,
    weight_kg: hydrationWeightInput.value ? Number(hydrationWeightInput.value) : null,
    default_glass_ml: Number(hydrationGlassInput.value || 250),
    target_mode: hydrationTargetModeInput.value,
    manual_target_ml: hydrationManualTargetInput.value ? Number(hydrationManualTargetInput.value) : null,
    activity_adjustment_enabled: hydrationAdjustmentEnabledInput.checked,
  };
}

function populateHydrationProfileForm(profile) {
  hydrationWeightInput.value = profile.weight_kg ?? profileWeightInput.value ?? "";
  hydrationGlassInput.value = profile.default_glass_ml ?? 250;
  hydrationTargetModeInput.value = profile.target_mode ?? "auto";
  hydrationManualTargetInput.value = profile.manual_target_ml ?? "";
  hydrationAdjustmentEnabledInput.checked = Boolean(profile.activity_adjustment_enabled);
  updateHydrationManualTargetState();
}

function prefillHydrationWeightFromProfile() {
  if (!hydrationWeightInput.value && profileWeightInput.value) {
    hydrationWeightInput.value = profileWeightInput.value;
  }
  if (!hydrationGlassInput.value) {
    hydrationGlassInput.value = 250;
  }
}

function updateHydrationManualTargetState() {
  const isManual = hydrationTargetModeInput.value === "manual";
  hydrationManualTargetInput.disabled = !isManual;
  hydrationManualTargetInput.required = isManual;
  if (!isManual) {
    hydrationManualTargetInput.value = "";
  }
}

async function openHydrationModal(mode) {
  hydrationModalMode = mode;
  hydrationModal.classList.remove("hidden");
  hydrationModal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  hydrationModalContent.innerHTML = '<div class="empty-state">Hazırlanıyor...</div>';

  if (mode === "quick-log") {
    if (!currentHydrationSummary) {
      await loadHydrationSummary(mealDateInput.value, { preserveShell: true });
    } else {
      renderHydrationModal();
    }
    return;
  }

  if (mode === "reminders") {
    await loadHydrationReminderSettings();
    return;
  }

  if (mode === "weekly") {
    await loadHydrationWeeklyStats(mealDateInput.value);
  }
}

function closeHydrationModal() {
  hydrationModalMode = null;
  hydrationModal.classList.add("hidden");
  hydrationModal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function renderHydrationModal() {
  if (!hydrationModalMode) {
    return;
  }
  if (hydrationModalMode === "quick-log") {
    renderHydrationQuickLogModal();
    return;
  }
  if (hydrationModalMode === "reminders") {
    renderHydrationReminderModal();
    return;
  }
  renderHydrationWeeklyStatsModal();
}

function refreshHydrationModalIfReady() {
  if (!hydrationModalMode) {
    return;
  }
  if (hydrationModalMode === "reminders") {
    return;
  }
  if (hydrationModalMode === "weekly" && !currentHydrationWeeklyStats?.days?.length) {
    return;
  }
  renderHydrationModal();
}

async function loadHydrationReminderSettings() {
  const activeRequestId = ++hydrationReminderRequestId;
  hydrationReminderNotice = null;
  hydrationModalEyebrow.textContent = "Su Takibi";
  hydrationModalTitle.textContent = "Hatırlatmalar";
  hydrationModalContent.innerHTML = '<div class="empty-state">Hatırlatmalar yükleniyor...</div>';

  try {
    const payload = await request(
      `${apiBase}/hydration/reminder-settings?user_id=${encodeURIComponent(currentUserId)}`,
    );
    if (activeRequestId !== hydrationReminderRequestId) {
      return;
    }
    currentHydrationReminderSettings = payload;
    renderHydrationModal();
  } catch (error) {
    if (activeRequestId !== hydrationReminderRequestId) {
      return;
    }
    hydrationModalContent.innerHTML = `<div class="message-box message-error">${escapeHtml(error.message)}</div>`;
  }
}

async function saveHydrationReminderSettings(payload) {
  hydrationModalContent.querySelector('[data-role="reminder-save"]')?.setAttribute("disabled", "disabled");
  try {
    const response = await request(`${apiBase}/hydration/reminder-settings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    currentHydrationReminderSettings = response;
    hydrationReminderNotice = {
      tone: "success",
      message: "Hatırlatma ritmi kaydedildi.",
    };
    renderHydrationModal();
  } catch (error) {
    hydrationReminderNotice = {
      tone: "error",
      message: error.message,
    };
    renderHydrationModal();
  }
}

async function loadHydrationWeeklyStats(endDate) {
  const activeRequestId = ++hydrationWeeklyRequestId;
  hydrationModalEyebrow.textContent = "Su Takibi";
  hydrationModalTitle.textContent = "Son 7 Gün";
  hydrationModalContent.innerHTML = '<div class="empty-state">Haftalık istatistikler yükleniyor...</div>';

  try {
    const payload = await request(
      `${apiBase}/hydration/weekly-stats?user_id=${encodeURIComponent(currentUserId)}&end_date=${encodeURIComponent(endDate)}`,
    );
    if (activeRequestId !== hydrationWeeklyRequestId) {
      return;
    }
    currentHydrationWeeklyStats = payload;
    renderHydrationModal();
  } catch (error) {
    if (activeRequestId !== hydrationWeeklyRequestId) {
      return;
    }
    hydrationModalContent.innerHTML = `<div class="message-box message-error">${escapeHtml(error.message)}</div>`;
  }
}

function renderHydrationQuickLogModal() {
  hydrationModalEyebrow.textContent = "Su Takibi";
  hydrationModalTitle.textContent = "Hızlı Su Logu";

  if (!currentHydrationSummary) {
    hydrationModalContent.innerHTML = '<div class="empty-state">Önce su hedefini hazırla.</div>';
    return;
  }

  const summary = currentHydrationSummary;
  const progressPercent = Math.min(Number(summary.completion_percent || 0), 100);
  const primaryMl = resolveHydrationQuickLogPrimaryMl(summary);
  const alternateMl = resolveHydrationQuickLogAlternatives(primaryMl);
  hydrationModalContent.innerHTML = `
    <div class="hydration-quick-screen">
      <p class="hydration-modal-note">${escapeHtml(resolveQuickLogSupportText(summary))}</p>
      <div class="hydration-orbit" style="--hydration-progress:${progressPercent}%">
        <div class="hydration-orbit-center">
          <strong>%${progressPercent.toFixed(0)}</strong>
          <span>${Number(summary.consumed_ml).toFixed(0)} / ${Number(summary.target_ml).toFixed(0)} ml</span>
        </div>
      </div>
      <button type="button" class="hydration-main-cta" data-role="hydration-modal-log" data-amount="${primaryMl}">
        Şimdi ${primaryMl} ml iç
      </button>
      <div class="hydration-alt-action-row">
        ${alternateMl
          .map(
            (amount) => `
              <button type="button" class="button-secondary hydration-alt-button" data-role="hydration-modal-log" data-amount="${amount}">
                +${amount} ml
              </button>
            `,
          )
          .join("")}
      </div>
      <form class="hydration-modal-custom-form" data-role="hydration-modal-custom-form">
        <div>
          <label for="hydration-modal-custom-amount">Özel miktar</label>
          <input id="hydration-modal-custom-amount" type="number" min="50" step="50" placeholder="Örn. 350" required />
        </div>
        <button type="submit" class="button-secondary">Özel ekle</button>
      </form>
    </div>
  `;

  hydrationModalContent.querySelectorAll('[data-role="hydration-modal-log"]').forEach((button) => {
    button.addEventListener("click", () => {
      void createHydrationLog({
        amount: Number(button.dataset.amount),
        unit: "ml",
        note: null,
      });
    });
  });

  hydrationModalContent.querySelector('[data-role="hydration-modal-custom-form"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    const input = hydrationModalContent.querySelector("#hydration-modal-custom-amount");
    void createHydrationLog({
      amount: Number(input?.value),
      unit: "ml",
      note: null,
    });
  });
}

function renderHydrationReminderModal() {
  hydrationModalEyebrow.textContent = "Su Takibi";
  hydrationModalTitle.textContent = "Hatırlatmalar";
  const settings = currentHydrationReminderSettings?.settings;
  if (!settings) {
    hydrationModalContent.innerHTML = '<div class="empty-state">Hatırlatma ayarları hazır değil.</div>';
    return;
  }

  hydrationModalContent.innerHTML = `
    <form class="hydration-settings-form" data-role="hydration-reminder-form">
      <div class="message-box ${hydrationReminderNotice ? `message-${hydrationReminderNotice.tone}` : "message-loading"} hydration-modal-note">${escapeHtml(
        hydrationReminderNotice?.message || currentHydrationReminderSettings?.next_hint || "Hatırlatma ritmini seç.",
      )}</div>
      <label class="checkbox-row" for="hydration-reminder-enabled">
        <input id="hydration-reminder-enabled" type="checkbox" ${settings.enabled ? "checked" : ""} />
        <span>Hatırlatmaları aç</span>
      </label>
      <div class="two-col compact-grid">
        <div>
          <label for="hydration-reminder-start">Başlangıç</label>
          <input id="hydration-reminder-start" type="time" value="${escapeHtml(settings.start_time)}" required />
        </div>
        <div>
          <label for="hydration-reminder-end">Bitiş</label>
          <input id="hydration-reminder-end" type="time" value="${escapeHtml(settings.end_time)}" required />
        </div>
      </div>
      <div>
        <label for="hydration-reminder-interval">Aralık</label>
        <select id="hydration-reminder-interval">
          ${buildHydrationReminderIntervalOptions(Number(settings.interval_minutes || 60))}
        </select>
      </div>
      <div class="button-row">
        <button type="submit" data-role="reminder-save">Hatırlatmayı Kaydet</button>
      </div>
      <p class="hydration-modal-footnote">Ayarlar kaydolur. Aktif bildirim gönderimi bir sonraki katmanda açılır.</p>
    </form>
  `;

  hydrationModalContent.querySelector('[data-role="hydration-reminder-form"]')?.addEventListener("submit", (event) => {
    event.preventDefault();
    void saveHydrationReminderSettings({
      user_id: currentUserId,
      enabled: Boolean(hydrationModalContent.querySelector("#hydration-reminder-enabled")?.checked),
      start_time: hydrationModalContent.querySelector("#hydration-reminder-start")?.value || "08:00",
      end_time: hydrationModalContent.querySelector("#hydration-reminder-end")?.value || "22:00",
      interval_minutes: Number(hydrationModalContent.querySelector("#hydration-reminder-interval")?.value || 60),
    });
  });
}

function renderHydrationWeeklyStatsModal() {
  hydrationModalEyebrow.textContent = "Su Takibi";
  hydrationModalTitle.textContent = "Son 7 Gün";
  const stats = currentHydrationWeeklyStats;
  if (!stats?.days?.length) {
    hydrationModalContent.innerHTML = '<div class="empty-state">Henüz haftalık veri yok.</div>';
    return;
  }

  const maxMl = Math.max(
    1,
    ...stats.days.map((day) => Math.max(Number(day.consumed_ml || 0), Number(day.target_ml || 0))),
  );
  const insight = resolveHydrationWeeklyInsight(stats);
  hydrationModalContent.innerHTML = `
      <div class="hydration-weekly-screen">
        <div class="summary-grid">
          ${metricCard("Ortalama", `${Number(stats.average_daily_ml).toFixed(0)} ml`, "Günlük ortalama")}
          ${metricCard("Toplam", `${Number(stats.total_ml).toFixed(0)} ml`, "7 gün toplam")}
        ${metricCard("Hedef günü", `${Number(stats.goal_reached_days).toFixed(0)} gün`, "Yüzde 90+ başarı")}
        ${metricCard("En iyi seri", `${Number(stats.best_streak).toFixed(0)} gün`, "Seçili aralık")}
      </div>
      <div class="hydration-weekly-chart">
        ${stats.days
          .map((day) => {
            const consumedMl = Number(day.consumed_ml || 0);
            const targetMl = Number(day.target_ml || 0);
            const barHeight = Math.max((consumedMl / maxMl) * 100, consumedMl > 0 ? 6 : 2);
            const targetOffset = Math.min((targetMl / maxMl) * 100, 100);
            return `
              <div class="hydration-weekly-bar-group">
                <div class="hydration-weekly-bar-track">
                  <span class="hydration-weekly-target-line" style="bottom:${targetOffset}%"></span>
                  <span class="hydration-weekly-bar ${day.reached_target ? "is-hit" : ""}" style="height:${barHeight}%"></span>
                </div>
                <strong>${escapeHtml(shortTurkishDayLabel(day.date))}</strong>
                <small>${consumedMl.toFixed(0)} ml</small>
              </div>
            `;
            })
            .join("")}
        </div>
        ${insight ? `<p class="hydration-weekly-insight">${escapeHtml(insight)}</p>` : ""}
      </div>
    `;
}

function resolveHydrationQuickLogPrimaryMl(summary) {
  const commandMl =
    currentDailyCommand?.primary_domain === "hydration"
      ? Number(currentDailyCommand.hydration_quick_add_ml || 0)
      : 0;
  if (commandMl > 0) {
    return commandMl;
  }
  const suggestedMl = Number(summary?.next_action?.suggested_ml || 0);
  if (suggestedMl > 0) {
    return suggestedMl;
  }
  return Number(hydrationProfile?.profile?.default_glass_ml || hydrationGlassInput.value || 250);
}

function resolveHydrationQuickLogAlternatives(primaryMl) {
  const glassMl = Number(hydrationProfile?.profile?.default_glass_ml || hydrationGlassInput.value || 250);
  return [...new Set([200, 250, glassMl, 500].filter((value) => value > 0 && value !== primaryMl))].slice(0, 4);
}

function resolveQuickLogSupportText(summary) {
  if (summary?.time_status === "behind_schedule") {
    return "Hemen toparla.";
  }
  if (summary?.time_status === "ahead") {
    return "Bu tempoyu koru.";
  }
  if (summary?.status === "complete" || summary?.status === "above_target") {
    return "Kontrol sende.";
  }
  return "Ritmi koru.";
}

function buildHydrationReminderIntervalOptions(selectedMinutes) {
  return [
    [15, "15 dk"],
    [30, "30 dk"],
    [60, "1 saat"],
    [90, "1.5 saat"],
    [120, "2 saat"],
    [150, "2.5 saat"],
  ]
    .map(
      ([value, label]) => `
        <option value="${value}" ${Number(selectedMinutes) === value ? "selected" : ""}>${escapeHtml(label)}</option>
      `,
    )
    .join("");
}

function shortTurkishDayLabel(isoDate) {
  return new Intl.DateTimeFormat("tr-TR", { weekday: "short" }).format(new Date(`${isoDate}T12:00:00`));
}

async function loadHydrationSummary(date, { preserveShell = false } = {}) {
  const activeRequestId = ++hydrationSummaryRequestId;
  hydrationStatus.textContent = preserveShell ? "Güncelleniyor..." : "Yükleniyor...";
  if (!preserveShell) {
    hydrationSummaryContainer.className = "report-view empty-state";
    hydrationSummaryContainer.textContent = "Su özeti hazırlanıyor...";
    hydrationLogsContainer.className = "meal-list empty-state";
    hydrationLogsContainer.textContent = "Su kayıtları yükleniyor...";
    hydrationProgressFill.style.width = "0%";
    hydrationProgressFill.className = "hydration-progress-fill";
  }

  try {
    const summary = await request(
      `${apiBase}/hydration/daily-summary?date=${encodeURIComponent(date)}&user_id=${encodeURIComponent(currentUserId)}`,
    );
    if (activeRequestId !== hydrationSummaryRequestId) {
      return;
    }
    hydrationStatus.textContent = "Hazır";
    applyHydrationSummary(summary);
    setHydrationFeedbackMessage(summary.feedback, summary);
    if (hydrationModalMode === "weekly") {
      void loadHydrationWeeklyStats(date);
    }
  } catch (error) {
    if (activeRequestId !== hydrationSummaryRequestId) {
      return;
    }
    currentHydrationSummary = null;
    hydrationStatus.textContent = error.status === 404 ? "Kurulum gerekli" : "Hata";
    hydrationSummaryContainer.className = "report-view empty-state";
    hydrationSummaryContainer.textContent =
      error.status === 404
        ? "Su hedefini görmek için önce su ayarlarını kaydet."
        : error.message;
    hydrationLogsContainer.className = "meal-list empty-state";
    hydrationLogsContainer.textContent = "Su kaydı bulunamadı.";
    refreshHydrationModalIfReady();
  }
}

async function createHydrationLog({ amount, unit, note }) {
  if (!amount || Number(amount) <= 0) {
    setMessage(hydrationFeedback, "Önce geçerli bir su miktarı gir.", "error");
    return;
  }

  const activeRequestId = ++hydrationSummaryRequestId;
  setMessage(hydrationFeedback, "Su girişi kaydediliyor...", "loading");

  try {
    const payload = await request(`${apiBase}/hydration/log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: currentUserId,
        amount,
        unit,
        note,
      }),
    });

    if (activeRequestId !== hydrationSummaryRequestId) {
      return;
    }

      hydrationAmountInput.value = "";
      hydrationNoteInput.value = "";
      hydrationStatus.textContent = "Hazır";
      applyHydrationSummary(payload.summary);
      setHydrationFeedbackMessage(payload.feedback, payload.summary, { justLogged: true });
      setDailyCommandFeedbackFromHydration(payload.summary);
      if (hydrationModalMode === "weekly") {
        await loadHydrationWeeklyStats(mealDateInput.value);
      }
    await loadDailyCommand(mealDateInput.value);
    refreshHydrationModalIfReady();
    await completeDailyActionByType("add_water");
  } catch (error) {
    if (activeRequestId !== hydrationSummaryRequestId) {
      return;
    }
    setMessage(hydrationFeedback, error.message, "error");
  }
}

async function deleteHydrationLog(logId) {
  setMessage(hydrationFeedback, "Su kaydı siliniyor...", "loading");
  dailyCommandFeedbackState = null;

  try {
    await request(
      `${apiBase}/hydration/log/${encodeURIComponent(logId)}?user_id=${encodeURIComponent(currentUserId)}`,
      {
        method: "DELETE",
      },
    );
    setMessage(hydrationFeedback, "Su kaydı silindi. Özet güncellendi.", "success");
    await loadHydrationSummary(mealDateInput.value, { preserveShell: true });
    if (hydrationModalMode === "weekly") {
      await loadHydrationWeeklyStats(mealDateInput.value);
    }
    await loadDailyCommand(mealDateInput.value);
  } catch (error) {
    setMessage(hydrationFeedback, error.message, "error");
  }
}

function renderHydrationSummary(summary) {
  const completionPercent = Number(summary.completion_percent || 0);
  const displayPercent = Math.min(completionPercent, 100);
  const progressGap = Number(summary.progress_gap || 0);
  const quickActionMl = resolveHydrationQuickLogPrimaryMl(summary);
  const quickActionOptions = resolveHydrationQuickLogAlternatives(quickActionMl).slice(0, 3);
  hydrationProgressFill.style.width = `${displayPercent}%`;
  hydrationProgressFill.className = `hydration-progress-fill ${hydrationProgressClass(summary)}`.trim();

  hydrationSummaryContainer.className = "report-view";
  hydrationSummaryContainer.innerHTML = `
      <div class="hydration-schedule-banner ${hydrationTimeStatusClass(summary.time_status, progressGap)}">
        <strong>${escapeHtml(hydrationTimeStatusLabel(summary.time_status))}</strong>
        <p>${escapeHtml(hydrationScheduleLine(summary))}</p>
      </div>
      <div class="hydration-progress-hero">
        <div>
          <strong class="hydration-progress-hero-value">${completionPercent.toFixed(0)}%</strong>
          <p class="hydration-progress-hero-detail">${Number(summary.consumed_ml).toFixed(0)} / ${Number(summary.target_ml).toFixed(0)} ml</p>
        </div>
        <span class="badge badge-soft hydration-progress-status">${escapeHtml(hydrationStatusLabel(summary.status))}</span>
      </div>
      ${
        quickActionMl > 0
          ? `
            <button type="button" class="button-primary hydration-primary-cta" data-role="hydration-next-action" data-amount="${quickActionMl}">
              <span>${escapeHtml(hydrationQuickActionLabel(summary))}</span>
              <small>${quickActionMl} ml</small>
            </button>
          `
          : ""
      }
      ${
        quickActionOptions.length
          ? `
            <div class="hydration-inline-actions">
              ${quickActionOptions
                .map(
                  (amount) => `
                    <button type="button" class="button-secondary hydration-inline-action" data-role="hydration-inline-action" data-amount="${amount}">
                      +${amount}
                    </button>
                  `,
                )
                .join("")}
            </div>
          `
          : ""
      }
    `;

  const quickActionButton = hydrationSummaryContainer.querySelector('[data-role="hydration-next-action"]');
  if (quickActionButton) {
    quickActionButton.addEventListener("click", () => {
      void createHydrationLog({
        amount: Number(quickActionButton.dataset.amount),
        unit: "ml",
        note: null,
        });
      });
    }
  hydrationSummaryContainer.querySelectorAll('[data-role="hydration-inline-action"]').forEach((button) => {
    button.addEventListener("click", () => {
      void createHydrationLog({
        amount: Number(button.dataset.amount),
        unit: "ml",
        note: null,
      });
    });
  });
}

function renderHydrationLogs(logs) {
  if (!logs?.length) {
    hydrationLogsContainer.className = "meal-list empty-state";
    hydrationLogsContainer.textContent = "Bugün henüz su kaydı yok.";
    return;
  }

  hydrationLogsContainer.className = "meal-list";
  hydrationLogsContainer.innerHTML = logs
    .map(
      (log) => `
        <article class="meal-card">
          <div class="hydration-log-row">
            <div>
              <strong>${escapeHtml(formatHydrationSourceValue(log))}</strong>
              <div class="hydration-log-meta">${escapeHtml(log.logged_at.slice(11, 16))}${log.note ? ` | ${escapeHtml(log.note)}` : ""}</div>
            </div>
            <button type="button" class="icon-button" data-role="hydration-delete" data-log-id="${escapeHtml(log.id)}">Sil</button>
          </div>
        </article>
      `,
    )
    .join("");

  hydrationLogsContainer.querySelectorAll('[data-role="hydration-delete"]').forEach((button) => {
    button.addEventListener("click", () => {
      void deleteHydrationLog(button.dataset.logId);
    });
  });
}

function formatHydrationSourceValue(log) {
  const value = Number(log.source_value || 0);
  if (log.source_unit === "glass") {
    return `${trimTrailingZero(value)} bardak`;
  }
  if (log.source_unit === "liter") {
    return `${trimTrailingZero(value)} L`;
  }
  return `${Number(log.amount_ml).toFixed(0)} ml`;
}

function hydrationStatusLabel(status) {
  if (status === "above_target") {
    return "Üstte";
  }
  if (status === "complete") {
    return "Tamam";
  }
  if (status === "on_track") {
    return "Dengede";
  }
  return "Geride";
}

function hydrationStatusText(summary) {
  if (summary?.time_status === "ahead") {
    return "Su ritmin planın önünde";
  }
  if (summary?.time_status === "behind_schedule") {
    return "Su ritmin planın gerisinde";
  }
  if (summary?.status === "above_target") {
    return "Bugün hedefin üstündesin";
  }
  if (summary?.status === "complete") {
    return "Bugünkü su hedefi tamamlandı";
  }
  if (summary?.status === "on_track") {
    return "Bugün iyi gidiyorsun";
  }
  return "Su ritmin dengede";
}

function hydrationScoreLabel(score) {
  const numericScore = Number(score || 0);
  if (numericScore >= 90) {
    return "Çok iyi";
  }
  if (numericScore >= 60) {
    return "İyi gidiyor";
  }
  return "Toparlanmalı";
}

function hydrationTimeStatusLabel(status) {
  if (status === "ahead") {
    return "Önde";
  }
  if (status === "behind_schedule") {
    return "Geride";
  }
  return "Dengede";
}

function hydrationTimeStatusHeadline(status) {
  if (status === "ahead") {
    return "Tempo yüksek";
  }
  if (status === "behind_schedule") {
    return "Şimdi toparla";
  }
  return "Çizgidesin";
}

function hydrationGapText(progressGap) {
  const absGap = Math.abs(Number(progressGap || 0));
  if (absGap < 0.5) {
    return "tam dengede";
  }
  if (progressGap > 0) {
    return `%${absGap.toFixed(0)} öndesin`;
  }
  return `%${absGap.toFixed(0)} geridesin`;
}

function hydrationGapMetric(progressGap) {
  if (Math.abs(Number(progressGap || 0)) < 0.5) {
    return "0%";
  }
  const prefix = progressGap > 0 ? "+" : "";
  return `${prefix}${Number(progressGap).toFixed(0)}%`;
}

function hydrationQuickActionLabel(summary) {
  const suggestedMl = Number(summary?.next_action?.suggested_ml || 0);
  if (suggestedMl <= 0) {
    return "Şimdi iç";
  }
  return "Şimdi iç";
}

function hydrationTimeStatusClass(timeStatus, progressGap = 0) {
  if (timeStatus === "ahead") {
    return "is-ahead";
  }
  if (timeStatus === "behind_schedule") {
    return Number(progressGap) <= -20 ? "is-behind-hard" : "is-behind-soft";
  }
  return "is-on-track";
}

function hydrationProgressClass(summary) {
  if (summary.status === "above_target") {
    return "is-above";
  }
  if (summary.status === "complete") {
    return "is-complete";
  }
  return hydrationTimeStatusClass(summary.time_status, summary.progress_gap);
}

function hydrationFeedbackTone(summary) {
  if (summary?.time_status === "behind_schedule") {
    return "error";
  }
  if (
    summary?.status === "complete" ||
    summary?.status === "above_target" ||
    summary?.time_status === "ahead" ||
    summary?.time_status === "on_track"
  ) {
    return "success";
  }
  return "loading";
}

function resolveHydrationFeedbackMessage(summary, feedback, { justLogged = false } = {}) {
  if (!summary) {
    return feedback?.message || "";
  }
  if (justLogged) {
    if (summary.status === "complete" || summary.status === "above_target") {
      return "Kontrol sende.";
    }
    if (summary.time_status === "ahead") {
      return "Öndesin. Bu seviyeyi koru.";
    }
    if (summary.time_status === "on_track") {
      return "Ritmi yakaladın.";
    }
    return "Şimdi doğru gidiyorsun.";
  }
  if (summary.status === "complete" || summary.status === "above_target") {
    return "Kontrol sende.";
  }
  if (summary.time_status === "ahead") {
    return "Mükemmel tempo.";
  }
  if (summary.time_status === "on_track") {
    return "Ritmi yakaladın.";
  }
  if (Number(summary.progress_gap || 0) >= -8) {
    return "Çizgiye girdin.";
  }
  return "Geridesin. Hemen toparla.";
}

function setHydrationFeedbackMessage(feedback, summary = null, options = {}) {
  if (!feedback) {
    return;
  }
  const message = resolveHydrationFeedbackMessage(summary, feedback, options);
  setMessage(
    hydrationFeedback,
    message,
    options.justLogged ? "success" : hydrationFeedbackTone(summary),
  );
}

function hydrationScheduleLine(summary) {
  const expectedPercent = Number(summary?.expected_progress_percent || 0).toFixed(0);
  if (summary?.time_status === "on_track") {
    return `Plan %${expectedPercent}`;
  }
  return `Plan %${expectedPercent} · ${hydrationGapText(summary?.progress_gap)}`;
}

function resolveHydrationWeeklyInsight(stats) {
  if (!stats?.days?.length) {
    return "";
  }

  const days = stats.days.map((day) => ({
    consumedMl: Number(day.consumed_ml || 0),
    reachedTarget: Boolean(day.reached_target),
  }));
  const firstWindow = days.slice(0, 3);
  const lastWindow = days.slice(-3);
  const average = (items) =>
    items.length ? items.reduce((total, item) => total + item.consumedMl, 0) / items.length : 0;
  const firstAverage = average(firstWindow);
  const lastAverage = average(lastWindow);
  const lastWindowHits = lastWindow.filter((day) => day.reachedTarget).length;

  if (lastWindowHits >= 3) {
    return "Son 3 gün güçlü.";
  }
  if (Number(stats.goal_reached_days || 0) >= 4 || lastAverage >= firstAverage + 200) {
    return "Bu hafta daha düzenlisin.";
  }
  if (lastAverage <= Math.max(firstAverage - 200, 0)) {
    return "Hafta başına göre düşüş var.";
  }
  return "Ritmi koru.";
}

function applyHydrationSummary(summary) {
  currentHydrationSummary = summary;
  renderHydrationSummary(summary);
  renderHydrationLogs(summary.logs || []);
  refreshHydrationModalIfReady();
}

async function loadDailyCommand(date) {
  const activeRequestId = ++dailyCommandRequestId;
  dailyCommandStatus.textContent = currentDailyCommand ? "Güncelleniyor..." : "Yükleniyor...";
  if (!currentDailyCommand) {
    dailyCommandCard.className = "report-view empty-state";
    dailyCommandCard.textContent = "Komut hazırlanıyor...";
  }

  try {
    const payload = await request(
      `${apiBase}/dashboard/daily-command?date=${encodeURIComponent(date)}&user_id=${encodeURIComponent(currentUserId)}&protein_target_g=${encodeURIComponent(Number(currentNutritionTargets.protein_target_g || defaultProteinTarget))}&calorie_target_kcal=${encodeURIComponent(Number(currentNutritionTargets.calorie_target_kcal || defaultCalorieTarget))}`,
    );
    if (activeRequestId !== dailyCommandRequestId) {
      return;
    }
    currentDailyCommand = payload;
    dailyCommandStatus.textContent = "Hazır";
    renderDailyCommandCard(payload);
  } catch (error) {
    if (activeRequestId !== dailyCommandRequestId) {
      return;
    }
    currentDailyCommand = null;
    dailyCommandStatus.textContent = error.status === 404 ? "Kurulum gerekli" : "Hata";
    dailyCommandCard.className = "report-view empty-state";
    dailyCommandCard.textContent =
      error.status === 404
        ? "Komut merkezi için önce hedeflerini hazırla."
        : "Komut merkezi şu an alınamadı.";
  }
}

function renderDailyCommandCard(command) {
  if (!command?.primary_action || !command?.sub_status || !command?.metrics) {
    currentDailyCommand = null;
    dailyCommandCard.className = "report-view empty-state";
    dailyCommandCard.textContent = "Komut merkezi için veri eksik.";
    return;
  }

  const metrics = command.metrics;
  const hydrationActionMl = Number(command.hydration_quick_add_ml || 0);
  const summaryText = resolveDailyCommandSummary(command);
  const hasLiveFeedback =
    dailyCommandFeedbackState &&
    dailyCommandFeedbackState.expiresAt > Date.now() &&
    (!dailyCommandFeedbackState.domain || dailyCommandFeedbackState.domain === command.primary_domain);
  const primaryText = hasLiveFeedback ? summaryText : command.primary_action;
  currentDailyCommand = command;
  dailyCommandCard.className = `report-view command-card ${priorityClass(command.priority)}`;
  dailyCommandCard.innerHTML = `
    <div class="command-card-topline">
      <span class="action-bar-label">Bugünkü komut</span>
      <span class="priority-pill ${priorityClass(command.priority)}">${escapeHtml(commandPriorityLabel(command.priority))}</span>
    </div>
    <div class="command-card-primary-shell">
      <strong class="command-card-primary">${escapeHtml(primaryText)}</strong>
    </div>
    <div class="command-chip-row">
      ${commandStatusChip("Protein", command.sub_status.protein, metrics.protein_percent)}
      ${commandStatusChip("Kalori", command.sub_status.calories, metrics.calorie_percent)}
      ${commandStatusChip("Su", command.sub_status.hydration, metrics.hydration_percent)}
    </div>
    ${
      command.primary_domain === "hydration" && hydrationActionMl > 0
        ? `
          <div class="command-action-row">
            <button
              type="button"
              class="command-cta-button"
              data-role="command-hydration-action"
              data-amount="${hydrationActionMl}"
            >
              +${hydrationActionMl} ml iç
            </button>
          </div>
        `
        : ""
    }
  `;

  const hydrationActionButton = dailyCommandCard.querySelector('[data-role="command-hydration-action"]');
  if (hydrationActionButton) {
    hydrationActionButton.addEventListener("click", () => {
      void createHydrationLog({
        amount: Number(hydrationActionButton.dataset.amount),
        unit: "ml",
        note: null,
      });
    });
  }
}

function commandStatusChip(label, status, percent) {
  return `
    <div class="command-chip ${commandStatusClass(status)}">
      <span>${escapeHtml(label)}</span>
      <strong>%${Number(percent || 0).toFixed(0)}</strong>
    </div>
  `;
}

function commandPriorityLabel(priority) {
  if (priority === "high") {
    return "Yüksek";
  }
  if (priority === "medium") {
    return "Orta";
  }
  return "Sakin";
}

function commandStatusLabel(status) {
  if (status === "behind" || status === "low") {
    return "geride";
  }
  if (status === "high") {
    return "yüksek";
  }
  if (status === "ahead") {
    return "önde";
  }
  return "dengede";
}

function commandStatusClass(status) {
  if (status === "behind" || status === "low") {
    return "command-chip-behind";
  }
  if (status === "high") {
    return "command-chip-high";
  }
  if (status === "ahead") {
    return "command-chip-ahead";
  }
  return "command-chip-on-track";
}

function setDailyCommandFeedback(message, domain = null, ttlMs = 8000) {
  dailyCommandFeedbackState = {
    message,
    domain,
    expiresAt: Date.now() + ttlMs,
  };
}

function resolveDailyCommandSummary(command) {
  if (
    dailyCommandFeedbackState &&
    dailyCommandFeedbackState.expiresAt > Date.now() &&
    (!dailyCommandFeedbackState.domain || dailyCommandFeedbackState.domain === command.primary_domain)
  ) {
    return dailyCommandFeedbackState.message;
  }

  if (dailyCommandFeedbackState && dailyCommandFeedbackState.expiresAt <= Date.now()) {
    dailyCommandFeedbackState = null;
  }

  return command.overall_status || "Bugünü net bir hamleyle toparla.";
}

function setDailyCommandFeedbackFromHydration(summary) {
  if (!summary) {
    return;
  }

  let message = "Plan çalışıyor.";
  if (summary.status === "complete" || summary.status === "above_target" || summary.time_status === "ahead") {
    message = "Kontrol sende.";
  } else if (summary.time_status === "on_track") {
    message = "Ritmi yakaladın.";
  } else if (summary.time_status === "behind_schedule") {
    message = "Şimdi doğru gidiyorsun.";
  }

  setDailyCommandFeedback(message, "hydration");
  if (currentDailyCommand) {
    renderDailyCommandCard(currentDailyCommand);
  }
}

function trimTrailingZero(value) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

function buildUserProfilePayload() {
  return {
    user_id: currentUserId,
    weight_kg: Number(profileWeightInput.value),
    height_cm: Number(profileHeightInput.value),
    age: Number(profileAgeInput.value),
    gender: profileGenderInput.value,
    activity_level: profileActivityInput.value,
    training_frequency_per_week: Number(profileTrainingFrequencyInput.value),
    goal: profileGoalInput.value,
  };
}

function populateUserProfileForm(profile) {
  profileWeightInput.value = profile.weight_kg ?? "";
  profileHeightInput.value = profile.height_cm ?? "";
  profileAgeInput.value = profile.age ?? "";
  profileGenderInput.value = profile.gender ?? "male";
  profileActivityInput.value = profile.activity_level ?? "moderate";
  profileTrainingFrequencyInput.value = profile.training_frequency_per_week ?? 3;
  profileGoalInput.value = profile.goal ?? "maintenance";
}

function renderGoalTargets(goals, goal) {
  if (!goals) {
    currentNutritionTargets = {
      protein_target_g: defaultProteinTarget,
      calorie_target_kcal: defaultCalorieTarget,
    };
    goalTargetsContainer.className = "report-view empty-state";
    goalTargetsContainer.textContent = "Hedefler henuz hesaplanmadi.";
    return;
  }

  currentNutritionTargets = {
    protein_target_g: Number(goals.protein?.grams || defaultProteinTarget),
    calorie_target_kcal: Number(goals.calorie_target_kcal || defaultCalorieTarget),
  };
  goalTargetsContainer.className = "report-view";
  goalTargetsContainer.innerHTML = `
    <div class="summary-grid">
      ${metricCard("BMR", `${Number(goals.bmr_kcal).toFixed(0)} kcal`, "Mifflin-St Jeor")}
      ${metricCard("TDEE", `${Number(goals.tdee_kcal).toFixed(0)} kcal`, `Aktivite carpani ${Number(goals.activity_multiplier).toFixed(3)}`)}
      ${metricCard("Kalori hedefi", `${Number(goals.calorie_target_kcal).toFixed(0)} kcal`, `${goalLabel(goal)} | ${Number(goals.calorie_adjustment_kcal).toFixed(0)} kcal ayar`)}
      ${metricCard("Karbonhidrat", `${Number(goals.carbs_g).toFixed(1)} g`, `${Number(goals.carbs_kcal).toFixed(0)} kcal`)}
    </div>
    <section class="target-breakdown">
      <article class="report-section">
        <p class="label">Protein</p>
        <strong>${Number(goals.protein.grams).toFixed(1)} g</strong>
        <p>${escapeHtml(goals.protein.rationale)}</p>
        <p class="inline-note">${Number(goals.protein.grams_per_kg).toFixed(1)} g/kg | ${Number(goals.protein.calories).toFixed(0)} kcal</p>
      </article>
      <article class="report-section">
        <p class="label">Yag</p>
        <strong>${Number(goals.fat.grams).toFixed(1)} g</strong>
        <p>${escapeHtml(goals.fat.rationale)}</p>
        <p class="inline-note">${Number(goals.fat.grams_per_kg).toFixed(1)} g/kg | ${Number(goals.fat.calories).toFixed(0)} kcal</p>
      </article>
      <article class="report-section">
        <p class="label">Acilama</p>
        <ul class="bullet-list">
          ${(goals.explanations || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
        </ul>
      </article>
    </section>
  `;
}

function goalLabel(goal) {
  const normalized = String(goal || "").toLowerCase();
  if (normalized === "fat_loss") {
    return "Yag kaybi";
  }
  if (normalized === "muscle_gain") {
    return "Kas kazanimi";
  }
  if (normalized === "recomposition") {
    return "Recomp";
  }
  return "Koruma";
}

function scheduleRealtimeNutritionParse() {
  if (nutritionParseTimer) {
    window.clearTimeout(nutritionParseTimer);
  }

  nutritionParseTimer = window.setTimeout(() => {
    void runRealtimeNutritionParse();
  }, 300);
}

function scheduleNutritionRecalculation(immediate = false) {
  if (nutritionRecalculateTimer) {
    window.clearTimeout(nutritionRecalculateTimer);
  }

  if (immediate) {
    void recalculateNutritionDraft();
    return;
  }

  nutritionRecalculateTimer = window.setTimeout(() => {
    void recalculateNutritionDraft();
  }, 180);
}

function clearNutritionAnalysisState() {
  nutritionDraftItems = [];
  nutritionMealTotals = null;
  nutritionClarificationQuestions = [];
  nutritionStatus.textContent = "Bekleniyor";
  nutritionClarifications.className = "message-box empty-state";
  nutritionClarifications.textContent = "Belirsiz porsiyon varsa burada netleÅŸtirme uyarÄ±larÄ± gÃ¶rÃ¼nÃ¼r.";
  nutritionResult.className = "analysis-view empty-state";
  nutritionResult.innerHTML =
    "3 yumurta, 150 g tavuk gÃ¶ÄŸsÃ¼, 1 kase pilav gibi giriÅŸler burada temiz kartlar halinde gÃ¶sterilir.";
}

async function runRealtimeNutritionParse() {
  const text = nutritionInput.value.trim();
  const requestId = ++nutritionParseRequestId;

  if (!text) {
    clearNutritionAnalysisState();
    return;
  }

  nutritionStatus.textContent = "AyrÄ±ÅŸtÄ±rÄ±lÄ±yor...";
  nutritionClarifications.className = "message-box message-loading";
  nutritionClarifications.textContent = "Besinler yazdÄ±kÃ§a ayrÄ±ÅŸtÄ±rÄ±lÄ±yor...";
  nutritionResult.innerHTML = '<p class="muted-text">Besin kartlarÄ± hazÄ±rlanÄ±yor...</p>';

  try {
    const parseResponse = await request(`${apiBase}/nutrition/parse`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text,
        user_id: currentUserId,
      }),
    });

    if (requestId !== nutritionParseRequestId) {
      return;
    }

    nutritionDraftItems = parseResponse.parsed_items || [];
    nutritionClarificationQuestions = parseResponse.clarification_questions || [];
    renderNutritionClarificationsV2(nutritionClarificationQuestions);
    await recalculateNutritionDraft(requestId);
  } catch (error) {
    if (requestId !== nutritionParseRequestId) {
      return;
    }

    nutritionStatus.textContent = "Hata";
    nutritionResult.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
    nutritionClarifications.className = "message-box message-error";
    nutritionClarifications.textContent = error.message;
  }
}


function scheduleNutritionSuggestions() {
  const segment = getCurrentNutritionSegment();
  if (!segment || segment.length < 1) {
    nutritionSuggestions.classList.add("hidden");
    nutritionSuggestions.innerHTML = "";
    return;
  }

  if (nutritionSuggestTimer) {
    window.clearTimeout(nutritionSuggestTimer);
  }

  nutritionSuggestTimer = window.setTimeout(() => {
    void loadNutritionSuggestions(segment);
  }, 180);
}

async function loadNutritionSuggestions(segment) {
  try {
    const payload = await request(
      `${apiBase}/nutrition/suggest?q=${encodeURIComponent(segment)}&user_id=${encodeURIComponent(currentUserId)}`,
    );
    renderNutritionSuggestions(payload.suggestions || []);
  } catch (error) {
    nutritionSuggestions.classList.add("hidden");
    nutritionSuggestions.innerHTML = "";
  }
}

function renderNutritionSuggestions(suggestions) {
  if (!suggestions.length) {
    nutritionSuggestions.classList.add("hidden");
    nutritionSuggestions.innerHTML = "";
    return;
  }

  nutritionSuggestions.classList.remove("hidden");
  nutritionSuggestions.innerHTML = `
    <div class="autocomplete-list">
      ${suggestions
        .map(
          (item) => `
            <button
              type="button"
              class="autocomplete-item"
              data-role="nutrition-suggestion"
              data-insert-text="${escapeHtml(item.insert_text)}"
            >
              <span>
                <strong>${escapeHtml(displayFoodName(item))}</strong>
                <span class="suggestion-meta">
                  <span>${escapeHtml(item.matched_text)}</span>
                  ${item.usage_count ? `<span>${item.usage_count} kez</span>` : ""}
                </span>
              </span>
              <span class="suggestion-pill ${suggestionPillClass(item.source)}">${escapeHtml(suggestionSourceLabel(item.source))}</span>
            </button>
          `,
        )
        .join("")}
    </div>
  `;

  nutritionSuggestions.querySelectorAll('[data-role="nutrition-suggestion"]').forEach((button) => {
    button.addEventListener("click", () => {
      applySuggestionToNutritionInput(button.dataset.insertText || "");
      nutritionSuggestions.classList.add("hidden");
      nutritionSuggestions.innerHTML = "";
      nutritionInput.focus();
    });
  });
}

function getCurrentNutritionSegment() {
  const value = nutritionInput.value;
  const segments = value.split(/[,;\n]/);
  return segments.at(-1)?.trim() || "";
}

function applySuggestionToNutritionInput(insertText) {
  const value = nutritionInput.value;
  const match = value.match(/^(.*?)([^,\n;]*)$/s);
  if (!match) {
    nutritionInput.value = insertText;
    scheduleRealtimeNutritionParse();
    return;
  }

  const prefix = preserveSegmentPrefix(match[2]);
  const replacement = `${prefix}${insertText}`.trim();
  nutritionInput.value = `${match[1]}${replacement}`;
  scheduleRealtimeNutritionParse();
}

function preserveSegmentPrefix(segment) {
  const trimmed = segment.trim();
  if (!trimmed) {
    return "";
  }

  const prefixMatch = trimmed.match(
    /^((?:\d+(?:[.,]\d+)?|bir|iki|uc|dort|bes|alti|yedi|sekiz|dokuz|on|yarim)\s+(?:g|gr|gram|kg|kilo|adet|tane|dilim|kase|tabak|bardak|olcek|porsiyon)?\s*(?:kucuk|orta|buyuk|ince|kalin)?\s*)/i,
  );
  if (!prefixMatch) {
    return "";
  }
  return prefixMatch[1];
}

async function loadDocuments() {
  documentsContainer.innerHTML = '<p class="muted-text">Loading documents...</p>';

  try {
    const payload = await request(`${apiBase}/documents`);

    if (!payload.length) {
      documentsContainer.innerHTML = '<p class="muted-text">No documents uploaded yet.</p>';
      return;
    }

    documentsContainer.innerHTML = "";
    payload.forEach((documentItem) => {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "document-card";
      item.innerHTML = `
        <strong>${escapeHtml(documentItem.filename)}</strong>
        <span>${escapeHtml(documentItem.document_id)}</span>
        <span>${documentItem.chunk_count} chunks</span>
      `;
      item.addEventListener("click", () => {
        documentIdInput.value = documentItem.document_id;
      });
      documentsContainer.appendChild(item);
    });
  } catch (error) {
    documentsContainer.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
  }
}

function renderChat(payload) {
  const sources = (payload.sources || [])
    .map((source) => {
      const bits = [];
      if (source.filename) {
        bits.push(source.filename);
      }
      if (source.page) {
        bits.push(`p.${source.page}${source.page_end && source.page_end !== source.page ? `-${source.page_end}` : ""}`);
      }
      if (source.chapter) {
        bits.push(source.chapter);
      }
      if (source.section) {
        bits.push(source.section);
      }
      return `<li>${escapeHtml(bits.join(" | ") || source.vector_id)}</li>`;
    })
    .join("");

  chatResult.innerHTML = `
    <div class="chat-answer">
      <p class="label">Answer</p>
      <p>${escapeHtml(payload.answer)}</p>
    </div>
    <div class="chat-meta">
      <p><strong>Supported:</strong> ${payload.answer_supported ? "Yes" : "No"}</p>
      <p><strong>Retrieved chunks:</strong> ${payload.retrieved_chunk_count}</p>
    </div>
    <div class="source-list">
      <p class="label">Sources</p>
      <ul>${sources || "<li>No sources returned.</li>"}</ul>
    </div>
  `;
}

function renderAnalysis(analysis) {
  const scoreCards = [
    metricCard("Hypertrophy Score", `${analysis.hypertrophy_score}/100`, analysis.overall_interpretation),
    metricCard("Fatigue Risk", titleCase(analysis.fatigue_risk), analysis.score_breakdown.fatigue_balance.explanation),
    metricCard("Estimated RIR", `${Number(analysis.estimated_rir_level.estimated_average_rir).toFixed(2)}`, analysis.estimated_rir_level.interpretation),
  ].join("");

  const breakdownCards = [
    breakdownCard("Volume", analysis.score_breakdown.weekly_volume_adequacy),
    breakdownCard("Frequency", analysis.score_breakdown.frequency_adequacy),
    breakdownCard("Effort", analysis.score_breakdown.estimated_effort_quality),
    breakdownCard("Exercise Selection", analysis.score_breakdown.exercise_selection_quality),
    breakdownCard("Fatigue Balance", analysis.score_breakdown.fatigue_balance),
  ].join("");

  const strengths = listItems(analysis.main_strengths);
  const limiters = listItems(analysis.main_limiters);
  const actions = (analysis.next_best_actions || [])
    .map(
      (action) => `
        <article class="action-card">
          <div class="action-header">
            <strong>${escapeHtml(action.title)}</strong>
            <span class="priority-pill ${priorityClass(action.priority)}">${escapeHtml(titleCase(action.priority))}</span>
          </div>
          <p>${escapeHtml(action.description)}</p>
        </article>
      `,
    )
    .join("");

  const metricsRows = Object.keys(analysis.weekly_volume_per_muscle_group || {})
    .sort()
    .map((muscle) => {
      const sets = analysis.weekly_volume_per_muscle_group[muscle];
      const frequency = analysis.frequency_per_muscle_group[muscle] ?? 0;
      return `
        <tr>
          <td>${escapeHtml(titleCase(muscle))}</td>
          <td>${Number(sets).toFixed(2)}</td>
          <td>${frequency}x</td>
        </tr>
      `;
    })
    .join("");

  analysisResult.innerHTML = `
    <div class="score-grid">${scoreCards}</div>
    <section class="subsection">
      <h3>Score Breakdown</h3>
      <div class="breakdown-grid">${breakdownCards}</div>
    </section>
    <section class="subsection two-col">
      <div>
        <h3>Strengths</h3>
        ${strengths}
      </div>
      <div>
        <h3>Limiters</h3>
        ${limiters}
      </div>
    </section>
    <section class="subsection">
      <h3>Key Metrics</h3>
      <table class="metrics-table">
        <thead>
          <tr>
            <th>Muscle Group</th>
            <th>Weekly Volume</th>
            <th>Frequency</th>
          </tr>
        </thead>
        <tbody>
          ${metricsRows || '<tr><td colspan="3">No muscle metrics available.</td></tr>'}
        </tbody>
      </table>
    </section>
    <section class="subsection">
      <h3>Next Best Actions</h3>
      <div class="actions-list">${actions || '<p class="muted-text">No actions generated.</p>'}</div>
    </section>
  `;
}

function renderReport(report) {
  const sectionsHtml = (report.report_sections || [])
    .map((section) => {
      const bullets = section.bullets?.length
        ? `<ul class="bullet-list">${section.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
        : "";
      const metrics = section.metrics?.length
        ? `<div class="report-metrics">${section.metrics
            .map(
              (metric) => `
                <article class="mini-metric">
                  <strong>${escapeHtml(metric.label)}</strong>
                  <span>${escapeHtml(metric.value)}</span>
                  ${metric.detail ? `<p>${escapeHtml(metric.detail)}</p>` : ""}
                </article>
              `,
            )
            .join("")}</div>`
        : "";
      const actions = section.actions?.length
        ? `<div class="actions-list">${section.actions
            .map(
              (action) => `
                <article class="action-card">
                  <div class="action-header">
                    <strong>${escapeHtml(action.title)}</strong>
                    <span class="priority-pill ${priorityClass(action.priority)}">${escapeHtml(titleCase(action.priority))}</span>
                  </div>
                  <p>${escapeHtml(action.description)}</p>
                </article>
              `,
            )
            .join("")}</div>`
        : "";

      return `
        <section class="report-section">
          <h3>${escapeHtml(section.title)}</h3>
          ${section.summary ? `<p>${escapeHtml(section.summary)}</p>` : ""}
          ${bullets}
          ${metrics}
          ${actions}
        </section>
      `;
    })
    .join("");

  reportResult.innerHTML = `
    <div class="report-sections">${sectionsHtml}</div>
    <section class="subsection">
      <h3>Formatted Report Text</h3>
      <pre class="report-text">${escapeHtml(report.report_text)}</pre>
    </section>
  `;
}

async function recalculateNutritionDraft(requestId = null) {
  if (!nutritionDraftItems.length) {
    nutritionMealTotals = null;
    nutritionStatus.textContent = "Bekleniyor";
    nutritionClarifications.className = "message-box empty-state";
    nutritionClarifications.textContent = "Ã–ÄŸÃ¼n ekledikÃ§e ayrÄ±ÅŸtÄ±rÄ±lmÄ±ÅŸ satÄ±rlar burada gÃ¶rÃ¼nÃ¼r.";
    nutritionResult.className = "analysis-view empty-state";
    nutritionResult.innerHTML =
      "3 yumurta, 150 g tavuk gÃ¶ÄŸsÃ¼, 1 kase pilav gibi giriÅŸler burada temiz kartlar halinde gÃ¶sterilir.";
    return;
  }

  const activeRequestId = requestId ?? ++nutritionRecalculateRequestId;
  nutritionStatus.textContent = "Makrolar hesaplanÄ±yor...";

  try {
    const calculation = await request(`${apiBase}/nutrition/calculate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        items: nutritionDraftItems,
      }),
    });

    if (requestId === null && activeRequestId !== nutritionRecalculateRequestId) {
      return;
    }
    if (requestId !== null && activeRequestId !== nutritionParseRequestId) {
      return;
    }

    nutritionDraftItems = calculation.items;
    nutritionMealTotals = calculation.meal_totals;
    nutritionStatus.textContent = calculation.needs_clarification ? "DoÄŸrulama gerekli" : "HazÄ±r";
    renderNutritionAnalysisV2(calculation);
    nutritionClarificationQuestions = mergeClarificationQuestions(
      nutritionClarificationQuestions,
      calculation.clarification_questions || [],
    );
    renderNutritionClarificationsV2(nutritionClarificationQuestions);
  } catch (error) {
    nutritionStatus.textContent = "Hata";
    nutritionResult.innerHTML = `<p class="error-text">${escapeHtml(error.message)}</p>`;
    nutritionClarifications.className = "message-box message-error";
    nutritionClarifications.textContent = error.message;
  }
}

function renderNutritionAnalysis(calculation) {
  const itemsHtml = (calculation.items || [])
    .map((item, index) => {
      const nutrition = item.nutrition
        ? `
          <div class="macro-line">
            <span>${Number(item.nutrition.kcal).toFixed(0)} kcal</span>
            <span>P ${Number(item.nutrition.protein_g).toFixed(1)} g</span>
            <span>K ${Number(item.nutrition.carbs_g).toFixed(1)} g</span>
            <span>Y ${Number(item.nutrition.fat_g).toFixed(1)} g</span>
          </div>
        `
        : `<p class="error-text">Makro hesabÄ± iÃ§in net porsiyon gerekli.</p>`;

      return `
        <article class="nutrition-card">
          <div class="nutrition-card-header">
            <div>
              <strong>${escapeHtml(displayFoodName(item))}</strong>
              <p class="nutrition-meta">${escapeHtml(item.raw_text)}</p>
            </div>
            <span class="confidence-badge ${confidenceClass(item.confidence_level)}">${escapeHtml(confidenceLabel(item.confidence_level))}</span>
          </div>
          <div class="nutrition-meta">
            <p>Miktar: ${item.amount ?? "-"} ${escapeHtml(item.unit || "")}</p>
            <p>HazÄ±rlÄ±k: ${escapeHtml(item.preparation_method || "belirtilmedi")}</p>
            <p>GÃ¼ven skoru: ${Number(item.confidence_score).toFixed(2)}</p>
          </div>
          <div class="nutrition-card-grid">
            <label class="field-stack">
              <span>Tahmini Gram</span>
              <input
                type="number"
                min="0"
                step="1"
                value="${item.estimated_weight_g ?? ""}"
                data-role="nutrition-weight"
                data-index="${index}"
              />
            </label>
          </div>
          ${nutrition}
          ${item.calculation_basis ? `<p class="nutrition-meta">${escapeHtml(item.calculation_basis)}</p>` : ""}
        </article>
      `;
    })
    .join("");

  nutritionResult.innerHTML = `
    <div class="summary-grid">
      ${metricCard("Kalori", `${Number(calculation.meal_totals.kcal).toFixed(0)} kcal`, "Toplam Ã¶ÄŸÃ¼n enerjisi")}
      ${metricCard("Protein", `${Number(calculation.meal_totals.protein_g).toFixed(1)} g`, "Toplam protein")}
      ${metricCard("Karbonhidrat", `${Number(calculation.meal_totals.carbs_g).toFixed(1)} g`, "Toplam karbonhidrat")}
      ${metricCard("YaÄŸ", `${Number(calculation.meal_totals.fat_g).toFixed(1)} g`, "Toplam yaÄŸ")}
    </div>
    <section class="subsection">
      <h3>Besin KartlarÄ±</h3>
      <div class="nutrition-list">${itemsHtml || '<p class="muted-text">Besin bulunamadÄ±.</p>'}</div>
    </section>
  `;

  nutritionResult.querySelectorAll('[data-role="nutrition-weight"]').forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = Number(event.target.dataset.index);
      const value = event.target.value;
      nutritionDraftItems[index].estimated_weight_g = value ? Number(value) : null;
      if (nutritionDraftItems[index].estimated_weight_g) {
        nutritionDraftItems[index].needs_clarification = false;
        nutritionDraftItems[index].clarification_reason = null;
      }
      scheduleNutritionRecalculation();
    });
  });
}

function renderNutritionClarifications(questions) {
  if (!questions?.length) {
    nutritionClarifications.className = "message-box message-success";
    nutritionClarifications.textContent = "Porsiyonlar yeterince net. Ä°stersen gramlarÄ± dÃ¼zenleyip Ã¶ÄŸÃ¼nÃ¼ kaydedebilirsin.";
    return;
  }

  nutritionClarifications.className = "message-box message-error";
  nutritionClarifications.innerHTML = `
    <strong>DoÄŸrulama gerekli:</strong>
    <ul class="bullet-list">
      ${questions
        .map(
          (question) => `<li>${escapeHtml(question.question)}${question.suggested_options?.length ? ` (${escapeHtml(question.suggested_options.join(", "))})` : ""}</li>`,
        )
        .join("")}
    </ul>
  `;
}

async function loadDailySummary(date) {
  const activeRequestId = ++dailySummaryRequestId;
  const proteinTarget = Number(currentNutritionTargets.protein_target_g || defaultProteinTarget);
  const calorieTarget = Number(currentNutritionTargets.calorie_target_kcal || defaultCalorieTarget);
  currentDailyActionState = null;

  dailySummaryStatus.textContent = "YÃ¼kleniyor...";
  dailyActionBar.className = "instant-action-bar";
  dailyActionBar.innerHTML = `
    <span class="action-bar-label">Bugün için aksiyon</span>
    <strong>Karar hazırlanıyor...</strong>
  `;
  dailyCoachContainer.className = "message-box message-loading";
  dailyCoachContainer.textContent = "Günlük koç mesajı hazırlanıyor...";
  dailySummaryContainer.innerHTML = '<p class="muted-text">GÃ¼nlÃ¼k Ã¶zet yÃ¼kleniyor...</p>';

  const [summaryResult, coachResult, actionResult] = await Promise.allSettled([
    request(`${apiBase}/meals/daily-summary?date=${encodeURIComponent(date)}&user_id=${encodeURIComponent(currentUserId)}`),
    request(`${apiBase}/user/daily-coach?date=${encodeURIComponent(date)}&user_id=${encodeURIComponent(currentUserId)}&mode=balanced`),
    request(
      `${apiBase}/meals/daily-actions?date=${encodeURIComponent(date)}&user_id=${encodeURIComponent(currentUserId)}&protein_target_g=${encodeURIComponent(proteinTarget)}&calorie_target_kcal=${encodeURIComponent(calorieTarget)}`,
    ),
  ]);

  if (activeRequestId !== dailySummaryRequestId) {
    return;
  }

  if (summaryResult.status === "rejected") {
    dailySummaryStatus.textContent = "Hata";
    dailyActionBar.className = "instant-action-bar hidden";
    dailyCoachContainer.className = "message-box message-error";
    dailyCoachContainer.textContent = summaryResult.reason.message;
    dailySummaryContainer.innerHTML = `<p class="error-text">${escapeHtml(summaryResult.reason.message)}</p>`;
    return;
  }

  dailySummaryStatus.textContent = "HazÄ±r";
  renderDailySummaryV2(summaryResult.value);

  if (actionResult.status === "fulfilled") {
    renderDailyActionBar(actionResult.value);
  } else {
    currentDailyActionState = null;
    dailyActionBar.className = "instant-action-bar hidden";
    dailyActionBar.innerHTML = "";
  }

  if (coachResult.status === "fulfilled") {
    renderDailyCoach(coachResult.value);
    return;
  }

  if (coachResult.reason?.status === 404) {
    dailyCoachContainer.className = "message-box empty-state";
    dailyCoachContainer.textContent = "Gunluk AI koc icin once profilini doldur.";
    return;
  }

  dailyCoachContainer.className = "message-box message-error";
  dailyCoachContainer.textContent = coachResult.reason.message;
}

function mergeClarificationQuestions(previousQuestions, nextQuestions) {
  if (!nextQuestions?.length) {
    return [];
  }

  return nextQuestions.map((question) => {
    if (question.choices?.length) {
      return question;
    }

    const previous = (previousQuestions || []).find(
      (item) => item.item_index === question.item_index && item.raw_text === question.raw_text,
    );
    if (!previous?.choices?.length) {
      return question;
    }

    return {
      ...question,
      choices: previous.choices,
    };
  });
}

function renderDailyActionBar(action) {
  if (!action?.primary_action || !action?.action_type || !action?.priority) {
    currentDailyActionState = null;
    dailyActionBar.className = "instant-action-bar hidden";
    dailyActionBar.innerHTML = "";
    return;
  }

  currentDailyActionState = action;
  const actionsHtml = (action.actions || [])
    .map((item) => {
      const isCompleted = item.status === "completed" || (action.completed_actions || []).includes(item.action_id);
      const statusLabel = isCompleted ? "Tamamlandı" : "Hazır";
      return `
        <button
          type="button"
          class="action-button ${isCompleted ? "action-button-complete" : ""}"
          data-role="daily-action"
          data-action-id="${escapeHtml(item.action_id)}"
          data-action-type="${escapeHtml(item.type)}"
        >
          <span>${escapeHtml(item.label)}</span>
          <small>${escapeHtml(statusLabel)}</small>
        </button>
      `;
    })
    .join("");

  dailyActionBar.className = `instant-action-bar priority-${escapeHtml(action.priority)}`;
  dailyActionBar.innerHTML = `
    <div class="action-bar-topline">
      <span class="action-bar-label">Bugün için aksiyon</span>
      <div class="action-bar-meta">
        <span class="priority-pill ${priorityClass(action.priority)}">${escapeHtml(titleCase(action.priority))}</span>
        <span class="action-pressure">PRIME ${escapeHtml(action.pressure_level || 1)}/3</span>
        ${
          action.voice?.enabled
            ? `<span class="voice-pill">${escapeHtml(
                action.voice.mode === "crisis" ? "Sesli kriz uyarisi" : "Gun sonu sesi",
              )}</span>`
            : ""
        }
      </div>
    </div>
    <strong class="action-bar-primary">${escapeHtml(action.primary_action)}</strong>
    ${action.quick_fix ? `<p class="action-bar-quick-fix">${escapeHtml(action.quick_fix)}</p>` : ""}
    ${action.secondary_note ? `<p class="action-bar-secondary">${escapeHtml(action.secondary_note)}</p>` : ""}
    ${
      action.voice?.enabled
        ? `
          <div class="voice-control-row">
            <button type="button" class="voice-control-button" data-role="prime-voice-replay">
              ${escapeHtml(action.voice.mode === "crisis" ? "Krizi oku" : "Gun sonu sesini oynat")}
            </button>
            <button type="button" class="voice-control-button voice-control-muted" data-role="prime-voice-mute">
              ${escapeHtml(primeVoiceMuted ? "Sesi ac" : "Sesi kapat")}
            </button>
          </div>
        `
        : ""
    }
    ${actionsHtml ? `<div class="action-button-row">${actionsHtml}</div>` : ""}
  `;

  dailyActionBar.querySelectorAll('[data-role="daily-action"]').forEach((button) => {
    button.addEventListener("click", async () => {
      const actionId = button.dataset.actionId;
      const actionItem = (currentDailyActionState?.actions || []).find((item) => item.action_id === actionId);
      if (!actionItem) {
        return;
      }
      await trackDailyAction(actionId, "action_clicked");
      await runDailyAction(actionItem);
    });
  });

  const replayButton = dailyActionBar.querySelector('[data-role="prime-voice-replay"]');
  if (replayButton) {
    replayButton.addEventListener("click", () => {
      void maybePlayPrimeVoice(action, { manual: true });
    });
  }

  const muteButton = dailyActionBar.querySelector('[data-role="prime-voice-mute"]');
  if (muteButton) {
    muteButton.addEventListener("click", () => {
      primeVoiceMuted = !primeVoiceMuted;
      window.localStorage.setItem(primeVoiceMuteStorageKey, String(primeVoiceMuted));
      renderDailyActionBar({ ...currentDailyActionState });
    });
  }

  void maybePlayPrimeVoice(action);
}

async function runDailyAction(actionItem) {
  const payload = actionItem.payload || {};

  if (actionItem.type === "add_food") {
    if (payload.meal_type_hint) {
      mealTypeInput.value = payload.meal_type_hint;
    }
    if (payload.quick_text) {
      appendQuickAddText(payload.quick_text);
    }
    nutritionClarifications.className = "message-box message-success";
    nutritionClarifications.textContent = `${actionItem.label} hazirlandi. Onerilen besinler: ${(payload.suggested_foods || []).join(", ") || "protein kaynaklari"}.`;
    await trackDailyAction(actionItem.action_id, "action_completed");
    return;
  }

  if (actionItem.type === "reduce_carbs") {
    if (payload.quick_text) {
      appendQuickAddText(payload.quick_text);
    }
    nutritionClarifications.className = "message-box message-loading";
    nutritionClarifications.textContent = `Bugün şunları kıs: ${(payload.avoid_foods || []).join(", ")}. İstersen yerine ${payload.quick_text || "hafif bir seçenek"} eklendi.`;
    mealTypeInput.value = payload.meal_type_hint || mealTypeInput.value || "aksam yemegi";
    await trackDailyAction(actionItem.action_id, "action_completed");
    return;
  }

  if (actionItem.type === "log_meal") {
    if (payload.meal_type_hint) {
      mealTypeInput.value = payload.meal_type_hint;
    }
    if (payload.quick_text) {
      appendQuickAddText(payload.quick_text);
    } else {
      nutritionInput.focus();
    }
    nutritionStatus.textContent = "Hazır";
    nutritionClarifications.className = "message-box message-loading";
    nutritionClarifications.textContent = "Öğün alanı hazır. Kaydı tamamlayıp öğünü kaydet.";
    await trackDailyAction(actionItem.action_id, "action_completed");
    return;
  }

  if (actionItem.type === "add_water") {
    await createHydrationLog({
      amount: Number(payload.water_amount_ml || 500),
      unit: "ml",
      note: "PRIME aksiyonu",
    });
    return;
  }
}

async function trackDailyAction(actionId, eventType) {
  if (!currentDailyActionState?.date || !actionId) {
    return null;
  }

  const activeRequestId = ++dailyActionTrackRequestId;
  try {
    const payload = await request(`${apiBase}/meals/daily-actions/track`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: currentUserId,
        date: currentDailyActionState.date,
        action_id: actionId,
        event_type: eventType,
      }),
    });

    if (activeRequestId !== dailyActionTrackRequestId || !currentDailyActionState) {
      return payload;
    }

    currentDailyActionState.pending_actions = payload.pending_actions || [];
    currentDailyActionState.completed_actions = payload.completed_actions || [];
    currentDailyActionState.pressure_level = payload.pressure_level || currentDailyActionState.pressure_level;
    currentDailyActionState.actions = (currentDailyActionState.actions || []).map((item) =>
      item.action_id === actionId
        ? { ...item, status: payload.status }
        : {
            ...item,
            status: (payload.completed_actions || []).includes(item.action_id) ? "completed" : "pending",
          },
    );
    renderDailyActionBar(currentDailyActionState);
    return payload;
  } catch (error) {
    return null;
  }
}

async function completeDailyActionByType(actionType) {
  const actionItem = (currentDailyActionState?.actions || []).find(
    (item) => item.type === actionType && item.status !== "completed",
  );
  if (!actionItem) {
    return;
  }
  await trackDailyAction(actionItem.action_id, "action_completed");
}

async function maybePlayPrimeVoice(action, options = {}) {
  const voice = action?.voice;
  const manual = Boolean(options.manual);
  if (!voice?.enabled) {
    return;
  }
  if (primeVoiceMuted && !manual) {
    return;
  }
  if (!manual && (!voice.auto_play || voice.mode !== "crisis")) {
    return;
  }

  const voiceKey = `${action.date}:${action.primary_action}:${voice.reason}:${voice.mode}`;
  if (!manual && lastPlayedVoiceKey === voiceKey) {
    return;
  }
  lastPlayedVoiceKey = voiceKey;

  const speechText = `${String(action.primary_action || "").split(/[.!?]/)[0].trim()}.`;
  voicePlaybackCache.set(voiceKey, speechText);

  if (voice.audio_url) {
    try {
      if (currentPrimeAudio) {
        currentPrimeAudio.pause();
      }
      currentPrimeAudio = new Audio(voice.audio_url);
      currentPrimeAudio.volume = voice.mode === "crisis" ? 1 : 0.85;
      await currentPrimeAudio.play();
      return;
    } catch (error) {
      currentPrimeAudio = null;
    }
  }

  const cachedText = voicePlaybackCache.get(voiceKey) || speechText;
  if ("speechSynthesis" in window && cachedText) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(cachedText);
    utterance.lang = "tr-TR";
    utterance.rate = voice.mode === "crisis" ? 1.04 : 0.96;
    utterance.pitch = 0.92;
    window.speechSynthesis.speak(utterance);
  }
}

function renderDailyCoach(coach) {
  const prime = coach.prime;
  const balanceLabel =
    coach.calorie_balance === "surplus"
      ? "fazla"
      : coach.calorie_balance === "deficit"
        ? "açık"
        : "denge";
  const proteinLabel =
    coach.protein_status === "low"
      ? "protein düşük"
      : coach.protein_status === "close"
        ? "protein yakın"
      : coach.protein_status === "above_target"
          ? "protein yüksek"
          : "protein hedefte";
  const behaviorCards = [
    coach.behavior_score
      ? metricCard(
          "Gunluk skor",
          `${Number(coach.behavior_score.total).toFixed(0)} / 100`,
          behaviorStatusLabel(coach.behavior_score.status),
        )
      : "",
    coach.streaks?.logging
      ? metricCard("Log serisi", coach.streaks.logging.label, coach.streaks.logging.active ? "aktif" : "pasif")
      : "",
    coach.streaks?.protein_target
      ? metricCard(
          "Protein serisi",
          coach.streaks.protein_target.label,
          coach.streaks.protein_target.active ? "aktif" : "pasif",
        )
      : "",
    coach.confidence_overview
      ? metricCard(
          "Kayit guveni",
          `${Number(coach.confidence_overview.score).toFixed(0)} / 100`,
          confidenceToneLabel(coach.confidence_overview.level),
        )
      : "",
  ]
    .filter(Boolean)
    .join("");
  const behaviorBreakdown = coach.behavior_score?.components?.length
    ? `
      <div class="summary-grid">
        ${coach.behavior_score.components.map((component) => breakdownCard(behaviorComponentLabel(component.key), component)).join("")}
      </div>
    `
    : "";

  dailyCoachContainer.className = "message-box coach-support-card";
  dailyCoachContainer.innerHTML = `
    <div class="prime-header">
      <div class="prime-avatar-shell">
        <img class="prime-avatar-image" src="/prime-robot.png" alt="PRIME robot" />
      </div>
      <div>
        <strong>PRIME</strong>
        <p class="prime-one-line">${escapeHtml(prime?.message || coach.coaching_message)}</p>
      </div>
    </div>
    ${prime?.actions?.length ? `<ul class="prime-actions">${prime.actions.slice(0, 3).map((action) => `<li>${escapeHtml(action)}</li>`).join("")}</ul>` : ""}
    ${prime?.reason ? `<p class="inline-note">${escapeHtml(prime.reason)}</p>` : ""}
    <p class="inline-note">
      ${escapeHtml(
        `${proteinLabel} | kalori ${balanceLabel} | hedefler: ${Number(coach.protein_target_g).toFixed(0)} g protein / ${Number(coach.calorie_target_kcal).toFixed(0)} kcal`,
      )}
    </p>
    ${
      prime
        ? `<p class="inline-note">${escapeHtml(
            `${prime.mode} mod | risk ${prime.risk_level} | guven ${Math.round(Number(prime.confidence || 0) * 100)} / 100`,
          )}</p>`
        : ""
    }
    ${coach.suggestions?.length ? `<p class="inline-note">${escapeHtml(coach.suggestions[0])}</p>` : ""}
    ${behaviorCards ? `<div class="summary-grid">${behaviorCards}</div>` : ""}
    ${behaviorBreakdown}
  `;
}

async function loadQuickAddOptions() {
  try {
    const payload = await request(
      `${apiBase}/meals/quick-add?user_id=${encodeURIComponent(currentUserId)}`,
    );
    quickAddCache = payload;
    renderQuickAddOptions(payload);
  } catch (error) {
    renderQuickAddOptions({
      last_10_foods: [],
      favorite_foods: [],
      favorite_meals: [],
    });
  }
}

function renderQuickAddOptions(payload) {
  renderQuickAddFoodList(quickAddRecentFoods, payload.last_10_foods || [], "Henüz kayıt yok.");
  renderQuickAddFoodList(
    quickAddFavoriteFoods,
    payload.favorite_foods || [],
    "Favori besin eklediğinde burada görünür.",
  );
  renderQuickAddMealList(payload.favorite_meals || []);
}

function renderQuickAddFoodList(container, foods, emptyText) {
  if (!foods.length) {
    container.innerHTML = `<span class="muted-text">${escapeHtml(emptyText)}</span>`;
    return;
  }

  container.innerHTML = foods
    .map(
      (item) => `
        <button
          type="button"
          class="quick-add-chip"
          data-role="quick-add-food"
          data-text="${escapeHtml(item.quick_text)}"
          data-meal-type="${escapeHtml(item.meal_type_hint || "")}"
        >
          ${escapeHtml(localizedFoodName(item.label))}
        </button>
      `,
    )
    .join("");

  container.querySelectorAll('[data-role="quick-add-food"]').forEach((button) => {
    button.addEventListener("click", () => {
      const shouldApplyMealType = !nutritionInput.value.trim() && button.dataset.mealType;
      if (shouldApplyMealType) {
        mealTypeInput.value = button.dataset.mealType;
      }
      appendQuickAddText(button.dataset.text || "");
    });
  });
}

function renderQuickAddMealList(meals) {
  if (!meals.length) {
    quickAddFavoriteMeals.innerHTML =
      '<span class="muted-text">Favori öğün eklediğinde burada görünür.</span>';
    return;
  }

  quickAddFavoriteMeals.innerHTML = meals
    .map(
      (meal) => `
        <button
          type="button"
          class="quick-add-meal-card"
          data-role="quick-add-meal"
          data-text="${escapeHtml(meal.quick_text)}"
          data-meal-type="${escapeHtml(meal.meal_type || "")}"
        >
          <strong>${escapeHtml(meal.title)}</strong>
          <span>${escapeHtml(meal.quick_text)}</span>
        </button>
      `,
    )
    .join("");

  quickAddFavoriteMeals.querySelectorAll('[data-role="quick-add-meal"]').forEach((button) => {
    button.addEventListener("click", () => {
      nutritionInput.value = button.dataset.text || "";
      if (button.dataset.mealType) {
        mealTypeInput.value = button.dataset.mealType;
      }
      nutritionInput.focus();
      scheduleRealtimeNutritionParse();
    });
  });
}

function appendQuickAddText(text) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return;
  }

  const current = nutritionInput.value.trim();
  nutritionInput.value = current ? `${current}\n${normalized}` : normalized;
  nutritionInput.focus();
  scheduleRealtimeNutritionParse();
}

async function saveFavoriteFoodFromItem(index) {
  const item = nutritionDraftItems[index];
  if (!item) {
    return;
  }

  try {
    await request(`${apiBase}/meals/quick-add/favorite-food`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: currentUserId,
        quick_text: item.raw_text,
        display_name_tr: displayFoodName(item),
        canonical_food_id: item.canonical_food_id,
        meal_type_hint: mealTypeInput.value || null,
        active: true,
      }),
    });

    nutritionClarifications.className = "message-box message-success";
    nutritionClarifications.textContent = `${displayFoodName(item)} favori besinlere eklendi.`;
    await loadQuickAddOptions();
  } catch (error) {
    nutritionClarifications.className = "message-box message-error";
    nutritionClarifications.textContent = error.message;
  }
}

function buildFavoriteMealTitle() {
  const firstLine = nutritionInput.value
    .split(/[\n,;]/)
    .map((part) => part.trim())
    .find(Boolean);
  if (!firstLine) {
    return `${titleCase(mealTypeInput.value || "Öğün")} favorisi`;
  }
  return `${firstLine} ${mealTypeInput.value || ""}`.trim();
}

function renderDailySummary(summary) {
  const mealsHtml = (summary.meals || [])
    .map(
      (meal) => `
        <article class="meal-card">
          <div class="meal-card-header">
            <strong>${escapeHtml(titleCase(meal.meal_type))}</strong>
            <span class="meal-meta">${escapeHtml(meal.consumed_at.slice(11, 16))}</span>
          </div>
          <div class="meal-meta">
            ${meal.items.map((item) => `${escapeHtml(displayFoodName(item))} (${Number(item.estimated_weight_g).toFixed(0)} g)`).join(", ")}
          </div>
          <div class="macro-line">
            <span>${Number(meal.totals.kcal).toFixed(0)} kcal</span>
            <span>P ${Number(meal.totals.protein_g).toFixed(1)} g</span>
            <span>K ${Number(meal.totals.carbs_g).toFixed(1)} g</span>
            <span>Y ${Number(meal.totals.fat_g).toFixed(1)} g</span>
          </div>
        </article>
      `,
    )
    .join("");

  dailySummaryContainer.innerHTML = `
    <div class="summary-grid">
      ${metricCard("Kalori", `${Number(summary.total_kcal).toFixed(0)} kcal`, `${summary.meal_count} Ã¶ÄŸÃ¼n`)}
      ${metricCard("Protein", `${Number(summary.total_protein_g).toFixed(1)} g`, "GÃ¼nlÃ¼k toplam")}
      ${metricCard("Karbonhidrat", `${Number(summary.total_carbs_g).toFixed(1)} g`, "GÃ¼nlÃ¼k toplam")}
      ${metricCard("YaÄŸ", `${Number(summary.total_fat_g).toFixed(1)} g`, "GÃ¼nlÃ¼k toplam")}
    </div>
    <section class="subsection">
      <h3>Ã–ÄŸÃ¼nler</h3>
      <div class="meal-list">${mealsHtml || '<p class="muted-text">Bu tarihte kayÄ±tlÄ± Ã¶ÄŸÃ¼n yok.</p>'}</div>
    </section>
  `;
}

function breakdownCard(label, metric) {
  return `
    <article class="mini-metric">
      <strong>${escapeHtml(label)}</strong>
      <span>${metric.score}/100</span>
      <p>${escapeHtml(metric.explanation)}</p>
    </article>
  `;
}

function metricCard(label, value, detail) {
  return `
    <article class="score-card">
      <p class="label">${escapeHtml(label)}</p>
      <strong>${escapeHtml(value)}</strong>
      <p>${escapeHtml(detail)}</p>
    </article>
  `;
}

function behaviorStatusLabel(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "strong") {
    return "guclu";
  }
  if (normalized === "fair") {
    return "orta";
  }
  return "kirilgan";
}

function behaviorComponentLabel(key) {
  const normalized = String(key || "").toLowerCase();
  if (normalized === "protein") {
    return "Protein";
  }
  if (normalized === "calories") {
    return "Kalori";
  }
  return "Log";
}

function confidenceToneLabel(level) {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "high") {
    return "guven yuksek";
  }
  if (normalized === "medium") {
    return "guven orta";
  }
  return "guven dusuk";
}

function listItems(items) {
  if (!items?.length) {
    return '<p class="muted-text">No items available.</p>';
  }

  return `<ul class="bullet-list">${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul>`;
}

function setMessage(element, message, tone) {
  element.className = `message-box ${tone ? `message-${tone}` : ""}`;
  element.textContent = message;
}

function priorityClass(priority) {
  const normalized = String(priority || "").toLowerCase();
  if (normalized === "high") {
    return "priority-high";
  }
  if (normalized === "medium") {
    return "priority-medium";
  }
  return "priority-low";
}

function confidenceClass(level) {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "high") {
    return "confidence-high";
  }
  if (normalized === "medium") {
    return "confidence-medium";
  }
  return "confidence-low";
}

function confidenceLabel(level) {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "high") {
    return "kesin";
  }
  if (normalized === "medium") {
    return "tahmini";
  }
  return "doÄŸrulama gerekli";
}

function suggestionSourceLabel(source) {
  const normalized = String(source || "").toLowerCase();
  if (normalized === "recent") {
    return "son kullanÄ±lan";
  }
  if (normalized === "frequent") {
    return "sÄ±k kullanÄ±lan";
  }
  return "veritabanÄ±";
}

function suggestionPillClass(source) {
  const normalized = String(source || "").toLowerCase();
  if (normalized === "recent") {
    return "suggestion-pill-recent";
  }
  if (normalized === "frequent") {
    return "suggestion-pill-frequent";
  }
  return "";
}

function titleCase(value) {
  return String(value)
    .replaceAll("_", " ")
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getOrCreateLocalUserId() {
  const storageKey = "fitness-notebook-user-id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const generated = `user-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(storageKey, generated);
  return generated;
}

function getLocalDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function applyTurkishUICopy() {
  const setText = (selector, text) => {
    const node = document.querySelector(selector);
    if (node) {
      node.textContent = text;
    }
  };

  setText(".hero .eyebrow", "Fitness Notebook AI");
  setText(".hero h1", "PDF yükle, antrenmanını analiz et ve doğal dille beslenme günlüğünü tut.");
  setText(".hero .subtitle", "Backend adresi: http://127.0.0.1:8000/api/v1");
  setText("#nutrition-form label[for='meal-type']", "Öğün Türü");
  setText("#nutrition-form label[for='nutrition-input']", "Öğün Ekle");
  setText("#nutrition-live-hint", "Yazdıkça otomatik ayrıştırılır. Kartlar ve makrolar 300 ms içinde güncellenir.");
  setText("#nutrition-favorite-meal", "Öğünü Favorilere Ekle");
  setText("#nutrition-save", "Öğünü Kaydet");
  setText("#nutrition-clarifications", "Belirsiz porsiyonlar burada açıklanır. Gerekirse gram ya da porsiyon boyutu isteyeceğiz.");
  setText("#nutrition-result", "3 yumurta, 150 g tavuk göğsü, 1 kase pilav gibi girişler burada temiz kartlar halinde gösterilir.");

  if (nutritionInput) {
    nutritionInput.placeholder = "Ã–rnek:\n3 haÅŸlanmÄ±ÅŸ yumurta\n100 g lor\n1 muz";
  }
  if (mealTypeInput?.options.length >= 4) {
    mealTypeInput.options[0].text = "KahvaltÄ±";
    mealTypeInput.options[1].text = "Ã–ÄŸle YemeÄŸi";
    mealTypeInput.options[2].text = "AkÅŸam YemeÄŸi";
    mealTypeInput.options[3].text = "Ara Ã–ÄŸÃ¼n";
  }
  const headers = document.querySelectorAll(".section-header h2");
  if (headers.length >= 5) {
    headers[0].textContent = "Profil ve Hedefler";
    headers[1].textContent = "Beslenme GÃ¼nlÃ¼ÄŸÃ¼";
    headers[2].textContent = "Ã–ÄŸÃ¼n Analizi";
    headers[3].textContent = "GÃ¼nlÃ¼k Ã–zet";
    headers[4].textContent = "PDF Upload";
  }
}

function renderNutritionAnalysisV2(calculation) {
  const itemsHtml = (calculation.items || [])
    .map((item, index) => {
      const nutrition = item.nutrition
        ? `
          <div class="macro-line">
            <span>${Number(item.nutrition.kcal).toFixed(0)} kcal</span>
            <span>P ${Number(item.nutrition.protein_g).toFixed(1)} g</span>
            <span>K ${Number(item.nutrition.carbs_g).toFixed(1)} g</span>
            <span>Y ${Number(item.nutrition.fat_g).toFixed(1)} g</span>
          </div>
        `
        : `<p class="error-text">Makro hesabÄ± iÃ§in net porsiyon gerekli.</p>`;

      const note = item.needs_clarification
        ? "Kaydetmeden Ã¶nce bu satÄ±rÄ± doÄŸrula."
        : item.estimated
          ? "Bu satÄ±r tahmini porsiyona gÃ¶re hesaplandÄ±."
          : "Bu satÄ±r net Ã¶lÃ§Ã¼yle hesaplandÄ±.";

      return `
        <article class="nutrition-card">
          <div class="nutrition-card-header">
            <div>
              <strong>${escapeHtml(displayFoodName(item))}</strong>
              <p class="nutrition-meta">${escapeHtml(item.raw_text)}</p>
            </div>
            <span class="confidence-badge ${confidenceClass(item.confidence_level)}">${escapeHtml(confidenceLabelV2(item.confidence_level))}</span>
          </div>
          <div class="nutrition-meta">
            <p>Miktar: ${item.amount ?? "-"} ${escapeHtml(item.unit || "")}</p>
            <p>HazÄ±rlÄ±k: ${escapeHtml(item.preparation_method || "belirtilmedi")}</p>
            <p>GÃ¼ven skoru: ${Number(item.confidence_score).toFixed(2)}</p>
          </div>
          <div class="nutrition-card-grid">
            <label class="field-stack">
              <span>Tahmini gram</span>
              <input
                type="number"
                min="0"
                step="1"
                value="${item.estimated_weight_g ?? ""}"
                data-role="nutrition-weight"
                data-index="${index}"
              />
            </label>
          </div>
          ${nutrition}
          <p class="inline-note">${escapeHtml(note)}</p>
          <div class="nutrition-card-actions">
            <button
              type="button"
              class="icon-button"
              data-role="favorite-food"
              data-index="${index}"
            >
              Favori Besin
            </button>
          </div>
          ${item.calculation_basis ? `<p class="nutrition-meta">${escapeHtml(item.calculation_basis)}</p>` : ""}
        </article>
      `;
    })
    .join("");

  nutritionResult.innerHTML = `
    <div class="summary-grid">
      ${metricCard("Kalori", `${Number(calculation.meal_totals.kcal).toFixed(0)} kcal`, "Toplam Ã¶ÄŸÃ¼n enerjisi")}
      ${metricCard("Protein", `${Number(calculation.meal_totals.protein_g).toFixed(1)} g`, "Toplam protein")}
      ${metricCard("Karbonhidrat", `${Number(calculation.meal_totals.carbs_g).toFixed(1)} g`, "Toplam karbonhidrat")}
      ${metricCard("YaÄŸ", `${Number(calculation.meal_totals.fat_g).toFixed(1)} g`, "Toplam yaÄŸ")}
    </div>
    <section class="subsection">
      <h3>Besin KartlarÄ±</h3>
      <p class="inline-note">"Tahmini" rozetli satÄ±rlar yaklaÅŸÄ±k hesaplanÄ±r. "DoÄŸrulama gerekli" rozetinde kaydetmeden Ã¶nce gram veya porsiyon boyutunu dÃ¼zelt.</p>
      <div class="nutrition-list">${itemsHtml || '<p class="muted-text">Besin bulunamadÄ±.</p>'}</div>
    </section>
  `;

  nutritionResult.querySelectorAll('[data-role="nutrition-weight"]').forEach((input) => {
    input.addEventListener("input", (event) => {
      const index = Number(event.target.dataset.index);
      const value = event.target.value;
      nutritionDraftItems[index].estimated_weight_g = value ? Number(value) : null;
      if (nutritionDraftItems[index].estimated_weight_g) {
        nutritionDraftItems[index].needs_clarification = false;
        nutritionDraftItems[index].clarification_reason = null;
      }
      scheduleNutritionRecalculation();
    });
  });

  nutritionResult.querySelectorAll('[data-role="favorite-food"]').forEach((button) => {
    button.addEventListener("click", () => {
      void saveFavoriteFoodFromItem(Number(button.dataset.index));
    });
  });
}

function renderNutritionClarificationsV2(questions) {
  if (!questions?.length) {
    nutritionClarifications.className = "message-box message-success";
    nutritionClarifications.textContent = "Porsiyonlar yeterince net. Ä°stersen gramlarÄ± dÃ¼zenleyip Ã¶ÄŸÃ¼nÃ¼ kaydedebilirsin.";
    return;
  }

  nutritionClarifications.className = "message-box message-error";
  nutritionClarifications.innerHTML = `
    <strong>DoÄŸrulama gerekli:</strong>
    <div class="clarification-list">
      ${questions
        .map((question) => {
          const choiceButtons = (question.choices || [])
            .map(
              (choice) => `
                <button
                  type="button"
                  class="choice-chip"
                  data-role="clarification-choice"
                  data-index="${question.item_index}"
                  data-weight="${choice.estimated_weight_g}"
                  data-unit="${escapeHtml(choice.unit || "")}"
                  data-modifiers="${escapeHtml(JSON.stringify(choice.modifiers || []))}"
                  data-canonical-food-id="${escapeHtml(choice.canonical_food_id || "")}"
                  data-canonical-display-name="${escapeHtml(choice.canonical_display_name || "")}"
                  data-brand="${escapeHtml(choice.brand || "")}"
                  data-product-name="${escapeHtml(choice.product_name || "")}"
                  data-is-branded-product="${choice.is_branded_product ? "true" : "false"}"
                >
                  ${escapeHtml(choice.label)}
                </button>
              `,
            )
            .join("");

          return `
            <div class="clarification-card">
              <p><strong>${escapeHtml(displayFoodName(nutritionDraftItems[question.item_index]))}</strong></p>
              <p>${escapeHtml(question.question)}</p>
              ${choiceButtons ? `<div class="choice-chip-row">${choiceButtons}</div>` : ""}
              ${question.suggested_options?.length ? `<p class="inline-note">DiÄŸer seÃ§enekler: ${escapeHtml(question.suggested_options.join(", "))}</p>` : ""}
            </div>
          `;
        })
        .join("")}
    </div>
    <p class="inline-note">Bir seÃ§enek seÃ§tiÄŸinde porsiyon gramÄ± otomatik gÃ¼ncellenir ve makrolar yeniden hesaplanÄ±r.</p>
  `;

  nutritionClarifications.querySelectorAll('[data-role="clarification-choice"]').forEach((button) => {
    button.addEventListener("click", () => {
      const index = Number(button.dataset.index);
      const weight = Number(button.dataset.weight);
      const unit = button.dataset.unit || null;
      const modifiers = JSON.parse(button.dataset.modifiers || "[]");
      const canonicalFoodId = button.dataset.canonicalFoodId || null;
      const canonicalDisplayName = button.dataset.canonicalDisplayName || null;
      const brand = button.dataset.brand || null;
      const productName = button.dataset.productName || null;
      const isBrandedProduct = button.dataset.isBrandedProduct === "true";
      const item = nutritionDraftItems[index];
      if (!item) {
        return;
      }

      item.food_name = canonicalDisplayName || item.food_name;
      item.canonical_food_id = canonicalFoodId || item.canonical_food_id;
      item.canonical_display_name = canonicalDisplayName || item.canonical_display_name;
      item.brand = brand ?? item.brand;
      item.product_name = productName ?? item.product_name;
      item.is_branded_product = isBrandedProduct || item.is_branded_product;
      item.estimated_weight_g = weight;
      item.estimated_weight_min_g = weight;
      item.estimated_weight_max_g = weight;
      item.unit = unit || item.unit;
      item.modifiers = modifiers;
      item.estimated = true;
      item.needs_clarification = false;
      item.clarification_reason = null;
      item.portion_source = "clarification_choice";
      item.confidence_level = "medium";
      item.confidence_score = Math.max(Number(item.confidence_score || 0), 0.78);

      scheduleNutritionRecalculation(true);
    });
  });
}

function renderDailySummaryV2(summary) {
  const mealsHtml = (summary.meals || [])
    .map(
      (meal) => `
        <article class="meal-card">
          <div class="meal-card-header">
            <strong>${escapeHtml(titleCase(meal.meal_type))}</strong>
            <span class="meal-meta">${escapeHtml(meal.consumed_at.slice(11, 16))}</span>
          </div>
          ${
            meal.confidence
              ? `<p class="inline-note">Kayit guveni ${Number(meal.confidence.score).toFixed(0)}/100 | ${escapeHtml(confidenceToneLabel(meal.confidence.level))} | ${escapeHtml(meal.confidence.explanation)}</p>`
              : ""
          }
          <div class="meal-meta">
            ${meal.items.map((item) => `${escapeHtml(displayFoodName(item))} (${Number(item.estimated_weight_g).toFixed(0)} g)`).join(", ")}
          </div>
          <div class="macro-line">
            <span>${Number(meal.totals.kcal).toFixed(0)} kcal</span>
            <span>P ${Number(meal.totals.protein_g).toFixed(1)} g</span>
            <span>K ${Number(meal.totals.carbs_g).toFixed(1)} g</span>
            <span>Y ${Number(meal.totals.fat_g).toFixed(1)} g</span>
          </div>
        </article>
      `,
    )
    .join("");

  dailySummaryContainer.innerHTML = `
    <div class="summary-grid">
      ${metricCard("Kalori", `${Number(summary.total_kcal).toFixed(0)} kcal`, `${summary.meal_count} Ã¶ÄŸÃ¼n`)}
      ${metricCard("Protein", `${Number(summary.total_protein_g).toFixed(1)} g`, "GÃ¼nlÃ¼k toplam")}
      ${metricCard("Karbonhidrat", `${Number(summary.total_carbs_g).toFixed(1)} g`, "GÃ¼nlÃ¼k toplam")}
      ${metricCard("YaÄŸ", `${Number(summary.total_fat_g).toFixed(1)} g`, "GÃ¼nlÃ¼k toplam")}
      ${
        summary.confidence_overview
          ? metricCard(
              "Kayit guveni",
              `${Number(summary.confidence_overview.score).toFixed(0)} / 100`,
              confidenceToneLabel(summary.confidence_overview.level),
            )
          : ""
      }
    </div>
    <section class="subsection">
      <h3>Ã–ÄŸÃ¼nler</h3>
      <div class="meal-list">${mealsHtml || '<p class="muted-text">Bu tarihte kayÄ±tlÄ± Ã¶ÄŸÃ¼n yok.</p>'}</div>
    </section>
  `;
}

function confidenceLabelV2(level) {
  const normalized = String(level || "").toLowerCase();
  if (normalized === "high") {
    return "kesin";
  }
  if (normalized === "medium") {
    return "tahmini";
  }
  return "doÄŸrulama gerekli";
}

void loadDocuments();
void loadUserProfile();
void loadHydrationProfile();
void loadQuickAddOptions();
void loadDailySummary(mealDateInput.value);
void loadHydrationSummary(mealDateInput.value);
void loadDailyCommand(mealDateInput.value);
