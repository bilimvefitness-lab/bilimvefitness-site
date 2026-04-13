import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PostureImageWithOverlays, styles as baseStyles } from "./postureVisualEngine";

function resolveHook(t, scoreDiff) {
  if (scoreDiff >= 3) return t("posture.share.hooks.improvement");
  if (scoreDiff <= -3) return t("posture.share.hooks.shift");
  return t("posture.share.hooks.stable");
}

function resolveConsistencyLevelFromView(view) {
  const consistency = view?.consistency;
  return consistency?.consistencyLevel ?? (consistency?.isConsistent === false ? "low" : "high");
}

export const StoryVariant = React.forwardRef(({ view, previous, t }, ref) => {
  if (!view) return null;
  const scoreDiff = previous ? Math.round(view.score - previous.score) : 0;
  const diffPrefix = scoreDiff > 0 ? "+" : "";
  const consistencyLevel = resolveConsistencyLevelFromView(view);
  const showTrustBadge = previous && consistencyLevel === "high";

  return (
    <View ref={ref} collapsable={false} style={styles.storyContainer}>
      <Text style={styles.storyHeadline}>{resolveHook(t, scoreDiff)}</Text>

      <View style={styles.storyGrid}>
        <View style={styles.storyPanel}>
          <Text style={styles.storyLabel}>{t("posture.share.before")}</Text>
          <PostureImageWithOverlays
            uri={previous?.sideImageUri || view.checkpoint?.sideImageUri || ""}
            landmarks={previous?.findings?.landmarks?.side || view.checkpoint?.landmarks?.side}
            viewType="side"
            style={styles.storyImage}
          />
        </View>
        <View style={styles.storyPanel}>
          <Text style={styles.storyLabel}>{t("posture.share.after")}</Text>
          <PostureImageWithOverlays
            uri={view.checkpoint?.sideImageUri || ""}
            landmarks={view.checkpoint?.landmarks?.side}
            viewType="side"
            style={styles.storyImage}
          />
        </View>
      </View>

      {consistencyLevel === "low" && (
        <View style={styles.consistencyHint}>
          <Text style={styles.consistencyHintText}>{t("posture.result.accuracy.consistency.hints.low")}</Text>
        </View>
      )}

      <View style={styles.storyFooter}>
        {showTrustBadge && (
          <View style={styles.trustBadge}>
            <Text style={styles.trustBadgeText}>{t("posture.share.trustBadge")}</Text>
          </View>
        )}
        <View style={styles.viralHookRow}>
          <Text style={styles.viralHookText}>{"\u25b6"} {t("posture.share.hooks.testPosture")}</Text>
        </View>
        <View style={styles.storyBadge}>
          <Text style={styles.storyBadgeText}>
            {previous ? `${diffPrefix}${scoreDiff} ${t("posture.progress.diffSuffix")}` : `${view.score}`}
          </Text>
        </View>
        <Text style={styles.storyBranding}>{t("posture.share.branding")}</Text>
      </View>
    </View>
  );
});

export const SocialProofVariant = React.forwardRef(({ view, previous, t }, ref) => {
  if (!view) return null;
  const scoreDiff = previous ? Math.round(view.score - previous.score) : 0;
  const diffPrefix = scoreDiff > 0 ? "+" : "";
  const identity = view.identity || {};
  const consistencyLevel = resolveConsistencyLevelFromView(view);
  const showTrustBadge = previous && consistencyLevel === "high";

  return (
    <View ref={ref} collapsable={false} style={styles.cardContainer}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.cardSub}>{t("posture.share.hooks.progressTitle")}</Text>
          <Text style={styles.cardTitle}>{t("posture.identity.scoreLabel")}: {view.score}</Text>
        </View>
        <View style={styles.cardLevelBadge}>
          <Text style={styles.cardLevelText}>{identity.levelLabel || "..."}</Text>
        </View>
      </View>

      <View style={styles.cardGrid}>
         <PostureImageWithOverlays
            uri={previous?.sideImageUri || view.checkpoint?.sideImageUri || ""}
            landmarks={previous?.findings?.landmarks?.side || view.checkpoint?.landmarks?.side}
            viewType="side"
            style={styles.cardImage}
          />
          <PostureImageWithOverlays
            uri={view.checkpoint?.sideImageUri || ""}
            landmarks={view.checkpoint?.landmarks?.side}
            viewType="side"
            style={styles.cardImage}
          />
      </View>

      <View style={styles.cardFooter}>
        <View>
          <Text style={styles.cardProgressText}>
            {previous ? `${diffPrefix}${scoreDiff} ${t("posture.progress.diffSuffix")}` : t("posture.share.success")}
          </Text>
          {showTrustBadge && (
            <Text style={styles.trustBadgeTextSmall}>{t("posture.share.trustBadge")}</Text>
          )}
          <Text style={styles.viralHookTextSmall}>{t("posture.share.hooks.fastCheck")}</Text>
        </View>
        <Text style={styles.cardBranding}>{t("posture.share.branding")}</Text>
      </View>
    </View>
  );
});

export const ReelsCoverVariant = React.forwardRef(({ view, previous, t }, ref) => {
  if (!view) return null;
  const scoreDiff = previous ? Math.round(view.score - previous.score) : 0;
  const hook = resolveHook(t, scoreDiff);

  return (
    <View ref={ref} collapsable={false} style={styles.reelsContainer}>
      <View style={styles.reelsBg}>
        <PostureImageWithOverlays 
          uri={view.checkpoint?.sideImageUri || ""} 
          landmarks={view.checkpoint?.landmarks?.side}
          viewType="side"
          style={styles.reelsMainImage}
        />
        <View style={styles.reelsOverlay}>
          <Text style={styles.reelsTitle}>{hook.toUpperCase()}</Text>
          <View style={styles.reelsDivider} />
          <Text style={styles.reelsSubtitle}>{t("posture.share.hooks.scanDifference")}</Text>
          <View style={styles.viralHookRowReels}>
             <Text style={styles.viralHookTextReels}>{t("posture.share.hooks.testPosture").toUpperCase()}</Text>
          </View>
        </View>
      </View>
      <View style={styles.reelsFooter}>
        <Text style={styles.reelsBranding}>{t("posture.share.branding")}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  // Story Layout (9:16-ish)
  storyContainer: {
    width: 540,
    height: 960,
    backgroundColor: "#ffffff",
    padding: 40,
    justifyContent: "space-between",
  },
  storyHeadline: {
    fontSize: 42,
    fontWeight: "900",
    color: "#14301f",
    textAlign: "center",
    marginTop: 20,
  },
  storyGrid: {
    flexDirection: "row",
    gap: 20,
    height: 500,
  },
  storyPanel: {
    flex: 1,
    gap: 12,
  },
  storyLabel: {
    fontSize: 18,
    fontWeight: "800",
    color: "#7fa88a",
    textAlign: "center",
    textTransform: "uppercase",
  },
  storyImage: {
    flex: 1,
    borderRadius: 24,
  },
  storyFooter: {
    alignItems: "center",
    gap: 16,
    marginBottom: 20,
  },
  storyBadge: {
    backgroundColor: "#295c41",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 999,
  },
  storyBadgeText: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "900",
  },
  storyBranding: {
    fontSize: 16,
    fontWeight: "700",
    color: "#cddccd",
  },

  // Social Card Layout (1:1)
  cardContainer: {
    width: 600,
    height: 600,
    backgroundColor: "#ffffff",
    padding: 30,
    gap: 20,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  cardSub: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7fa88a",
    textTransform: "uppercase",
  },
  cardTitle: {
    fontSize: 28,
    fontWeight: "900",
    color: "#14301f",
  },
  cardLevelBadge: {
    backgroundColor: "#f0f7f1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  cardLevelText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#295c41",
  },
  cardGrid: {
    flexDirection: "row",
    gap: 12,
    flex: 1,
  },
  cardImage: {
    flex: 1,
    borderRadius: 16,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardProgressText: {
    fontSize: 18,
    fontWeight: "800",
    color: "#295c41",
  },
  cardBranding: {
    fontSize: 14,
    fontWeight: "700",
    color: "#cddccd",
  },

  // Reels Cover Layout (9:16-ish)
  reelsContainer: {
    width: 540,
    height: 960,
    backgroundColor: "#14301f",
  },
  reelsBg: {
    flex: 1,
    position: "relative",
  },
  reelsMainImage: {
    width: "100%",
    height: "100%",
    opacity: 0.85,
  },
  reelsOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },
  reelsTitle: {
    fontSize: 56,
    fontWeight: "900",
    color: "#ffffff",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  reelsDivider: {
    width: 80,
    height: 6,
    backgroundColor: "#7fa88a",
    marginVertical: 24,
    borderRadius: 3,
  },
  reelsSubtitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
    opacity: 0.9,
  },
  reelsFooter: {
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.1)",
  },
  reelsBranding: {
    fontSize: 14,
    fontWeight: "700",
    color: "#7fa88a",
    letterSpacing: 2,
  },
  viralHookRow: {
    backgroundColor: "rgba(41, 92, 65, 0.08)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    marginBottom: 8,
  },
  viralHookText: {
    fontSize: 16,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: 0.5,
  },
  viralHookTextSmall: {
    fontSize: 12,
    fontWeight: "800",
    color: "#7fa88a",
    marginTop: 2,
  },
  viralHookRowReels: {
    marginTop: 32,
    borderWidth: 1.5,
    borderColor: "#ffffff",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  viralHookTextReels: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.5,
  },
  consistencyHint: {
    padding: 12,
    backgroundColor: "#fff9f9",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ffe4e4",
    marginVertical: 10,
  },
  consistencyHintText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#c67b7b",
    textAlign: "center",
  },
  trustBadge: {
    backgroundColor: "#edf5ee",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    alignSelf: "center",
    marginBottom: 6,
  },
  trustBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#4a6654",
    letterSpacing: 0.3,
  },
  trustBadgeTextSmall: {
    fontSize: 10,
    fontWeight: "700",
    color: "#7fa88a",
    marginTop: 2,
  },
});
