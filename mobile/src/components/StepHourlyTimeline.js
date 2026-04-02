import { View, Text } from "react-native";
import styles from "../styles/shared";
import { formatStepNumber } from "../utils/helpers";

export default function StepHourlyTimeline({ items }) {
  const visibleItems = (items || []).filter((item) => item.hour <= 20 || item.hour % 3 === 0);
  const maxValue = Math.max(500, ...(visibleItems || []).map((item) => Number(item?.stepCount || 0)));

  return (
    <View style={styles.stepHourlyTimeline}>
      {(visibleItems || []).map((item) => (
        <View key={item.label} style={styles.stepHourlyColumn}>
          <View style={styles.stepHourlyTrack}>
            <View
              style={[
                styles.stepHourlyFill,
                {
                  height: `${Math.max(
                    item?.available ? (Number(item.stepCount || 0) / maxValue) * 100 : 0,
                    item?.available && Number(item.stepCount || 0) > 0 ? 8 : 0
                  )}%`,
                  opacity: item?.available ? 1 : 0.18,
                },
              ]}
            />
          </View>
          <Text style={styles.stepHourlyValue}>{item?.available ? formatStepNumber(item.stepCount) : "-"}</Text>
          <Text style={styles.stepHourlyLabel}>{String(item.label).slice(0, 2)}</Text>
        </View>
      ))}
    </View>
  );
}
