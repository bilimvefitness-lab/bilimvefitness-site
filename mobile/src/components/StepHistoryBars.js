import { View, Text } from "react-native";
import styles from "../styles/shared";
import { formatStepNumber } from "../utils/helpers";
import { STEP_GOAL, dayLabelFromDateKey } from "../steps/insights";

export default function StepHistoryBars({ items, goal = STEP_GOAL }) {
  const maxValue = Math.max(goal, ...(items || []).map((item) => Number(item?.stepCount || 0)));

  return (
    <View style={styles.stepHistoryList}>
      {(items || []).map((item) => (
        <View key={item.date} style={styles.stepHistoryRow}>
          <Text style={styles.stepHistoryLabel}>{dayLabelFromDateKey(item.date)}</Text>
          <View style={styles.stepHistoryTrack}>
            <View
              style={[
                styles.stepHistoryFill,
                {
                  width: `${Math.max(
                    item?.available ? (Number(item.stepCount || 0) / maxValue) * 100 : 0,
                    item?.available && Number(item.stepCount || 0) > 0 ? 6 : 0
                  )}%`,
                  opacity: item?.available ? 1 : 0.2,
                },
              ]}
            />
          </View>
          <Text style={styles.stepHistoryValue}>
            {item?.available ? formatStepNumber(item.stepCount) : "-"}
          </Text>
        </View>
      ))}
    </View>
  );
}
