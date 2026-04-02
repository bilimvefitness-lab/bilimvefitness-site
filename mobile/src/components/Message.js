import { View, Text } from "react-native";
import styles from "../styles/shared";

export default function Message({ tone = "neutral", children }) {
  const toneStyle =
    tone === "success"
      ? styles.messageSuccess
      : tone === "error"
        ? styles.messageError
        : tone === "warning"
          ? styles.messageWarning
          : styles.messageNeutral;
  return (
    <View style={[styles.messageBox, toneStyle]}>
      <Text style={styles.messageText}>{children}</Text>
    </View>
  );
}
