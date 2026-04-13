/**
 * NutritionScreen — high-fidelity nutrition workspace.
 * Meal input → realtime parse → clarify → macro preview → save → daily summary.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import { LayoutAnimation, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, UIManager, View, ActivityIndicator } from "react-native";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useFocusEffect } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { useApp } from "../context/AppContext";
import { trackEvent } from "../utils/analytics";
import { Bar, Block, Row, DateNav, Divider } from "../components/SharedUI";

// ── MacroCell: value + optional progress bar ──────────────────────────────────
function MacroCell({ label, value, unit, target, color }) {
  const pct = target > 0 ? Math.min(Math.round((value / target) * 100), 100) : 0;
  return (
    <View style={mcStyles.cell}>
      <Text style={mcStyles.label}>{label}</Text>
      <View style={mcStyles.valueRow}>
        <Text style={[mcStyles.value, { color }]}>{value}</Text>
        <Text style={mcStyles.unit}> {unit}</Text>
      </View>
      {target > 0 ? (
        <>
          <View style={mcStyles.track}>
            <View style={[mcStyles.fill, { width: `${Math.max(pct, pct > 0 ? 3 : 0)}%`, backgroundColor: color }]} />
          </View>
          <Text style={mcStyles.sub}>/ {target} {unit}</Text>
        </>
      ) : null}
    </View>
  );
}

const mcStyles = StyleSheet.create({
  cell: {
    flex: 1, minWidth: "44%",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 14,
    gap: 6,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  label: { fontSize: 11, fontWeight: "800", color: "#7fa88a", textTransform: "uppercase", letterSpacing: 0.8 },
  valueRow: { flexDirection: "row", alignItems: "baseline" },
  value: { fontSize: 22, fontWeight: "900", color: "#14301f" },
  unit:  { fontSize: 13, fontWeight: "700", color: "#7fa88a" },
  track: { height: 4, backgroundColor: "#e8f0e8", borderRadius: 4, overflow: "hidden" },
  fill:  { height: 4, borderRadius: 4 },
  sub:   { fontSize: 11, fontWeight: "700", color: "#9ab09e" },
});

// ─────────────────────────────────────────────────────────────────────────────

export default function NutritionScreen() {
  const {
    mealDate,
    setMealDate,
    dailySummary,
    dailyCoach,
    goals,
    stepInsight,
    summaryState,
    streakSummary,
    submitMeal,
    loadNutritionPreview,
    completeDay,
    loadDailyPanels,
    userId,
    hasProfile,
    deleteMeal,
  } = useApp();

  const [mealType, setMealType] = useState("kahvalti");
  const [mealText, setMealText] = useState("");
  const [isSavingMeal, setIsSavingMeal] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [feedbackMeal, setFeedbackMeal] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Advanced Flow States
  const [previewData, setPreviewData] = useState(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [resolvedOverrides, setResolvedOverrides] = useState({});
  const previewTimer = useRef(null);
  const lastLineCount = useRef(0);

  useFocusEffect(
    useCallback(() => {
      trackEvent("nutrition_opened");
      if (userId && hasProfile) loadDailyPanels(userId, mealDate, true);
    }, [mealDate])
  );

  const isDayCompleted = streakSummary?.completedDates?.includes(mealDate);

  // ── Realtime Preview ──────────────────────────────────────────────────────
  useEffect(() => {
    if (previewTimer.current) clearTimeout(previewTimer.current);
    
    const currentLineCount = mealText.split("\n").length;
    if (currentLineCount !== lastLineCount.current) {
      setResolvedOverrides({});
      setPreviewData(null);
      lastLineCount.current = currentLineCount;
    }

    if (!mealText.trim() || mealText.length < 3) {
      setPreviewData(null);
      return;
    }

    setIsPreviewLoading(true);
    setPreviewError(null);
    previewTimer.current = setTimeout(async () => {
      try {
        const p = await loadNutritionPreview(mealText, resolvedOverrides);
        setPreviewData(p);
        if (!p) setPreviewError("Önizleme yüklenemedi. Bağlantınızı kontrol edin.");
      } catch (err) {
        setPreviewError(err?.message || "Bağlantı hatası oluştu.");
      } finally {
        setIsPreviewLoading(false);
      }
    }, 800);
  }, [mealText, resolvedOverrides]);

  // ── Meal save ──────────────────────────────────────────────────────────────
  async function handleMealSave() {
    if (!mealText.trim()) return;
    if (isPreviewLoading) return;
    if (previewData?.needsClarification) return;
    if (!previewData || !previewData.items?.length || !previewData.totals) return;

    setIsSavingMeal(true);
    try {
      const result = await submitMeal(mealType, mealText, previewData);
      if (result === true) {
        setMealText("");
        setResolvedOverrides({});
        setPreviewData(null);
        setFeedbackMeal("Eklendi ✓");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setTimeout(() => setFeedbackMeal(null), 2000);
      } else {
        setFeedbackMeal("Kayıt başarısız");
        setTimeout(() => setFeedbackMeal(null), 3000);
      }
    } catch (err) {
      setFeedbackMeal("Hata oluştu");
      setTimeout(() => setFeedbackMeal(null), 3000);
    }
    setIsSavingMeal(false);
  }

  async function handleClarify(question, choice) {
    if (!question || typeof question.item_index !== "number") return;
    setResolvedOverrides(prev => ({
      ...prev,
      [question.item_index]: {
        grams: choice.estimated_weight_g,
        label: choice.label,
        foodName: question.raw_text
      }
    }));
  }

  async function handleCompleteDay() {
    setIsCompleting(true);
    await completeDay();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setIsCompleting(false);
  }

  function shiftDate(days) {
    const fromDate = mealDate;
    const d = new Date(`${mealDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    d.setHours(12, 0, 0, 0);
    const toDate = d.toISOString().slice(0, 10);
    trackEvent("date_changed", { fromDate, toDate, direction: days > 0 ? "next" : "previous" });
    setMealDate(toDate);
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const proteinCurrent  = dailySummary?.total_protein_g ?? dailyCoach?.actual_protein_g ?? null;
  const proteinTarget   = goals?.protein_target_g      ?? dailyCoach?.protein_target_g  ?? null;
  const calorieCurrent  = dailySummary?.total_kcal      ?? dailyCoach?.actual_kcal      ?? null;
  const calorieTarget   = stepInsight.adjustedCalorieTargetKcal ?? goals?.calorie_target_kcal ?? dailyCoach?.calorie_target_kcal ?? null;
  const carbsCurrent    = dailySummary?.total_carbs_g   ?? dailyCoach?.actual_carbs_g   ?? null;
  const carbsTarget     = goals?.carbs_target_g        ?? dailyCoach?.carbs_target_g    ?? null;
  const fatCurrent      = dailySummary?.total_fat_g     ?? dailyCoach?.actual_fat_g     ?? null;
  const fatTarget       = goals?.fat_target_g          ?? dailyCoach?.fat_target_g      ?? null;
  const nutritionLoading = summaryState === "Yükleniyor";


  // Recent meals from current day for "suggestions"
  const recentMeals = (dailySummary?.meals || []).map(m => m.raw_text).slice(-3);

  // All individual food items from resolved meals — drives the detail section
  const allFoodItems = (dailySummary?.meals || [])
    .filter(m => Array.isArray(m.items))
    .flatMap(m => m.items.filter(i => i.food_name));
  const hasDetails = allFoodItems.length > 0;

  function toggleDetail() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDetailOpen(v => !v);
  }


  return (
    <SafeAreaView style={styles.safe}>
      <DateNav date={mealDate} onPrev={() => shiftDate(-1)} onNext={() => shiftDate(1)} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── ÖĞÜN EKLE ─────────────────────────────────────── */}
        <Block label="ÖĞÜN EKLE" loading={isSavingMeal}>
          <View style={styles.blockBody}>
            {/* Meal Type Selection */}
            <View style={styles.mealTypeRow}>
              {[
                { key: "kahvalti", label: "Kahvaltı" },
                { key: "ogle",     label: "Öğle"     },
                { key: "aksam",    label: "Akşam"    },
                { key: "ara",      label: "Ara"       },
              ].map((t) => (
                <Pressable
                  key={t.key}
                  style={[styles.typeChip, mealType === t.key && styles.typeChipActive]}
                  onPress={() => setMealType(t.key)}
                >
                  <Text style={[styles.typeChipText, mealType === t.key && styles.typeChipTextActive]}>
                    {t.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Suggestions */}
            {recentMeals.length > 0 && !mealText && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestRow}>
                {recentMeals.map((m, i) => (
                  <Pressable key={i} style={styles.suggestPill} onPress={() => setMealText(m)}>
                    <Text style={styles.suggestPillText}>{m}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {/* Input Row */}
            <View style={styles.mealInputRow}>
              <TextInput
                style={styles.mealInput}
                placeholder="Örn: 2 dilim tam buğday ekmeği"
                placeholderTextColor="#9ab09e"
                value={mealText}
                onChangeText={setMealText}
                multiline
              />
              <Pressable
                style={[styles.actionBtn, (!mealText.trim() || isSavingMeal || isPreviewLoading || previewData?.needsClarification || (!previewData?.items?.length) || (!previewData?.totals)) && styles.actionBtnDisabled]}
                disabled={!mealText.trim() || isSavingMeal || isPreviewLoading || previewData?.needsClarification || (!previewData?.items?.length) || (!previewData?.totals)}
                onPress={() => handleMealSave()}
              >
                {isSavingMeal ? <ActivityIndicator size="small" color="#fff" /> : (
                  <Text style={styles.actionBtnText}>{feedbackMeal || "Ekle"}</Text>
                )}
              </Pressable>
            </View>

            {/* Live Preview / Clarification Area */}
            {isPreviewLoading && <ActivityIndicator size="small" color="#295c41" style={{marginTop: 10}} />}
            
            {previewError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{previewError}</Text>
              </View>
            )}

            {previewData && !isPreviewLoading && (
              <View style={styles.previewContainer}>
                {previewData.needsClarification && previewData.questions.map((q, i) => (
                  <View key={`clarify-${i}`} style={styles.clarifyBox}>
                    <Text style={styles.clarifyTitle}>{q.question || "Nasıl hazırlandı?"}</Text>
                    <Text style={styles.clarifySubItem}>"{q.raw_text}"</Text>
                    <View style={styles.clarifyRow}>
                      {(q.choices ?? []).map((opt, optIdx) => (
                        <Pressable key={optIdx} style={styles.clarifyChip} onPress={() => handleClarify(q, opt)}>
                          <Text style={styles.clarifyChipText}>{opt.label}</Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>
                ))}

                {!previewData.needsClarification && previewData.totals && (
                  <View style={styles.previewSummaryBox}>
                    <Text style={styles.previewSummaryLabel}>Özet:</Text>
                    <Text style={styles.previewSummaryValue}>
                      {Math.round(previewData.totals.kcal)} kcal • {Math.round(previewData.totals.protein_g)}g protein • {Math.round(previewData.totals.carbs_g)}g karb
                    </Text>
                  </View>
                )}

                {/* Parsed Items Breakdown */}
                {!previewData.needsClarification && previewData.items && previewData.items.length > 0 && (
                  <View style={styles.previewItemsBox}>
                    {previewData.items.map((item, idx) => (
                       <View key={`item-${idx}`} style={styles.previewItemRow}>
                         <View style={styles.previewItemLeft}>
                           <Text style={styles.previewItemName}>{item.canonical_display_name || item.food_name}</Text>
                           <Text style={styles.previewItemSub}>{item.raw_text !== item.food_name ? item.raw_text : `${item.estimated_weight_g}g`}</Text>
                         </View>
                         <View style={styles.previewItemRight}>
                           <Text style={styles.previewItemKcal}>{Math.round(item.nutrition?.kcal || 0)} kcal</Text>
                           <Text style={styles.previewItemMacros}>{Math.round(item.nutrition?.protein_g || 0)}P · {Math.round(item.nutrition?.carbs_g || 0)}K · {Math.round(item.nutrition?.fat_g || 0)}Y</Text>
                         </View>
                       </View>
                    ))}
                  </View>
                )}
              </View>
            )}
          </View>
        </Block>

        <Divider />

        {/* ── BESLENME — 4-macro grid + expandable food detail ─ */}
        <Block label="BESLENME" loading={nutritionLoading}>
          {dailySummary || dailyCoach || goals ? (
            <View style={styles.blockBody}>

              {/* 4-macro grid — always visible, updates immediately after each entry */}
              <View style={styles.macroGrid}>
                <MacroCell
                  label="Kalori"
                  value={Math.round(Number(calorieCurrent ?? 0))}
                  unit="kcal"
                  target={Math.round(Number(calorieTarget ?? 0))}
                  color="#295c41"
                />
                <MacroCell
                  label="Protein"
                  value={Math.round(Number(proteinCurrent ?? 0))}
                  unit="g"
                  target={Math.round(Number(proteinTarget ?? 0))}
                  color="#3f8a5f"
                />
                {(carbsCurrent !== null || carbsTarget !== null) ? (
                  <MacroCell
                    label="Karbonhidrat"
                    value={Math.round(Number(carbsCurrent ?? 0))}
                    unit="g"
                    target={Math.round(Number(carbsTarget ?? 0))}
                    color="#7a9e58"
                  />
                ) : null}
                {(fatCurrent !== null || fatTarget !== null) ? (
                  <MacroCell
                    label="Yağ"
                    value={Math.round(Number(fatCurrent ?? 0))}
                    unit="g"
                    target={Math.round(Number(fatTarget ?? 0))}
                    color="#a0c47a"
                  />
                ) : null}
              </View>

              {/* Expandable food detail — collapsed by default */}
              {hasDetails ? (
                <>
                  <Pressable onPress={toggleDetail} style={styles.detailToggleRow} hitSlop={8}>
                    <Text style={styles.detailToggleText}>
                      {detailOpen ? "▲ Gizle" : "▼ Öğün Detayları"}
                    </Text>
                    <Text style={styles.detailItemCount}>{allFoodItems.length} besin</Text>
                  </Pressable>

                  {detailOpen ? (
                    <View style={styles.detailList}>
                      {allFoodItems.map((item, idx) => (
                        <View key={idx} style={styles.detailRow}>
                          <View style={styles.detailLeft}>
                            <Text style={styles.detailFoodName} numberOfLines={2}>{item.food_name}</Text>
                            {item.estimated_weight_g > 0 ? (
                              <Text style={styles.detailPortion}>{item.estimated_weight_g} g</Text>
                            ) : null}
                          </View>
                          {item.nutrition ? (
                            <View style={styles.detailRight}>
                              <Text style={styles.detailKcal}>{Math.round(item.nutrition.kcal ?? 0)} kcal</Text>
                              <Text style={styles.detailMacros}>
                                {Math.round(item.nutrition.protein_g ?? 0)}P ·{" "}
                                {Math.round(item.nutrition.carbs_g  ?? 0)}K ·{" "}
                                {Math.round(item.nutrition.fat_g    ?? 0)}Y
                              </Text>
                            </View>
                          ) : null}
                        </View>
                      ))}
                    </View>
                  ) : null}
                </>
              ) : null}

            </View>
          ) : (
            <View style={styles.blockBody}>
              <Text style={styles.emptyText}>Miden boş mu? 🍽️</Text>
              <Text style={styles.subNote}>Henüz bir şey yemedin mi? Bugünün ilk öğününü ekleyerek enerjini takip edelim.</Text>
            </View>
          )}
        </Block>

        <Divider />

        {/* ── GÜNLÜK LİSTE ──────────────────────────────────── */}
        <Block label="GÜNLÜK LİSTE" loading={nutritionLoading}>
          {dailySummary?.meals?.length > 0 ? (
            <View style={styles.blockBody}>
              {dailySummary.meals.map((meal, idx) => (
                <View key={meal.meal_id || idx} style={styles.mealItem}>
                  <View style={styles.mealItemHeader}>
                    <Text style={styles.mealItemTitle}>
                      {meal.meal_type === "kahvalti" ? "🍳 Kahvaltı" :
                       meal.meal_type === "ogle"     ? "🍱 Öğle"     :
                       meal.meal_type === "aksam"    ? "🍽️ Akşam"   : "🍕 Ara Öğün"}
                    </Text>
                    <Text style={styles.mealItemKcal}>
                      {Math.round(meal.totals?.kcal ?? 0)} kcal
                    </Text>
                  </View>
                  <View style={styles.mealItemBody}>
                    <View style={{flex: 1, gap: 4}}>
                      {meal.items && meal.items.map((item, i) => (
                        <Text key={i} style={styles.mealItemFoodListText} numberOfLines={1}>
                          • {item.food_name}
                        </Text>
                      ))}
                      {(!meal.items || meal.items.length === 0) && (
                        <Text style={styles.mealItemText} numberOfLines={2}>{meal.raw_text}</Text>
                      )}
                    </View>
                    <Pressable
                      onPress={() => deleteMeal(meal.meal_id)}
                      style={styles.mealDeleteBtn}
                      hitSlop={15}
                    >
                      <Text style={styles.mealDeleteText}>Sil</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.blockBody}>
              <Text style={styles.emptyText}>Bugün henüz öğün eklenmedi.</Text>
            </View>
          )}
        </Block>

        <Divider />

        {/* ── GÜNÜ TAMAMLA ──────────────────────────────────── */}
        <Block label="DURUM" loading={isCompleting}>
          <View style={styles.blockBody}>
            {isDayCompleted ? (
              <View style={[styles.actionBtn, { backgroundColor: "#d8e9dc", alignItems: "center" }]}>
                <Text style={[styles.actionBtnText, { color: "#295c41" }]}>Gün Tamamlandı ✅</Text>
              </View>
            ) : (
              <Pressable style={[styles.actionBtn, { alignItems: "center" }]} onPress={handleCompleteDay}>
                <Text style={styles.actionBtnText}>Günü Tamamla 🔥</Text>
              </Pressable>
            )}
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
  emptyText: { fontSize: 16, fontWeight: "800", color: "#7fa88a", textAlign: "center", marginTop: 10 },
  subNote: { fontSize: 14, color: "#9ab09e", lineHeight: 20, fontWeight: "600", textAlign: "center", marginTop: 4 },

  mealTypeRow: { flexDirection: "row", gap: 10, marginBottom: 8 },
  typeChip: {
    flex: 1, paddingVertical: 12,
    borderRadius: 14, backgroundColor: "#ffffff",
    borderWidth: 1, borderColor: "#d8e9dc",
    alignItems: "center",
  },
  typeChipActive: { backgroundColor: "#295c41", borderColor: "#295c41" },
  typeChipText: { fontSize: 13, fontWeight: "800", color: "#7fa88a" },
  typeChipTextActive: { color: "#ffffff" },

  suggestRow: { marginBottom: 12 },
  suggestPill: { backgroundColor: "#ffffff", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, marginRight: 10, borderWidth: 1, borderColor: "#d8e9dc" },
  suggestPillText: { fontSize: 13, color: "#4a6654", fontWeight: "700" },

  mealInputRow: { gap: 12 },
  mealInput: {
    flex: 1, minHeight: 60, maxHeight: 150,
    backgroundColor: "#ffffff", borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 16,
    fontSize: 16, fontWeight: "600", color: "#14301f",
    borderWidth: 1, borderColor: "#d8e9dc",
    textAlignVertical: "top",
  },
  actionBtn: {
    backgroundColor: "#295c41", borderRadius: 16,
    paddingVertical: 18,
    alignItems: "center",
  },
  actionBtnDisabled: { opacity: 0.3 },
  actionBtnText: { color: "#ffffff", fontSize: 16, fontWeight: "900" },

  previewContainer: { marginTop: 4, gap: 10 },
  previewSummaryBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#e8f0e8", padding: 14, borderRadius: 14 },
  previewSummaryLabel: { fontSize: 13, fontWeight: "900", color: "#295c41", textTransform: "uppercase" },
  previewSummaryValue: { fontSize: 14, fontWeight: "800", color: "#14301f" },

  previewItemsBox: { gap: 8 },
  previewItemRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "#ffffff", padding: 12, borderRadius: 14, borderWidth: 1, borderColor: "#d8e9dc" },
  previewItemLeft: { flex: 1, justifyContent: "center" },
  previewItemName: { fontSize: 14, fontWeight: "800", color: "#14301f" },
  previewItemSub: { fontSize: 12, color: "#7fa88a", fontWeight: "600", marginTop: 2 },
  previewItemRight: { alignItems: "flex-end", justifyContent: "center" },
  previewItemKcal: { fontSize: 14, fontWeight: "900", color: "#14301f" },
  previewItemMacros: { fontSize: 11, fontWeight: "700", color: "#7fa88a", marginTop: 2 },

  clarifyBox: { backgroundColor: "#ffffff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#eecaca", gap: 12 },
  clarifyTitle: { fontSize: 15, fontWeight: "900", color: "#9d3636" },
  clarifySubItem: { fontSize: 13, color: "#14301f", fontStyle: "italic", fontWeight: "600" },
  clarifyRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  clarifyChip: { backgroundColor: "#295c41", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  clarifyChipText: { color: "#ffffff", fontSize: 13, fontWeight: "800" },

  mealItemFoodListText: { fontSize: 14, fontWeight: "700", color: "#14301f", lineHeight: 20 },

  // ── 4-macro grid ─────────────────────────────────────────────────────────────
  macroGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  // ── Expandable food detail ────────────────────────────────────────────────────
  detailToggleRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#f0f7f1", marginTop: 4,
  },
  detailToggleText: { fontSize: 13, fontWeight: "900", color: "#295c41", letterSpacing: 0.5 },
  detailItemCount:  { fontSize: 12, fontWeight: "700", color: "#9ab09e" },
  detailList: { gap: 10, marginTop: 4 },
  detailRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start",
    backgroundColor: "#f7fcf8", borderRadius: 12, padding: 14, gap: 12,
  },
  detailLeft:      { flex: 1, gap: 3 },
  detailFoodName:  { fontSize: 14, fontWeight: "800", color: "#14301f", lineHeight: 20 },
  detailPortion:   { fontSize: 12, fontWeight: "700", color: "#7fa88a" },
  detailRight:     { alignItems: "flex-end", gap: 3 },
  detailKcal:      { fontSize: 15, fontWeight: "900", color: "#14301f" },
  detailMacros:    { fontSize: 12, fontWeight: "700", color: "#7fa88a" },

  mealItem: {
    backgroundColor: "#ffffff", borderRadius: 18,
    padding: 20, gap: 8, borderWidth: 1, borderColor: "#d8e9dc",
    marginBottom: 4,
  },
  mealItemHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  mealItemTitle: { fontSize: 12, fontWeight: "900", color: "#7fa88a", letterSpacing: 1 },
  mealItemKcal: { fontSize: 16, fontWeight: "900", color: "#14301f" },
  mealItemBody: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", gap: 12 },
  mealItemText: { flex: 1, fontSize: 16, fontWeight: "700", color: "#14301f", lineHeight: 22 },
  mealDeleteBtn: { paddingVertical: 4, paddingHorizontal: 4 },
  mealDeleteText: { fontSize: 13, fontWeight: "800", color: "#9d3636", textDecorationLine: "underline" },
  errorBox: {
    backgroundColor: "#ffebee",
    padding: 10,
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#ffcdd2",
  },
  errorText: {
    color: "#c62828",
    fontSize: 13,
    textAlign: "center",
  },
});
