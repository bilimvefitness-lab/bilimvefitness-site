import {
  LayoutAnimation,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  UIManager,
  View,
  ActivityIndicator,
  Image,
  Alert,
} from "react-native";
import { useCallback, useEffect, useState } from "react";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Clipboard from "expo-clipboard";
import { useApp } from "../context/AppContext";
import { trackEvent } from "../utils/analytics";
import { useLanguage } from "../i18n";

// Enable LayoutAnimation on Android
if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle, open, onToggle }) {
  return (
    <Pressable style={styles.sectionHeader} onPress={onToggle} hitSlop={8}>
      <View style={styles.sectionHeaderLeft}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      </View>
      <Text style={[styles.sectionArrow, open && styles.sectionArrowOpen]}>›</Text>
    </Pressable>
  );
}

function FieldInput({ label, value, onChangeText, keyboardType = "default", placeholder = "" }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        placeholderTextColor="#9ab09e"
      />
    </View>
  );
}

function ChipGroup({ label, options, value, onChange }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            style={[styles.chip, opt.value === value && styles.chipActive]}
            onPress={() => onChange(opt.value)}
          >
            <Text style={[styles.chipText, opt.value === value && styles.chipTextActive]}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function GoalRow({ label, value }) {
  if (!value) return null;
  return (
    <View style={styles.goalRow}>
      <Text style={styles.goalLabel}>{label}</Text>
      <Text style={styles.goalValue}>{value}</Text>
    </View>
  );
}

// ── Language selector (inline pills — secondary to the header selector) ───────

const LANG_OPTIONS_PROFILE = [
  { code: "tr", flag: "🇹🇷", label: "Türkçe" },
  { code: "en", flag: "🇬🇧", label: "English" },
];

function LanguageSelector({ t, language, setLanguage }) {
  return (
    <View style={styles.langRow}>
      <Text style={styles.langRowLabel}>{t("profile.language.label")}</Text>
      <View style={styles.langPills}>
        {LANG_OPTIONS_PROFILE.map(({ code, flag, label }) => {
          const isActive = language === code;
          return (
            <Pressable
              key={code}
              style={[styles.langPill, isActive && styles.langPillActive]}
              onPress={() => setLanguage(code)}
            >
              <Text style={styles.langPillFlag}>{flag}</Text>
              <Text style={[styles.langPillText, isActive && styles.langPillTextActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ── Screen ────────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { profileForm, setProfileForm, profileState, goals, saveProfile, recalculateGoalsLocally, publicUserId, photoUri, setPhotoUri, refreshIdentity } = useApp();
  const { t, language, setLanguage } = useLanguage();

  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [basicOpen, setBasicOpen]   = useState(true);
  const [goalsOpen, setGoalsOpen]   = useState(false);
  const [idCopied, setIdCopied]     = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);
  const navigation = useNavigation();

  useEffect(() => { trackEvent("profile_opened"); }, []);

  // Re-sync publicUserId and remote photo whenever screen comes into focus
  useFocusEffect(
    useCallback(() => { refreshIdentity(); }, [refreshIdentity])
  );

  // ── Translated option arrays (rebuilt when language changes) ──────────────
  const GENDER_OPTIONS = [
    { value: "male",   label: t("profile.fields.male") },
    { value: "female", label: t("profile.fields.female") },
  ];
  const ACTIVITY_OPTIONS = [
    { value: "sedentary",   label: t("profile.activityLevels.sedentary") },
    { value: "light",       label: t("profile.activityLevels.light") },
    { value: "moderate",    label: t("profile.activityLevels.moderate") },
    { value: "active",      label: t("profile.activityLevels.active") },
    { value: "very_active", label: t("profile.activityLevels.veryActive") },
  ];
  const GOAL_OPTIONS = [
    { value: "fat_loss",      label: t("profile.goals.fatLoss") },
    { value: "muscle_gain",   label: t("profile.goals.muscleGain") },
    { value: "recomposition", label: t("profile.goals.recomp") },
    { value: "maintenance",   label: t("profile.goals.maintenance") },
  ];
  const OPTIMIZATION_OPTIONS = [
    { value: "balanced",   label: t("profile.goals.balanced") },
    { value: "aggressive", label: t("profile.goals.aggressive") },
    { value: "protective", label: t("profile.goals.protective") },
  ];

  async function handleCopyId() {
    if (!publicUserId) return;
    await Clipboard.setStringAsync(publicUserId);
    setIdCopied(true);
    setTimeout(() => setIdCopied(false), 2000);
  }

  async function handleChangePhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(t("profile.errors.permissionRequired"), t("profile.errors.galleryPermission"));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.6,
    });
    if (result.canceled || !result.assets?.length) return;
    setPhotoLoading(true);
    try {
      await setPhotoUri(result.assets[0].uri);
    } catch (err) {
      let msg;
      switch (err?.code) {
        case "wrong_api_base_url":
          msg = err.message; // full dev-facing config instruction
          break;
        case "auth_error":
          msg = t("profile.errors.authFailed");
          break;
        case "network_error":
          msg = t("profile.errors.connectionError");
          break;
        default:
          msg = t("profile.errors.photoUpdateFailed");
      }
      Alert.alert(t("common.error"), msg);
    } finally {
      setPhotoLoading(false);
    }
  }

  // Instant Goal Logic: recalculate whenever key fields change
  useEffect(() => {
    recalculateGoalsLocally(profileForm);
  }, [
    profileForm.weight_kg,
    profileForm.height_cm,
    profileForm.age,
    profileForm.gender,
    profileForm.activity_level,
    profileForm.goal,
    profileForm.optimization_mode,
    profileForm.training_frequency_per_week,
  ]);

  function update(key, val) {
    setProfileForm((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
  }

  function toggleSection(setter) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter((v) => !v);
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    const ok = await saveProfile();
    setSaving(false);
    if (ok) {
      setSaved(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setSaved(false), 2500);
    }
  }

  // Summary line shown in collapsed header
  const basicSummary = [
    profileForm.weight_kg && `${profileForm.weight_kg}kg`,
    profileForm.age && `${profileForm.age}y`,
  ].filter(Boolean).join(" · ") || null;

  const goalLabel = GOAL_OPTIONS.find((o) => o.value === profileForm.goal)?.label ?? null;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >

        {/* ── AVATAR + PUBLIC ID ───────────────────────────────── */}
        <View style={styles.avatarCard}>
          <Pressable style={styles.avatarWrapper} onPress={handleChangePhoto} disabled={photoLoading}>
            {photoLoading ? (
              <View style={styles.avatarCircle}>
                <ActivityIndicator color="#295c41" />
              </View>
            ) : photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarLetter}>
                  {(profileForm.name || "B")[0].toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.cameraOverlay}>
              <Text style={styles.cameraIcon}>📷</Text>
            </View>
          </Pressable>
          <Text style={styles.avatarName}>{profileForm.name || t("profile.myProfile")}</Text>
          {publicUserId
            ? <Text style={styles.avatarPublicId}>{publicUserId}</Text>
            : <Text style={styles.avatarPublicIdLoading}>{t("profile.userId.loading")}</Text>
          }
          <Pressable style={styles.changePhotoBtn} onPress={handleChangePhoto} disabled={photoLoading}>
            <Text style={styles.changePhotoText}>{t("profile.photo.change")}</Text>
          </Pressable>
        </View>

        {/* ── KULLANICI ID ─────────────────────────────────────── */}
        <View style={styles.card}>
          <View style={[styles.idRow, { paddingHorizontal: 20, paddingVertical: 18 }]}>
            <View style={styles.idLeft}>
              <Text style={styles.idLabel}>{t("profile.userId.label")}</Text>
              {publicUserId ? (
                <>
                  <Text style={styles.idValue}>{publicUserId}</Text>
                  <Text style={styles.idHint}>{t("profile.userId.hint")}</Text>
                </>
              ) : (
                <Text style={styles.idValueLoading}>{t("common.loading")}</Text>
              )}
            </View>
            {publicUserId ? (
              <Pressable
                style={[styles.copyBtn, idCopied && styles.copyBtnActive]}
                onPress={handleCopyId}
              >
                <Text style={[styles.copyBtnText, idCopied && styles.copyBtnTextActive]}>
                  {idCopied ? t("common.copied") : t("common.copy")}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {/* ── SECTION 1: Temel Bilgiler ─────────────────────────── */}
        <View style={styles.card}>
          <SectionHeader
            title={t("profile.sections.basic")}
            subtitle={!basicOpen && basicSummary ? basicSummary : null}
            open={basicOpen}
            onToggle={() => toggleSection(setBasicOpen)}
          />
          {basicOpen && (
            <View style={styles.cardBody}>
              <FieldInput
                label={t("profile.fields.name")}
                value={profileForm.name ?? ""}
                onChangeText={(v) => update("name", v)}
                placeholder={t("profile.fields.namePlaceholder")}
              />
              <FieldInput
                label={t("profile.fields.weight")}
                value={profileForm.weight_kg}
                onChangeText={(v) => update("weight_kg", v)}
                keyboardType="numeric"
              />
              <FieldInput
                label={t("profile.fields.height")}
                value={profileForm.height_cm}
                onChangeText={(v) => update("height_cm", v)}
                keyboardType="numeric"
              />
              <FieldInput
                label={t("profile.fields.age")}
                value={profileForm.age}
                onChangeText={(v) => update("age", v)}
                keyboardType="numeric"
              />
              <ChipGroup
                label={t("profile.fields.gender")}
                options={GENDER_OPTIONS}
                value={profileForm.gender}
                onChange={(v) => update("gender", v)}
              />
            </View>
          )}
        </View>

        {/* ── SECTION 2: Hedef ve Yaşam Biçimi ─────────────────── */}
        <View style={styles.card}>
          <SectionHeader
            title={t("profile.sections.goals")}
            subtitle={!goalsOpen && goalLabel ? goalLabel : null}
            open={goalsOpen}
            onToggle={() => toggleSection(setGoalsOpen)}
          />
          {goalsOpen && (
            <View style={styles.cardBody}>
              <ChipGroup
                label={t("profile.fields.goal")}
                options={GOAL_OPTIONS}
                value={profileForm.goal}
                onChange={(v) => update("goal", v)}
              />
              <ChipGroup
                label={t("profile.fields.activityLevel")}
                options={ACTIVITY_OPTIONS}
                value={profileForm.activity_level}
                onChange={(v) => update("activity_level", v)}
              />
              <ChipGroup
                label={t("profile.fields.optimization")}
                options={OPTIMIZATION_OPTIONS}
                value={profileForm.optimization_mode || "balanced"}
                onChange={(v) => update("optimization_mode", v)}
              />
            </View>
          )}
        </View>

        {/* ── Save ──────────────────────────────────────────────── */}
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled, saved && styles.saveButtonSuccess]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={[styles.saveButtonText, saved && styles.saveButtonTextSuccess]}>
              {saved ? t("profile.saved") : t("profile.save")}
            </Text>
          )}
        </Pressable>

        {profileState.tone === "error" ? (
          <Text style={styles.errorText}>{profileState.feedback}</Text>
        ) : null}

        {/* ── Language selector ─────────────────────────────────── */}
        <LanguageSelector t={t} language={language} setLanguage={setLanguage} />

        {/* ── Calculated goals ─────────────────────────────────── */}
        {goals ? (
          <View style={styles.goalsBlock}>
            <Pressable
              onLongPress={
                __DEV__
                  ? () => { try { navigation.navigate("AnalyticsDebug"); } catch (_) {} }
                  : undefined
              }
            >
              <Text style={styles.goalsTitle}>{t("profile.sections.calculated")}</Text>
            </Pressable>
            <GoalRow label={t("profile.macros.calories")}  value={goals.calorie_target_kcal ? `${Math.round(goals.calorie_target_kcal)} kcal` : null} />
            <GoalRow label={t("profile.macros.protein")}   value={goals.protein_target_g    ? `${Math.round(goals.protein_target_g)}g`         : null} />
            <GoalRow label={t("profile.macros.carbs")}     value={goals.carbs_target_g      ? `${Math.round(goals.carbs_target_g)}g`            : null} />
            <GoalRow label={t("profile.macros.fat")}       value={goals.fat_target_g        ? `${Math.round(goals.fat_target_g)}g`              : null} />
            <GoalRow label={t("profile.macros.water")}     value={goals.water_target_ml     ? `${(goals.water_target_ml / 1000).toFixed(1)}L`   : null} />
          </View>
        ) : null}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef4e8" },

  // ── Avatar ────────────────────────────────────────────────────────────────
  avatarCard: {
    alignItems: "center",
    paddingVertical: 24,
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#d8e9dc",
    gap: 8,
  },
  avatarWrapper: { position: "relative" },
  avatarCircle: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: "#eef4e8",
    borderWidth: 2.5, borderColor: "#295c41",
    justifyContent: "center", alignItems: "center",
  },
  avatarImage: {
    width: 88, height: 88, borderRadius: 44,
    borderWidth: 2.5, borderColor: "#295c41",
  },
  avatarLetter:           { fontSize: 34, fontWeight: "900", color: "#295c41" },
  cameraOverlay: {
    position: "absolute", bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#295c41",
    justifyContent: "center", alignItems: "center",
    borderWidth: 2, borderColor: "#ffffff",
  },
  cameraIcon:             { fontSize: 14 },
  avatarName:             { fontSize: 18, fontWeight: "900", color: "#14301f", marginTop: 4 },
  avatarPublicId:         { fontSize: 12, fontWeight: "800", color: "#7fa88a", letterSpacing: 1.5 },
  avatarPublicIdLoading:  { fontSize: 12, fontWeight: "600", color: "#c0d8c8" },
  changePhotoBtn:         { paddingVertical: 2 },
  changePhotoText:        { fontSize: 13, color: "#295c41", fontWeight: "700" },

  // ── Public ID ─────────────────────────────────────────────────────────────
  idRow:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  idLeft:        { flex: 1, gap: 3 },
  idLabel:       { fontSize: 10, fontWeight: "900", color: "#9ab09e", letterSpacing: 1.5, textTransform: "uppercase" },
  idValue:       { fontSize: 22, fontWeight: "900", color: "#295c41", letterSpacing: 2 },
  idValueLoading:{ fontSize: 16, fontWeight: "600", color: "#c0d8c8" },
  idHint:        { fontSize: 11, color: "#9ab09e", fontWeight: "600" },
  copyBtn: {
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, borderWidth: 1.5, borderColor: "#295c41",
  },
  copyBtnActive:       { backgroundColor: "#295c41" },
  copyBtnText:         { fontSize: 13, fontWeight: "800", color: "#295c41" },
  copyBtnTextActive:   { color: "#ffffff" },
  content: {
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 16,
    paddingBottom: 60,
  },

  // ── Card / collapsible shell ──────────────────────────────────────────────
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#d8e9dc",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  sectionHeaderLeft:  { flex: 1, gap: 3 },
  sectionTitle:       { fontSize: 15, fontWeight: "900", color: "#14301f", letterSpacing: 0.2 },
  sectionSubtitle:    { fontSize: 13, fontWeight: "700", color: "#7fa88a" },
  sectionArrow: {
    fontSize: 24, fontWeight: "300", color: "#9ab09e",
    transform: [{ rotate: "90deg" }], lineHeight: 28,
  },
  sectionArrowOpen:   { transform: [{ rotate: "270deg" }], color: "#295c41" },
  cardBody: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 20,
    borderTopWidth: 1,
    borderTopColor: "#f0f7f1",
  },

  // ── Fields ─────────────────────────────────────────────────────────────────
  field:      { gap: 10 },
  fieldLabel: { fontSize: 14, fontWeight: "800", color: "#31553a", marginLeft: 4 },
  input: {
    borderWidth: 1, borderColor: "#d8e9dc", borderRadius: 16,
    backgroundColor: "#f7fcf8",
    paddingHorizontal: 16, paddingVertical: 14,
    color: "#14301f", fontSize: 16, fontWeight: "600",
  },

  // ── Chips ──────────────────────────────────────────────────────────────────
  chipRow:        { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 18, paddingVertical: 12,
    borderRadius: 14, backgroundColor: "#f7fcf8",
    borderWidth: 1, borderColor: "#d8e9dc",
  },
  chipActive:     { backgroundColor: "#295c41", borderColor: "#295c41" },
  chipText:       { color: "#4a6654", fontWeight: "800", fontSize: 14 },
  chipTextActive: { color: "#ffffff" },

  // ── Save ───────────────────────────────────────────────────────────────────
  saveButton: {
    backgroundColor: "#295c41",
    borderRadius: 18, paddingVertical: 20, alignItems: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 10, elevation: 4,
  },
  saveButtonDisabled:       { opacity: 0.6 },
  saveButtonText:           { color: "#ffffff", fontSize: 17, fontWeight: "900", letterSpacing: 0.5 },
  saveButtonSuccess:        { backgroundColor: "#d8e9dc", elevation: 0 },
  saveButtonTextSuccess:    { color: "#295c41" },
  errorText: {
    color: "#9d3636", fontSize: 14, fontWeight: "700", textAlign: "center",
  },

  // ── Language selector (inline pills) ─────────────────────────────────────
  langRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#ffffff",
    borderRadius: 18, borderWidth: 1, borderColor: "#d8e9dc",
    paddingHorizontal: 20, paddingVertical: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05, shadowRadius: 10, elevation: 2,
  },
  langRowLabel: { fontSize: 15, fontWeight: "900", color: "#14301f" },
  langPills: { flexDirection: "row", gap: 8 },
  langPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 12, borderWidth: 1.5, borderColor: "#d8e9dc",
    backgroundColor: "#f7fcf8",
  },
  langPillActive:     { backgroundColor: "#295c41", borderColor: "#295c41" },
  langPillFlag:       { fontSize: 16 },
  langPillText:       { fontSize: 14, fontWeight: "800", color: "#4a6654" },
  langPillTextActive: { color: "#ffffff" },

  // ── Calculated goals ───────────────────────────────────────────────────────
  goalsBlock:  { gap: 12, paddingTop: 8 },
  goalsTitle: {
    fontSize: 12, fontWeight: "900", color: "#7fa88a",
    letterSpacing: 1.5, textTransform: "uppercase",
    marginBottom: 4, marginLeft: 4,
  },
  goalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16, paddingVertical: 18,
    borderRadius: 16, borderWidth: 1, borderColor: "#d8e9dc",
  },
  goalLabel: { fontSize: 15, fontWeight: "700", color: "#4a6654" },
  goalValue: { fontSize: 20, fontWeight: "900", color: "#14301f" },
});
