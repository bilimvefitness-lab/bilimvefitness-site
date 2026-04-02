import { View, Text, Pressable } from "react-native";
import styles from "../styles/shared";

export default function OptionGroup({ label, options, value, onChange }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.optionRow}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            style={[styles.optionChip, option.value === value && styles.optionChipActive]}
            onPress={() => onChange(option.value)}
          >
            <Text style={[styles.optionChipText, option.value === value && styles.optionChipTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
