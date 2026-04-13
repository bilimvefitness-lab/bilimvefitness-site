import React from "react";
import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useLanguage } from "../i18n";
import {
  buildPostureIdentityViewModel,
  buildPostureResultViewModel,
} from "../features/posture/posturePresentation";
import { formatPostureHistoryDate } from "../features/posture/postureHistoryUtils";

function DetailFinding({ label }) {
  return (
    <View style={styles.findingRow}>
      <View style={styles.findingDot} />
      <Text style={styles.findingText}>{label}</Text>
    </View>
  );
}

function RecommendationCard({ card }) {
  return (
    <View style={styles.recommendationCard}>
      <View style={styles.recommendationCardHeader}>
        <Text style={styles.recommendationCardTitle}>{card.title}</Text>
        <Text style={styles.recommendationCardPurpose}>{card.purpose}</Text>
      </View>

      <View style={styles.recommendationCardItems}>
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

export default function PostureHistoryDetailScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { t, language } = useLanguage();
  const entry = route.params?.entry ?? null;

  if (!entry) {
    return (
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.heroCard}>
            <View style={styles.copyBlock}>
              <Text style={styles.title}>{t("posture.history.detailTitle")}</Text>
              <Text style={styles.subtitle}>{t("common.noData")}</Text>
            </View>

            <View style={styles.sectionCard}>
              <Text style={styles.recommendationText}>{t("posture.history.emptyText")}</Text>
            </View>

            <Pressable 
              style={({ pressed }) => [
                styles.historyLinkButton,
                pressed && { opacity: 0.5 }
              ]} 
              onPress={() => {
                require("expo-haptics").impactAsync(require("expo-haptics").ImpactFeedbackStyle.Light);
                navigation.goBack();
              }}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            >
              <Text style={styles.historyLinkText}>{t("common.back")}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const resultView = buildPostureResultViewModel(
    t,
    entry,
    {
      front: entry?.frontImageUri ? { uri: entry.frontImageUri } : null,
      side: entry?.sideImageUri ? { uri: entry.sideImageUri } : null,
    },
    null,
  );
  const identityView = buildPostureIdentityViewModel(t, entry, null);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.copyBlock}>
            <Text style={styles.title}>{t("posture.history.detailTitle")}</Text>
            <Text style={styles.subtitle}>
              {entry ? formatPostureHistoryDate(entry.date, language) : t("common.noData")}
            </Text>
          </View>

          <View style={styles.scoreCard}>
            <Text style={styles.scoreLabel}>{t("posture.result.scoreLabel")}</Text>
            <Text style={styles.scoreValue}>{resultView.scoreText}</Text>
            {identityView ? (
              <View style={styles.scoreLevelBadge}>
                <Text style={styles.scoreLevelText}>
                  {identityView.levelLabelCaption}: {identityView.levelNumber}. {identityView.levelLabel}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.previewGrid}>
            {entry?.frontImageUri ? (
              <View style={styles.previewCard}>
                <Image source={{ uri: entry.frontImageUri }} style={styles.previewImage} />
                <Text style={styles.previewTitle}>{t("posture.result.preview.frontTitle")}</Text>
              </View>
            ) : null}

            {entry?.sideImageUri ? (
              <View style={styles.previewCard}>
                <Image source={{ uri: entry.sideImageUri }} style={styles.previewImage} />
                <Text style={styles.previewTitle}>{t("posture.result.preview.sideTitle")}</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>{t("posture.result.findingsTitle")}</Text>
            <View style={styles.findingsList}>
              {resultView.findings.map((finding) => (
                <DetailFinding key={finding} label={finding} />
              ))}
            </View>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>{t("posture.result.recommendationTitle")}</Text>
            <Text style={styles.recommendationText}>{resultView.recommendation}</Text>
          </View>

          <View style={styles.sectionCard}>
            <Text style={styles.sectionLabel}>{resultView.recommendationsTitle}</Text>

            <View style={styles.recommendationCardList}>
              {resultView.recommendationCards.map((card) => (
                <RecommendationCard key={card.id} card={card} />
              ))}
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.historyLinkButton,
                pressed && { opacity: 0.5 }
              ]}
              onPress={() => {
                require("expo-haptics").impactAsync(require("expo-haptics").ImpactFeedbackStyle.Light);
                navigation.navigate("PostureRecommendations", { analysisResult: entry });
              }}
              hitSlop={{ top: 12, bottom: 12, left: 16, right: 16 }}
            >
              <Text style={styles.historyLinkText}>{resultView.recommendationsButtonLabel}</Text>
            </Pressable>
          </View>
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
    gap: 18,
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
  scoreCard: {
    backgroundColor: "#f4faf5",
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 8,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  scoreValue: {
    fontSize: 32,
    fontWeight: "900",
    color: "#14301f",
  },
  scoreLevelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  scoreLevelText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.3,
  },
  previewGrid: {
    flexDirection: "row",
    gap: 12,
  },
  previewCard: {
    flex: 1,
    gap: 8,
  },
  previewImage: {
    width: "100%",
    height: 136,
    borderRadius: 18,
    backgroundColor: "#edf5ee",
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: "900",
    color: "#4a6654",
    letterSpacing: 0.3,
  },
  sectionCard: {
    backgroundColor: "#f7fbf7",
    borderRadius: 20,
    padding: 18,
    gap: 12,
    borderWidth: 1,
    borderColor: "#d8e9dc",
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 1.1,
    textTransform: "uppercase",
  },
  findingsList: {
    gap: 10,
  },
  findingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  findingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#295c41",
  },
  findingText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    color: "#14301f",
  },
  recommendationText: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: "700",
    color: "#4a6654",
  },
  recommendationCardList: {
    gap: 12,
  },
  recommendationCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: "#e1ebe2",
  },
  recommendationCardHeader: {
    gap: 4,
  },
  recommendationCardTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.2,
  },
  recommendationCardPurpose: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "700",
    color: "#4a6654",
  },
  recommendationCardItems: {
    gap: 10,
  },
  recommendationItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  recommendationItemDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#295c41",
    marginTop: 7,
  },
  recommendationItemCopy: {
    flex: 1,
    gap: 2,
  },
  recommendationItemName: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    color: "#14301f",
  },
  recommendationItemDose: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
    color: "#7fa88a",
  },
  historyLinkButton: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  historyLinkText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.3,
  },
});
