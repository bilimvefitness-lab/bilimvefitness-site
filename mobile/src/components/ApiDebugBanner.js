import { View, Text } from "react-native";
import styles from "../styles/shared";

export default function ApiDebugBanner({ debug }) {
  if (!debug) {
    return null;
  }

  return (
    <View style={styles.debugCard}>
      <Text style={styles.debugTitle}>Geçici Ağ Tanısı</Text>
      <Text style={styles.debugLine}>Base URL: {debug.baseUrl}</Text>
      <Text style={styles.debugLine}>Kaynak: {debug.source}</Text>
      <Text style={styles.debugLine}>Son olay: {debug.lastEvent || "-"}</Text>
      <Text style={styles.debugLine}>Son istek: {debug.lastMethod || "-"} {debug.lastRequestUrl || "-"}</Text>
      <Text style={styles.debugLine}>Son durum: {debug.lastStatus ?? "-"}</Text>
      <Text style={styles.debugLine}>Son hata kodu: {debug.lastErrorCode || "-"}</Text>
      <Text style={styles.debugLine}>Son hata: {debug.lastErrorMessage || "-"}</Text>
    </View>
  );
}
