import { View, Text } from "react-native";
import styles from "../styles/shared";

export default function DecisionLine({ label, value }) {
  return (
    <View style={styles.decisionBlock}>
      <Text style={styles.decisionLabel}>{label}</Text>
      <Text style={styles.decisionValue}>{value}</Text>
    </View>
  );
}
