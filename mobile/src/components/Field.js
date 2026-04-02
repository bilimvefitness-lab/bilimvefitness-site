import { View, Text, TextInput } from "react-native";
import styles from "../styles/shared";

export default function Field({ label, value, onChangeText, keyboardType = "default" }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholderTextColor="#7b8578"
      />
    </View>
  );
}
