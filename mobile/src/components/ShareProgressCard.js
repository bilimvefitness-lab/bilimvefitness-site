import { Text, View } from "react-native";

import styles from "../styles/shared";

export default function ShareProgressCard({ value, unit, title, message }) {
  return (
    <View collapsable={false} style={styles.shareCard}>
      <Text style={styles.shareCardEyebrow}>Bilim & Fitness</Text>
      <View style={styles.shareCardValueRow}>
        <Text style={styles.shareCardValue}>{value}</Text>
        {unit ? <Text style={styles.shareCardUnit}>{unit}</Text> : null}
      </View>
      <Text style={styles.shareCardTitle}>{title}</Text>
      <Text style={styles.shareCardMessage}>{message}</Text>
      <View style={styles.shareCardFooter}>
        <Text style={styles.shareCardInvite}>Sen de başla</Text>
        <Text style={styles.shareCardCta}>Alışkanlık sistemine katıl</Text>
        <Text style={styles.shareCardBrand}>Bilim & Fitness</Text>
      </View>
    </View>
  );
}
