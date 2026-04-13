import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useLanguage } from "../i18n";
import { getPostureHistory } from "../features/posture/postureStorage";
import {
  buildPostureIdentityViewModel,
  buildPostureResultViewModel,
} from "../features/posture/posturePresentation";
import { formatPostureHistoryDate } from "../features/posture/postureHistoryUtils";

function HistoryCard({ item, language, t, onPress }) {
  const summaryView = buildPostureResultViewModel(
    t,
    item,
    {
      front: item.frontImageUri ? { uri: item.frontImageUri } : null,
      side: item.sideImageUri ? { uri: item.sideImageUri } : null,
    },
    null,
  );
  const identityView = buildPostureIdentityViewModel(t, item, null);
  const compactFindings = summaryView.findings.slice(0, 2);

  return (
    <Pressable 
      style={({ pressed }) => [
        styles.historyCard,
        pressed && { opacity: 0.7, transform: [{ scale: 0.98 }] }
      ]} 
      onPress={() => {
        require("expo-haptics").impactAsync(require("expo-haptics").ImpactFeedbackStyle.Light);
        onPress?.();
      }}
    >
      <View style={styles.historyHeader}>
        <View style={styles.historyCopy}>
          <Text style={styles.historyDate}>{formatPostureHistoryDate(item.date, language)}</Text>
          <Text style={styles.historyScore}>{item.score} / 100</Text>
        </View>
        <View style={styles.historyConfidenceBadge}>
          <Text style={styles.historyConfidenceText}>{summaryView.confidenceLabel}</Text>
        </View>
      </View>

      <View style={styles.historySummaryList}>
        {identityView ? (
          <View style={styles.historyLevelBadge}>
            <Text style={styles.historyLevelText}>
              {identityView.levelNumber}. {identityView.levelLabel}
            </Text>
          </View>
        ) : null}

        {compactFindings.map((finding) => (
          <Text key={`${item.id}-${finding}`} style={styles.historySummaryText}>
            {finding}
          </Text>
        ))}
      </View>
    </Pressable>
  );
}

export default function PostureHistoryScreen() {
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    const nextHistory = await getPostureHistory();
    setHistory(nextHistory);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.copyBlock}>
            <Text style={styles.title}>{t("posture.history.title")}</Text>
            <Text style={styles.subtitle}>{t("posture.history.subtitle")}</Text>
          </View>

          {loading ? (
            <View style={styles.loadingState}>
              <ActivityIndicator size="small" color="#295c41" />
            </View>
          ) : history.length ? (
            <View style={styles.historyList}>
              {history.map((item) => (
                <HistoryCard
                  key={item.id}
                  item={item}
                  language={language}
                  t={t}
                  onPress={() => navigation.navigate("PostureHistoryDetail", { entry: item })}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t("posture.history.emptyTitle")}</Text>
              <Text style={styles.emptyText}>{t("posture.history.emptyText")}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef4e8",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  heroCard: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    backgroundColor: "#ffffff",
    borderRadius: 28,
    paddingHorizontal: 28,
    paddingVertical: 32,
    gap: 20,
    shadowColor: "#295c41",
    shadowOpacity: 0.08,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 4,
  },
  copyBlock: {
    gap: 10,
  },
  title: {
    fontSize: 30,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "700",
    color: "#7fa88a",
  },
  loadingState: {
    minHeight: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  historyList: {
    gap: 14,
  },
  historyCard: {
    backgroundColor: "#f7fbf7",
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  historyCopy: {
    gap: 6,
  },
  historyDate: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7fa88a",
    letterSpacing: 0.4,
  },
  historyScore: {
    fontSize: 24,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.3,
  },
  historyConfidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  historyConfidenceText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#4a6654",
    letterSpacing: 0.3,
  },
  historySummaryList: {
    gap: 8,
  },
  historyLevelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  historyLevelText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.3,
  },
  historySummaryText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#4a6654",
  },
  emptyCard: {
    backgroundColor: "#f7fbf7",
    borderRadius: 20,
    padding: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#14301f",
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#7fa88a",
  },
});
