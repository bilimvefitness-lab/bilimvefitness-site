import { View, Text } from "react-native";
import styles from "../styles/shared";
import { formatStepNumber, checkpointStatusLabel } from "../utils/helpers";

export default function StepCheckpointList({ items }) {
  return (
    <View style={styles.stepCheckpointList}>
      {(items || []).map((item) => (
        <View key={item.label} style={styles.stepCheckpointRow}>
          <View style={styles.stepCheckpointHeader}>
            <Text style={styles.stepCheckpointLabel}>{item.label}</Text>
            <Text style={styles.stepCheckpointBadge}>{checkpointStatusLabel(item.status)}</Text>
          </View>
          <Text style={styles.stepCheckpointMeta}>
            Beklenen {formatStepNumber(item.expectedSteps)} / Durum {formatStepNumber(item.actualSteps)}
          </Text>
          <Text style={styles.stepCheckpointHint}>{item.message}</Text>
        </View>
      ))}
    </View>
  );
}
