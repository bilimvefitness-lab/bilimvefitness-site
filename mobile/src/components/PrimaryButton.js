import { Pressable, Text } from "react-native";
import styles from "../styles/shared";

export default function PrimaryButton({ label, onPress, disabled = false, subtle = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.primaryButton,
        subtle && styles.primaryButtonSubtle,
        disabled && styles.primaryButtonDisabled,
      ]}
    >
      <Text style={[styles.primaryButtonText, subtle && styles.primaryButtonTextSubtle]}>{label}</Text>
    </Pressable>
  );
}
