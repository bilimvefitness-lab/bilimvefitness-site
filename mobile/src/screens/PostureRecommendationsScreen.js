import React, { useMemo } from "react";
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useLanguage } from "../i18n";
import { buildPostureRecommendationCards } from "../features/posture/postureExerciseRecommendations";

function RecommendationCard({ card }) {
  return (
    <View style={styles.recommendationCard}>
      <View style={styles.recommendationHeader}>
        <Text style={styles.recommendationTitle}>{card.title}</Text>
        <Text style={styles.recommendationPurpose}>{card.purpose}</Text>
      </View>

      <View style={styles.recommendationItems}>
        {card.items.map((item) => (
          <View key={`${card.id}-${item.name}`} style={styles.recommendationItemRow}>
            <View style={styles.recommendationItemDot} />
            <View style={styles.recommendationItemCopy}>
              <Text style={styles.recommendationItemName}>{item.name}</Text>
              <Text style={styles.recommendationItemDose}>{item.dose}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function PostureRecommendationsScreen() {
  const route = useRoute();
  const { t } = useLanguage();
  const analysisResult = route.params?.analysisResult ?? null;

  const recommendationCards = useMemo(
    () => buildPostureRecommendationCards(t, analysisResult),
    [analysisResult, t],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.copyBlock}>
            <Text style={styles.title}>{t("posture.recommendations.title")}</Text>
            <Text style={styles.subtitle}>{t("posture.recommendations.subtitle")}</Text>
          </View>

          {recommendationCards.length ? (
            <View style={styles.recommendationStack}>
              {recommendationCards.map((card) => (
                <RecommendationCard key={card.id} card={card} />
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t("posture.recommendations.emptyTitle")}</Text>
              <Text style={styles.emptyText}>{t("posture.recommendations.emptyText")}</Text>
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
    gap: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: "#7fa88a",
  },
  recommendationStack: {
    gap: 16,
  },
  recommendationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingVertical: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: "#d8e9dc",
    shadowColor: "#295c41",
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  recommendationHeader: {
    gap: 6,
  },
  recommendationTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.4,
  },
  recommendationPurpose: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: "#4a6654",
  },
  recommendationItems: {
    gap: 12,
  },
  recommendationItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: "#f7fbf7",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#e1ebe2",
  },
  recommendationItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#295c41",
    marginTop: 8,
  },
  recommendationItemCopy: {
    flex: 1,
    gap: 4,
  },
  recommendationItemName: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#14301f",
  },
  recommendationItemDose: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
    color: "#7fa88a",
  },
  emptyCard: {
    backgroundColor: "#f7fbf7",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: "#14301f",
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "700",
    color: "#4a6654",
  },
});
