import { View, Text } from "react-native";
import styles from "../styles/shared";
import { confidencePlainLabel, confidencePlainHint } from "../utils/helpers";

export default function ConfidenceOverviewCard({ confidence }) {
  if (!confidence) {
    return null;
  }

  const toneStyle =
    confidence.level === "high"
      ? styles.confidenceTagHigh
      : confidence.level === "medium"
        ? styles.confidenceTagMedium
        : styles.confidenceTagLow;

  return (
    <View style={styles.confidenceCard}>
      <View style={styles.rowBetween}>
        <View>
          <Text style={styles.confidenceEyebrow}>Kayıt Netliği</Text>
          <Text style={styles.confidenceValue}>{confidence.score}/100</Text>
        </View>
        <View style={[styles.confidenceTag, toneStyle]}>
          <Text style={styles.confidenceTagText}>{confidencePlainLabel(confidence.level)}</Text>
        </View>
      </View>
      <Text style={styles.confidenceHint}>{confidencePlainHint(confidence)}</Text>
    </View>
  );
}
