import { View, Text } from "react-native";
import styles from "../styles/shared";

export default function SectionCard({ title, badge, children, footer }) {
  return (
    <View style={styles.card}>
      <View style={styles.rowBetween}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
      <View style={styles.sectionBody}>{children}</View>
      {footer}
    </View>
  );
}
