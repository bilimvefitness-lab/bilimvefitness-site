import { View, Text } from "react-native";
import styles from "../styles/shared";
import { streakCountLabel, streakMoodCopy } from "../utils/helpers";

export default function StreakRewardCard({ streaks }) {
  if (!streaks) {
    return null;
  }

  return (
    <View style={styles.rewardCard}>
      <Text style={styles.rewardEyebrow}>Seriler</Text>
      <View style={styles.rewardGrid}>
        <View style={styles.rewardPill}>
          <Text style={styles.rewardValue}>{streakCountLabel(streaks.logging.count)}</Text>
          <Text style={styles.rewardLabel}>Kayıt</Text>
          <Text style={styles.rewardHint}>{streakMoodCopy(streaks.logging)}</Text>
        </View>
        <View style={styles.rewardPill}>
          <Text style={styles.rewardValue}>{streakCountLabel(streaks.protein_target.count)}</Text>
          <Text style={styles.rewardLabel}>Protein</Text>
          <Text style={styles.rewardHint}>{streakMoodCopy(streaks.protein_target)}</Text>
        </View>
      </View>
    </View>
  );
}
