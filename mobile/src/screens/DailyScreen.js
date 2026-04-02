import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, TextInput } from "react-native";
import * as Haptics from "expo-haptics";
import { useApp } from "../context/AppContext";
import { trackEvent } from "../utils/analytics";

// ─── Tiny helpers (local, no imports) ────────────────────────────────────────

function minutesToHMS(minutes) {
  const m = Number(minutes || 0);
  if (m <= 0) return "-";
  return `${Math.floor(m / 60)}s ${m % 60}dk`;
}

function mlToL(ml) {
  const v = Number(ml || 0);
  if (v <= 0) return "-";
  return `${(v / 1000).toFixed(1)}L`;
}

function stepFmt(n) {
  return Math.max(Number(n || 0), 0).toLocaleString("tr-TR");
}

function pct(current, target) {
  if (!target || !current) return 0;
  return Math.min(Math.round((Number(current) / Number(target)) * 100), 100);
}

// ─── Tiny progress bar ───────────────────────────────────────────────────────

function Bar({ value, target, color = "#295c41" }) {
  const width = pct(value, target);
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.max(width, width > 0 ? 4 : 0)}%`, backgroundColor: color }]} />
    </View>
  );
}

// ─── Section block ────────────────────────────────────────────────────────────

function Block({ label, loading, children }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      {loading ? <ActivityIndicator color="#295c41" style={{ marginTop: 6 }} /> : children}
    </View>
  );
}

// ─── Row: label + value ───────────────────────────────────────────────────────

function Row({ label, value, sub }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value ?? "-"}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ─── Date navigation ──────────────────────────────────────────────────────────

function DateNav({ date, onPrev, onNext }) {
  const isToday = date === new Date().toISOString().slice(0, 10);
  const [, month, day] = date.split("-");
  const label = `${parseInt(day)} ${["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"][parseInt(month) - 1]}`;
  return (
    <View style={styles.dateNav}>
      <Pressable onPress={onPrev} style={styles.dateArrow}>
        <Text style={styles.dateArrowText}>‹</Text>
      </Pressable>
      <Text style={styles.dateLabel}>{isToday ? "Bugün" : label}</Text>
      <Pressable onPress={onNext} style={[styles.dateArrow, isToday && styles.dateArrowDisabled]} disabled={isToday}>
        <Text style={[styles.dateArrowText, isToday && styles.dateArrowTextDisabled]}>›</Text>
      </Pressable>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function DailyScreen() {
  const {
    mealDate,
    setMealDate,
    dailySummary,
    dailyCoach,
    summaryState,
    goals,
    todaySteps,
    stepPermission,
    stepInsight,
    sleepData,
    sleepState,
    hydrationData,
    hydrationState,
    addWaterMl,
    submitMeal,
    addManualSteps,
    completeDay,
    streakSummary,
  } = useApp();

  const [mealType, setMealType] = React.useState("kahvalti");
  const [mealText, setMealText] = React.useState("");
  const [isSavingMeal, setIsSavingMeal] = React.useState(false);
  const [isCompleting, setIsCompleting] = React.useState(false);
  
  // UX Feedback states
  const [feedbackMeal, setFeedbackMeal] = React.useState(null);
  const [feedbackWater, setFeedbackWater] = React.useState(null);
  const [feedbackSteps, setFeedbackSteps] = React.useState(null);

  React.useEffect(() => { trackEvent("daily_opened"); }, []);

  const isDayCompletedForCurrentDate = streakSummary?.completedDates?.includes(mealDate);

  async function handleCompleteDay() {
    setIsCompleting(true);
    await completeDay();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setIsCompleting(false);
  }

  async function handleMealSave() {
    if (!mealText.trim()) return;
    setIsSavingMeal(true);
    const success = await submitMeal(mealType, mealText);
    if (success) {
      setMealText("");
      setFeedbackMeal("Eklendi ✓");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setTimeout(() => setFeedbackMeal(null), 2000);
    }
    setIsSavingMeal(false);
  }

  async function handleWaterAdd(amount) {
    await addWaterMl(amount);
    setFeedbackWater(amount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => setFeedbackWater(null), 1500);
  }

  async function handleStepsAdd(amount) {
    await addManualSteps(amount);
    setFeedbackSteps(amount);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setTimeout(() => setFeedbackSteps(null), 1500);
  }

  function shiftDate(days) {
    const fromDate = mealDate;
    const d = new Date(`${mealDate}T12:00:00`);
    d.setDate(d.getDate() + days);
    d.setHours(12, 0, 0, 0);
    const toDate = d.toISOString().slice(0, 10);
    trackEvent("date_changed", {
      fromDate,
      toDate,
      direction: days > 0 ? "next" : "previous",
    });
    setMealDate(toDate);
  }

  // ── Nutrition values ──────────────────────────────────────────────────────
  const proteinCurrent = dailyCoach?.actual_protein_g ?? dailySummary?.total_protein_g ?? null;
  const proteinTarget = goals?.protein_target_g ?? dailyCoach?.protein_target_g ?? null;
  const calorieCurrent = dailyCoach?.actual_kcal ?? dailySummary?.total_kcal ?? null;
  const calorieTarget =
    stepInsight.adjustedCalorieTargetKcal ?? goals?.calorie_target_kcal ?? dailyCoach?.calorie_target_kcal ?? null;
  const nutritionLoading = summaryState === "Yükleniyor";

  // ── Steps values ──────────────────────────────────────────────────────────
  const stepCount = Number(todaySteps?.stepCount ?? 0);
  const stepGoal = stepInsight.adaptiveGoal || 10000;
  const stepReady = todaySteps?.available && stepPermission?.status === "granted";

  // ── Sleep values ──────────────────────────────────────────────────────────
  const sleepLoading = sleepState === "Yükleniyor";

  // ── Hydration values ──────────────────────────────────────────────────────
  const hydLoading = hydrationState === "Yükleniyor";

  return (
    <SafeAreaView style={styles.safe}>
      <DateNav date={mealDate} onPrev={() => shiftDate(-1)} onNext={() => shiftDate(1)} />

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── ÖĞÜN EKLE (Yeni) ───────────────────────────────────── */}
        <Block label="ÖĞÜN EKLE" loading={isSavingMeal}>
          <View style={styles.blockBody}>
            <View style={styles.mealTypeRow}>
              {["Kahvaltı", "Öğle", "Akşam", "Ara"].map((t) => (
                <Pressable
                  key={t}
                  style={[styles.typeChip, mealType === t.toLowerCase() && styles.typeChipActive]}
                  onPress={() => setMealType(t.toLowerCase())}
                >
                  <Text style={[styles.typeChipText, mealType === t.toLowerCase() && styles.typeChipTextActive]}>
                    {t}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.mealInputRow}>
              <TextInput
                style={styles.mealInput}
                placeholder="Örn: 3 yumurta, 100g peynir"
                placeholderTextColor="#9ab09e"
                value={mealText}
                onChangeText={setMealText}
                multiline
              />
              <Pressable
                style={[styles.saveMealBtn, (!mealText.trim() || isSavingMeal) && styles.saveMealBtnDisabled]}
                disabled={!mealText.trim() || isSavingMeal}
                onPress={handleMealSave}
              >
                <Text style={styles.saveMealBtnText}>{feedbackMeal || "Ekle"}</Text>
              </Pressable>
            </View>
          </View>
        </Block>

        <View style={styles.divider} />

        {/* ── BESLENME ───────────────────────────────────────────── */}
        <Block label="BESLENME" loading={nutritionLoading}>
          {dailySummary || dailyCoach ? (
            <View style={styles.blockBody}>
              <Row
                label="Protein"
                value={`${Math.round(Number(proteinCurrent ?? 0))}g`}
                sub={proteinTarget ? `/ ${Math.round(Number(proteinTarget))}g` : null}
              />
              <Bar value={proteinCurrent} target={proteinTarget} color="#295c41" />
              <Row
                label="Kalori"
                value={`${Math.round(Number(calorieCurrent ?? 0))} kcal`}
                sub={calorieTarget ? `/ ${Math.round(Number(calorieTarget))} kcal` : null}
              />
              <Bar value={calorieCurrent} target={calorieTarget} color="#3f8a5f" />
            </View>
          ) : (
            <View style={styles.blockBody}>
              <Text style={styles.emptyText}>Henüz öğün eklemedin.</Text>
              <Text style={styles.subNote}>Yukarıdaki alandan yediklerini ekleyerek makro takibine başla.</Text>
            </View>
          )}
        </Block>

        <View style={styles.divider} />

        {/* ── ADIMLAR ────────────────────────────────────────────── */}
        <Block label="ADIMLAR" loading={false}>
          {stepReady || stepPermission?.status === "pending" || !stepReady ? (
            <View style={styles.blockBody}>
              <Row
                label="Adım"
                value={stepFmt(stepCount)}
                sub={`/ ${stepFmt(stepGoal)}`}
              />
              <Bar value={stepCount} target={stepGoal} color="#2e7a51" />
              {stepInsight.activityLabel ? (
                <Text style={styles.subNote}>Aktivite: {stepInsight.activityLabel}</Text>
              ) : null}
              
              {!stepReady && (
                <>
                  <View style={[styles.manualBanner, { marginTop: 12, marginBottom: 8 }]}>
                    <Text style={styles.manualBannerTitle}>📱 Manuel takip aktif</Text>
                    <Text style={styles.subNote}>
                      Sağlık izni olmadan da adımlarını takip edebilirsin. Aşağıdan ekle, gün sonunda sayacın güncel kalsın.
                    </Text>
                  </View>
                  <View style={styles.waterButtons}>
                    {[500, 1000, 2000].map((amount) => (
                      <Pressable
                        key={amount}
                        style={styles.waterButton}
                        onPress={() => handleStepsAdd(amount)}
                      >
                        <Text style={styles.waterButtonText}>
                          {feedbackSteps === amount ? "✓" : `+${amount}`}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </View>
          ) : (
            <View style={styles.blockBody}>
              <Text style={styles.emptyText}>
                {stepPermission?.status === "pending" ? "Sağlık verisine erişim izni bekleniyor." : "Adım verisi yok."}
              </Text>
              <Text style={styles.subNote}>
                {stepPermission?.status === "pending" 
                  ? "Adım takibi için izin onayı gerekli." 
                  : "Adımların henüz senkronize olmadı veya kaydedilmedi."}
              </Text>
            </View>
          )}
        </Block>

        <View style={styles.divider} />

        {/* ── UYKU ───────────────────────────────────────────────── */}
        <Block label="UYKU" loading={sleepLoading}>
          {sleepData ? (
            <View style={styles.blockBody}>
              <Row label="Toplam" value={minutesToHMS(sleepData.total_sleep_minutes)} />
              {sleepData.bedtime ? (
                <Row label="Yattı" value={String(sleepData.bedtime).slice(0, 5)} />
              ) : null}
              {sleepData.wake_time ? (
                <Row label="Kalktı" value={String(sleepData.wake_time).slice(0, 5)} />
              ) : null}
            </View>
          ) : (
            <View style={styles.blockBody}>
              <Text style={styles.emptyText}>Bugün için uyku verisi bulunamadı.</Text>
              <Text style={styles.subNote}>Telefonunun sağlık uygulamasında kayıtlı olduğunda burada görünecek.</Text>
            </View>
          )}
        </Block>

        <View style={styles.divider} />

        {/* ── SU ─────────────────────────────────────────────────── */}
        <Block label="SU" loading={hydLoading}>
          {hydrationData ? (
            <View style={styles.blockBody}>
              <Row
                label="İçilen"
                value={mlToL(hydrationData.consumed_ml)}
                sub={`/ ${mlToL(hydrationData.target_ml)}`}
              />
              <Bar value={hydrationData.consumed_ml} target={hydrationData.target_ml} color="#4a90d9" />
              <View style={styles.waterButtons}>
                {[200, 300, 500].map((amount) => (
                  <Pressable
                    key={amount}
                    style={styles.waterButton}
                    onPress={() => handleWaterAdd(amount)}
                  >
                    <Text style={styles.waterButtonText}>
                      {feedbackWater === amount ? "✓" : `+${amount}ml`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.blockBody}>
              <Text style={styles.emptyText}>Bugün hiç su girmedin.</Text>
              <Text style={[{marginBottom: 10}, styles.subNote]}>Aşağıdan içtiğin miktarı seçebilirsin:</Text>
              <View style={styles.waterButtons}>
                {[200, 300, 500].map((amount) => (
                  <Pressable
                    key={amount}
                    style={styles.waterButton}
                    onPress={() => handleWaterAdd(amount)}
                  >
                    <Text style={styles.waterButtonText}>
                      {feedbackWater === amount ? "✓" : `+${amount}ml`}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </Block>

        <View style={styles.divider} />

        {/* ── GÜNÜ TAMAMLA ───────────────────────────────────────── */}
        <Block label="DURUM" loading={isCompleting}>
          <View style={styles.blockBody}>
            {isDayCompletedForCurrentDate ? (
               <View style={[styles.saveMealBtn, { backgroundColor: "#d8e9dc", alignItems: "center" }]}>
                 <Text style={[styles.saveMealBtnText, { color: "#295c41" }]}>Gün Tamamlandı ✅</Text>
               </View>
            ) : (
               <Pressable
                 style={[styles.saveMealBtn, { alignItems: "center" }]}
                 onPress={handleCompleteDay}
               >
                 <Text style={styles.saveMealBtnText}>Günü Tamamla 🔥</Text>
               </Pressable>
            )}
          </View>
        </Block>

      </ScrollView>
    </SafeAreaView>
  );
}

import React from "react";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef4e8",
  },
  content: {
    padding: 20,
    gap: 0,
    paddingBottom: 40,
  },

  // Date nav
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    paddingVertical: 12,
    backgroundColor: "#eef4e8",
  },
  dateArrow: {
    padding: 8,
  },
  dateArrowDisabled: {
    opacity: 0.25,
  },
  dateArrowText: {
    fontSize: 24,
    color: "#295c41",
    fontWeight: "700",
  },
  dateArrowTextDisabled: {
    color: "#9ab09e",
  },
  dateLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#14301f",
    minWidth: 80,
    textAlign: "center",
  },

  // Blocks
  block: {
    paddingVertical: 20,
  },
  blockLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  blockBody: {
    gap: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#d8e9dc",
    marginHorizontal: 0,
  },

  // Rows
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: "#4a6654",
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  rowValue: {
    fontSize: 18,
    fontWeight: "800",
    color: "#14301f",
  },
  rowSub: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7fa88a",
  },
  subNote: {
    fontSize: 13,
    color: "#7fa88a",
    fontWeight: "600",
  },

  // Bar
  barTrack: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#d8e9dc",
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 999,
  },

  // Empty
  emptyText: {
    color: "#9ab09e",
    fontSize: 14,
    lineHeight: 20,
  },

  // Manual tracking banner
  manualBanner: {
    backgroundColor: "#e8f0ea",
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  manualBannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#295c41",
  },

  // Water buttons
  waterButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },
  waterButton: {
    flex: 1,
    backgroundColor: "#dbeef3",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  waterButtonText: {
    color: "#1a5272",
    fontWeight: "800",
    fontSize: 14,
  },

  // Meal Input
  mealTypeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  typeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#e8f0e6",
  },
  typeChipActive: {
    backgroundColor: "#295c41",
  },
  typeChipText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#31553a",
  },
  typeChipTextActive: {
    color: "#ffffff",
  },
  mealInputRow: {
    flexDirection: "row",
    gap: 8,
  },
  mealInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#c9d7c7",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#14301f",
    fontSize: 14,
    minHeight: 44,
  },
  saveMealBtn: {
    backgroundColor: "#295c41",
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  saveMealBtnDisabled: {
    opacity: 0.5,
  },
  saveMealBtnText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 14,
  },
});
