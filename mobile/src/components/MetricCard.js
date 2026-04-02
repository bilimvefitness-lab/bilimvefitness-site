import { View, Text } from "react-native";
import styles from "../styles/shared";

export default function MetricCard({ label, value, detail }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricDetail}>{detail}</Text>
    </View>
  );
}
