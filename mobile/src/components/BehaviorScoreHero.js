import { View, Text } from "react-native";
import styles from "../styles/shared";
import { behaviorStatusLabel, behaviorScoreSupportText, behaviorComponentLabel } from "../utils/helpers";

export default function BehaviorScoreHero({ score }) {
  if (!score) {
    return null;
  }

  const toneStyle =
    score.status === "strong"
      ? styles.scoreFillStrong
      : score.status === "fair"
        ? styles.scoreFillFair
        : styles.scoreFillFragile;

  return (
    <View style={styles.scoreHeroCard}>
      <View style={styles.rowBetween}>
        <View style={styles.scoreHeroHeader}>
          <Text style={styles.scoreHeroEyebrow}>Günlük Uyum Skoru</Text>
          <Text style={styles.scoreHeroStatus}>{behaviorStatusLabel(score.status)}</Text>
        </View>
        <View style={styles.scoreHeroValueWrap}>
          <Text style={styles.scoreHeroValue}>{score.total}</Text>
          <Text style={styles.scoreHeroUnit}>/100</Text>
        </View>
      </View>

      <View style={styles.scoreTrack}>
        <View style={[styles.scoreFill, toneStyle, { width: `${Math.max(Math.min(score.total, 100), 8)}%` }]} />
      </View>

      <Text style={styles.scoreHeroHint}>{behaviorScoreSupportText(score)}</Text>

      <View style={styles.scoreBreakdownRow}>
        {(score.components || []).map((component) => (
          <View key={component.key} style={styles.scoreBreakdownPill}>
            <Text style={styles.scoreBreakdownLabel}>{behaviorComponentLabel(component.key)}</Text>
            <Text style={styles.scoreBreakdownValue}>{component.score}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
