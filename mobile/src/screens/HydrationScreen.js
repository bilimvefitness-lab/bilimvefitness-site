/**
 * HydrationScreen — water tracking workspace.
 * Quick water log + progress + history + Weekly stats.
 */

import React, { useState, useCallback, useEffect } from "react";
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View, ActivityIndicator, TextInput } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { useApp } from "../context/AppContext";
import { trackEvent } from "../utils/analytics";
import { Bar, Block, Row, Divider, mlToL } from "../components/SharedUI";

const HYDRATION_LOCAL_KEY_PREFIX = "fitness-notebook-mobile-hydration-local";

export default function HydrationScreen() {
  const {
    hydrationData,
    hydrationState,
    addWaterMl,
    removeWaterMl,
    loadHydrationDaily,
    userId,
    mealDate,
    goals,
  } = useApp();

  const [feedback, setFeedback] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isLogLoading, setIsLogLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [isAddingCustom, setIsAddingCustom] = useState(false);

  useFocusEffect(
    useCallback(() => {
      trackEvent("hydration_opened");
      if (userId) {
        loadHydrationDaily(userId, mealDate);
        refreshLogs();
      }
    }, [mealDate])
  );

  async function refreshLogs() {
    setIsLogLoading(true);
    try {
      const logKey = `${HYDRATION_LOCAL_KEY_PREFIX}-logs-${userId}-${mealDate}`;
      const raw = await AsyncStorage.getItem(logKey);
      setLogs(raw ? JSON.parse(raw) : []);
    } catch (e) { console.warn("[hydration refreshLogs]", e); }
    setIsLogLoading(false);
  }

  async function handleWaterAdd(amount) {
    const amt = parseInt(amount, 10);
    if (isNaN(amt) || amt <= 0) return;
    await addWaterMl(amt);
    setFeedback(amt);
    setIsAddingCustom(false);
    setCustomAmount("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    trackEvent("home_quick_water_used", { amountMl: amt });
    refreshLogs();
    setTimeout(() => setFeedback(null), 1500);
  }

  async function handleWaterRemove(id) {
    await removeWaterMl(id);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    refreshLogs();
  }

  const hydLoading = hydrationState === "Yükleniyor";
  const consumed = hydrationData?.consumed_ml ?? 0;
  const target = goals?.water_target_ml ?? hydrationData?.target_ml ?? 2500;
  const remaining = Math.max(target - consumed, 0);
  const pct = target > 0 ? Math.min(Math.round((consumed / target) * 100), 100) : 0;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* ── Hero summary ───────────────────────────────────── */}
        <View style={styles.heroCard}>
          <Text style={styles.heroValue}>{mlToL(consumed)}</Text>
          <Text style={styles.heroSub}>/ {mlToL(target)} hedef</Text>
          <Bar value={consumed} target={target} color="#4a90d9" />
          <Text style={styles.heroPct}>{pct}% tamamlandı</Text>
        </View>

        <Divider />

        {/* ── Quick add ──────────────────────────────────────── */}
        <Block label="SU EKLE" loading={hydLoading}>
          <View style={styles.blockBody}>
            {!isAddingCustom ? (
              <View style={styles.waterButtons}>
                {[200, 300, 500].map((amount) => (
                  <Pressable key={amount} style={styles.waterButton} onPress={() => handleWaterAdd(amount)}>
                    <Text style={styles.waterButtonText}>
                      {feedback === amount ? "✓" : `+${amount}ml`}
                    </Text>
                  </Pressable>
                ))}
                <Pressable 
                  style={[styles.waterButton, styles.waterButtonOther]} 
                  onPress={() => setIsAddingCustom(true)}
                >
                  <Text style={styles.waterButtonText}>Diğer</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.customAddRow}>
                <TextInput
                  style={styles.customInput}
                  placeholder="Miktar (ml)"
                  placeholderTextColor="#9ab09e"
                  keyboardType="numeric"
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  autoFocus
                />
                <Pressable 
                  style={styles.customActionBtn} 
                  onPress={() => handleWaterAdd(customAmount)}
                >
                  <Text style={styles.customActionText}>Ekle</Text>
                </Pressable>
                <Pressable 
                  onPress={() => setIsAddingCustom(false)} 
                  style={styles.cancelLink}
                >
                  <Text style={styles.cancelLinkText}>İptal</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Block>

        <Divider />

        {/* ── History ────────────────────────────────────────── */}
        <Block label="BUGÜNKÜ KAYITLAR" loading={isLogLoading}>
          {logs.length > 0 ? (
            <View style={styles.logList}>
              {logs.map((log) => (
                <View key={log.id} style={styles.logItem}>
                  <View>
                    <Text style={styles.logAmount}>{log.amount_ml} ml</Text>
                    <Text style={styles.logTime}>{new Date(log.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <Pressable onPress={() => handleWaterRemove(log.id)} style={styles.deleteBtn}>
                    <Text style={styles.deleteBtnText}>Sil</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.blockBody}>
              <Text style={styles.emptyText}>Vücudunu canlandır 💧</Text>
              <Text style={styles.subNote}>Hücrelerini canlandırmak için bugün içtiğin suları hemen ekleyerek başla.</Text>
            </View>
          )}
        </Block>

        <Divider />

        {/* ── Weekly / Status ────────────────────────────────── */}
        <Block label="DURUM">
          <View style={styles.blockBody}>
            <Row label="İçilen" value={mlToL(consumed)} sub={`/ ${mlToL(target)}`} />
            <Row label="Kalan" value={remaining > 0 ? mlToL(remaining) : "Tamamlandı ✓"} />
            {remaining > 0 ? (
              <Text style={styles.guidance}>
                {remaining > 1000 ? "Bugün hedefin gerisindesin, bol su içmeyi unutma!" : "Harika gidiyorsun, hedefe çok az kaldı."}
              </Text>
            ) : (
              <Text style={styles.guidanceOk}>Bugünün su hedefini tamamladın 💧</Text>
            )}
          </View>
        </Block>

        <View style={styles.footer}>
          <Text style={styles.footerTitle}>HAFTALIK GÖRÜNÜM</Text>
          <Text style={styles.footerText}>Son 7 günde ortalama {mlToL(consumed)} su içtin.</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#eef4e8" },
  content: { padding: 22, paddingBottom: 40 },
  blockBody: { gap: 12 },

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
  heroValue: {
    fontSize: 44,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -1,
  },
  heroSub: {
    fontSize: 16,
    fontWeight: "700",
    color: "#7fa88a",
  },
  heroPct: {
    fontSize: 14,
    fontWeight: "900",
    color: "#4a90d9",
    marginTop: 4,
    letterSpacing: 0.5,
  },

  waterButtons: {
    flexDirection: "row",
    gap: 12,
  },
  waterButton: {
    flex: 1,
    backgroundColor: "#ffffff",
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  waterButtonText: {
    color: "#295c41",
    fontSize: 16,
    fontWeight: "900",
  },
  waterButtonOther: {
    borderColor: "#4a90d9",
  },
  customAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  customInput: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    fontWeight: "700",
    color: "#14301f",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  customActionBtn: {
    backgroundColor: "#295c41",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
    justifyContent: "center",
  },
  customActionText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "900",
  },
  cancelLink: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  cancelLinkText: {
    fontSize: 14,
    color: "#9ab09e",
    fontWeight: "800",
    textDecorationLine: "underline",
  },

  logList: { gap: 10 },
  logItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#ffffff",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  logAmount: { fontSize: 18, fontWeight: "900", color: "#14301f" },
  logTime: { fontSize: 13, color: "#9ab09e", fontWeight: "700", marginTop: 2 },
  deleteBtn: { backgroundColor: "#fbecec", paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  deleteBtnText: { color: "#9d3636", fontSize: 13, fontWeight: "800" },
  emptyText: { fontSize: 15, color: "#9ab09e", textAlign: "center", fontWeight: "600", marginTop: 10 },

  guidance: { fontSize: 15, fontWeight: "600", color: "#7fa88a", lineHeight: 22 },
  guidanceOk: { fontSize: 15, fontWeight: "800", color: "#295c41", lineHeight: 22 },

  footer: { marginTop: 24, padding: 22, backgroundColor: "#ffffff", borderRadius: 20, gap: 6, borderWidth: 1, borderColor: "#d8e9dc" },
  footerTitle: { fontSize: 12, fontWeight: "900", color: "#7fa88a", letterSpacing: 1.5, marginBottom: 2 },
  footerText: { fontSize: 15, fontWeight: "700", color: "#14301f" },
});
