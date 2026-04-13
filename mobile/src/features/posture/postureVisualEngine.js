import React from "react";
import { View, Text, Image, StyleSheet, Platform } from "react-native";
import * as Sharing from "expo-sharing";
import { captureRef } from "react-native-view-shot";

// Overlays use normalized landmark coordinates (0–1) relative to the source image.
// Using resizeMode="contain" ensures the displayed image is never cropped, so
// landmark percentages map 1:1 to the rendered image bounds with no drift.
// The contain-box fills within the container; overlays are placed on the full container
// (which may include letterbox), so we clamp visually to the content area via overflow hidden.
export function PostureImageWithOverlays({ uri, landmarks, viewType, style }) {
  if (!uri) return null;

  const hasLandmarks = Object.keys(landmarks || {}).length > 0;

  return (
    <View style={[styles.imageContainer, style]}>
      <Image source={{ uri }} style={styles.image} resizeMode="contain" />

      {hasLandmarks && (
        <View style={StyleSheet.absoluteFill}>
          {viewType === "front" && landmarks.leftShoulder && landmarks.rightShoulder && (
            <View
              style={[
                styles.shoulderLine,
                {
                  left: `${Math.min(landmarks.leftShoulder.x, landmarks.rightShoulder.x) * 100}%`,
                  top: `${landmarks.leftShoulder.y * 100}%`,
                  width: `${Math.abs(landmarks.leftShoulder.x - landmarks.rightShoulder.x) * 100}%`,
                },
              ]}
            />
          )}

          {viewType === "side" && landmarks.rightShoulder && (
            <View
              style={[
                styles.verticalAxis,
                {
                  left: `${landmarks.rightShoulder.x * 100}%`,
                },
              ]}
            />
          )}

          {landmarks.rightEar && (
            <View
              style={[
                styles.marker,
                {
                  left: `${landmarks.rightEar.x * 100}%`,
                  top: `${landmarks.rightEar.y * 100}%`,
                },
              ]}
            />
          )}

          {landmarks.rightShoulder && (
            <View
              style={[
                styles.marker,
                {
                  left: `${landmarks.rightShoulder.x * 100}%`,
                  top: `${landmarks.rightShoulder.y * 100}%`,
                },
              ]}
            />
          )}
        </View>
      )}
    </View>
  );
}

export const PostureShareCard = React.forwardRef(({ current, previous, t }, ref) => {
  if (!current) return null;

  const scoreDiff = previous ? Math.round(current.score - previous.score) : 0;
  const hasHistory = !!previous;

  let messageKey = "stability";
  if (scoreDiff >= 3) messageKey = "success";
  else if (scoreDiff <= -3) messageKey = "shift";

  const diffPrefix = scoreDiff > 0 ? "+" : "";

  return (
    <View ref={ref} collapsable={false} style={styles.cardContainer}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t("posture.share.title")}</Text>
        <Text style={styles.branding}>{t("posture.share.branding")}</Text>
      </View>

      <View style={styles.comparisonGrid}>
        <View style={styles.panel}>
          <Text style={styles.panelLabel}>{hasHistory ? t("posture.share.before") : ""}</Text>
          <PostureImageWithOverlays 
            uri={previous?.sideImageUri || current.sideImageUri} 
            landmarks={previous?.findings?.landmarks?.side || current.findings?.landmarks?.side}
            viewType="side"
          />
        </View>

        <View style={styles.panel}>
          <Text style={styles.panelLabel}>{hasHistory ? t("posture.share.after") : t("posture.share.now")}</Text>
          <PostureImageWithOverlays 
            uri={current.sideImageUri} 
            landmarks={current.findings?.landmarks?.side}
            viewType="side"
          />
        </View>
      </View>

      <View style={styles.footer}>
        <View style={styles.deltaBadge}>
          <Text style={styles.deltaText}>
            {hasHistory ? `${diffPrefix}${scoreDiff} ${t("posture.progress.diffSuffix")}` : `${current.score}`}
          </Text>
        </View>
        <Text style={styles.message}>{t(`posture.share.${messageKey}`)}</Text>
      </View>
    </View>
  );
});

export async function captureAndSharePosture(viewRef, t) {
  try {
    const uri = await captureRef(viewRef, {
      format: "png",
      quality: 0.9,
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        dialogTitle: t("posture.share.title"),
        mimeType: "image/png",
      });
    }
  } catch (error) {
    console.warn("Share failed", error);
  }
}

export const styles = StyleSheet.create({
  cardContainer: {
    padding: 24,
    backgroundColor: "#ffffff",
    width: 600, // Fixed width for consistent export
    gap: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#edf5ee",
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#295c41",
    letterSpacing: -0.5,
  },
  branding: {
    fontSize: 14,
    fontWeight: "700",
    color: "#7fa88a",
  },
  comparisonGrid: {
    flexDirection: "row",
    gap: 16,
  },
  panel: {
    flex: 1,
    gap: 8,
  },
  panelLabel: {
    fontSize: 13,
    fontWeight: "800",
    color: "#4a6654",
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  imageContainer: {
    aspectRatio: 3 / 4,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#f3f8f4",
    borderWidth: 1,
    borderColor: "#d8e9dc",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8,
  },
  deltaBadge: {
    backgroundColor: "#295c41",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  deltaText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900",
  },
  message: {
    fontSize: 16,
    fontWeight: "700",
    color: "#14301f",
    flex: 1,
  },
  shoulderLine: {
    position: "absolute",
    height: 2,
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 1,
  },
  verticalAxis: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
    borderStyle: "dashed",
  },
  marker: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255, 255, 255, 0.8)",
    marginLeft: -4,
    marginTop: -4,
    borderWidth: 1.5,
    borderColor: "#295c41",
  },
});
