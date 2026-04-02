import { SafeAreaView, ScrollView, StyleSheet, Text, TextInput, Pressable, View, ActivityIndicator } from "react-native";
import { useEffect, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useApp } from "../context/AppContext";
import { trackEvent } from "../utils/analytics";

const GENDER_OPTIONS = [
  { value: "male", label: "Erkek" },
  { value: "female", label: "Kadın" },
];
const ACTIVITY_OPTIONS = [
  { value: "sedentary", label: "Sedanter" },
  { value: "light", label: "Hafif" },
  { value: "moderate", label: "Orta" },
  { value: "active", label: "Aktif" },
  { value: "very_active", label: "Çok aktif" },
];
const GOAL_OPTIONS = [
  { value: "fat_loss", label: "Yağ kaybı" },
  { value: "muscle_gain", label: "Kas kazanımı" },
  { value: "recomposition", label: "Şekillenme" },
  { value: "maintenance", label: "Koruma" },
];

function FieldInput({ label, value, onChangeText, keyboardType = "default" }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
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

export default function ProfileScreen() {
  const { profileForm, setProfileForm, profileState, goals, saveProfile } = useApp();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const navigation = useNavigation();

  useEffect(() => { trackEvent("profile_opened"); }, []);

  function update(key, val) {
    setProfileForm((prev) => ({ ...prev, [key]: val }));
    setSaved(false);
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

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── Form ─────────────────────────────────────────────── */}
        <View style={styles.section}>
          <Pressable onLongPress={__DEV__ ? () => navigation.navigate("AnalyticsDebug") : undefined}>
            <Text style={styles.sectionTitle}>Ölçüler</Text>
          </Pressable>
          <FieldInput label="Kilo (kg)" value={profileForm.weight_kg} onChangeText={(v) => update("weight_kg", v)} keyboardType="numeric" />
          <FieldInput label="Boy (cm)" value={profileForm.height_cm} onChangeText={(v) => update("height_cm", v)} keyboardType="numeric" />
          <FieldInput label="Yaş" value={profileForm.age} onChangeText={(v) => update("age", v)} keyboardType="numeric" />
        </View>

        <View style={styles.section}>
          <ChipGroup label="Cinsiyet" options={GENDER_OPTIONS} value={profileForm.gender} onChange={(v) => update("gender", v)} />
          <ChipGroup label="Aktivite seviyesi" options={ACTIVITY_OPTIONS} value={profileForm.activity_level} onChange={(v) => update("activity_level", v)} />
          <ChipGroup label="Hedef" options={GOAL_OPTIONS} value={profileForm.goal} onChange={(v) => update("goal", v)} />
        </View>

        {/* ── Save button ──────────────────────────────────────── */}
        <Pressable
          style={[styles.saveButton, saving && styles.saveButtonDisabled, saved && styles.saveButtonSuccess]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={[styles.saveButtonText, saved && styles.saveButtonTextSuccess]}>{saved ? "Kaydedildi ✓" : "Kaydet"}</Text>
          )}
        </Pressable>

        {profileState.tone === "error" ? (
          <Text style={styles.errorText}>{profileState.feedback}</Text>
        ) : null}

        {/* ── Calculated goals ─────────────────────────────────── */}
        {goals ? (
          <View style={styles.goalsBlock}>
            <Text style={styles.goalsTitle}>Hesaplanan Hedefler</Text>
            <GoalRow label="Protein" value={goals.protein_target_g ? `${Math.round(goals.protein_target_g)}g` : null} />
            <GoalRow label="Kalori" value={goals.calorie_target_kcal ? `${Math.round(goals.calorie_target_kcal)} kcal` : null} />
            <GoalRow label="Su" value={goals.water_target_ml ? `${(goals.water_target_ml / 1000).toFixed(1)}L` : null} />
          </View>
        ) : null}

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
    padding: 24,
    gap: 24,
    paddingBottom: 48,
  },

  // Sections
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },

  // Field
  field: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#31553a",
  },
  input: {
    borderWidth: 1,
    borderColor: "#c9d7c7",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#14301f",
    fontSize: 15,
  },

  // Chips
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#e8f0e6",
  },
  chipActive: {
    backgroundColor: "#295c41",
  },
  chipText: {
    color: "#31553a",
    fontWeight: "700",
    fontSize: 13,
  },
  chipTextActive: {
    color: "#ffffff",
  },

  // Save
  saveButton: {
    backgroundColor: "#295c41",
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
  },
  saveButtonSuccess: {
    backgroundColor: "#d8e9dc",
  },
  saveButtonTextSuccess: {
    color: "#295c41",
  },
  errorText: {
    color: "#9d3636",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  // Goals
  goalsBlock: {
    gap: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#d8e9dc",
  },
  goalsTitle: {
    fontSize: 12,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 1.2,
    textTransform: "uppercase",
  },
  goalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  goalLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4a6654",
  },
  goalValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#14301f",
  },
});
