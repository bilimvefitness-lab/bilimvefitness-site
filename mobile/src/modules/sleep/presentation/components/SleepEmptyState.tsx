import { Pressable, StyleSheet, Text, View } from "react-native";

type SleepEmptyStateProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onPress?: () => void;
};

export function SleepEmptyState({ title, description, actionLabel, onPress }: SleepEmptyStateProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Uyku</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onPress ? (
        <Pressable onPress={onPress} style={styles.button}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#f8fbf6",
    borderRadius: 20,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: "#e1ece0",
  },
  eyebrow: {
    color: "#6f846f",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    color: "#14301f",
    fontSize: 20,
    fontWeight: "800",
  },
  description: {
    color: "#566d5b",
    lineHeight: 20,
  },
  button: {
    marginTop: 4,
    alignSelf: "flex-start",
    backgroundColor: "#295c41",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
});
