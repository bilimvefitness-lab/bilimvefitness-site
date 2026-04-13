import { Pressable, StyleSheet, Text, View } from "react-native";

import { SleepRepositoryStatus } from "../../domain/repository/SleepRepository";
import { useLanguage } from "../../../../i18n";

type SleepErrorStateProps = {
  status: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
};

export function SleepErrorState({
  status,
  onPrimaryAction,
  onSecondaryAction,
}: SleepErrorStateProps) {
  const { t } = useLanguage();

  function buildCopy() {
    switch (status) {
      case SleepRepositoryStatus.PERMISSION_DENIED:
        return {
          title:          t("sleep.error.permissionDenied.title"),
          description:    t("sleep.error.permissionDenied.description"),
          primaryLabel:   t("sleep.error.permissionDenied.primaryLabel"),
          secondaryLabel: t("sleep.error.permissionDenied.secondaryLabel"),
        };
      case SleepRepositoryStatus.SOURCE_NOT_INSTALLED:
        return {
          title:          t("sleep.error.notInstalled.title"),
          description:    t("sleep.error.notInstalled.description"),
          primaryLabel:   t("sleep.error.notInstalled.primaryLabel"),
          secondaryLabel: t("sleep.error.notInstalled.secondaryLabel"),
        };
      case SleepRepositoryStatus.SOURCE_NOT_AVAILABLE:
        return {
          title:          t("sleep.error.notAvailable.title"),
          description:    t("sleep.error.notAvailable.description"),
          primaryLabel:   t("sleep.error.notAvailable.primaryLabel"),
          secondaryLabel: t("sleep.error.notAvailable.secondaryLabel"),
        };
      case SleepRepositoryStatus.SYNC_FAILED_BUT_CACHE_AVAILABLE:
        return {
          title:          t("sleep.error.cacheOnly.title"),
          description:    t("sleep.error.cacheOnly.description"),
          primaryLabel:   t("sleep.error.cacheOnly.primaryLabel"),
          secondaryLabel: t("sleep.error.cacheOnly.secondaryLabel"),
        };
      case SleepRepositoryStatus.PARTIAL_DATA:
        return {
          title:          t("sleep.error.partialData.title"),
          description:    t("sleep.error.partialData.description"),
          primaryLabel:   t("sleep.error.partialData.primaryLabel"),
          secondaryLabel: t("sleep.error.partialData.secondaryLabel"),
        };
      default:
        return {
          title:          t("sleep.error.generic.title"),
          description:    t("sleep.error.generic.description"),
          primaryLabel:   t("sleep.error.generic.primaryLabel"),
          secondaryLabel: t("sleep.error.generic.secondaryLabel"),
        };
    }
  }

  const copy = buildCopy();

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{t("sleep.error.eyebrow")}</Text>
      <Text style={styles.title}>{copy.title}</Text>
      <Text style={styles.description}>{copy.description}</Text>
      <View style={styles.actions}>
        {copy.primaryLabel ? (
          <Pressable onPress={onPrimaryAction} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{copy.primaryLabel}</Text>
          </Pressable>
        ) : null}
        {copy.secondaryLabel ? (
          <Pressable onPress={onSecondaryAction} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{copy.secondaryLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff7ea",
    borderRadius: 20,
    padding: 18,
    gap: 8,
    borderWidth: 1,
    borderColor: "#ecd7a7",
  },
  eyebrow: {
    color: "#8d6918",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    color: "#4f3c11",
    fontSize: 20,
    fontWeight: "800",
  },
  description: {
    color: "#6c5729",
    lineHeight: 20,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 6,
  },
  primaryButton: {
    backgroundColor: "#295c41",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#d6c28d",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  secondaryButtonText: {
    color: "#6c5729",
    fontWeight: "800",
  },
});
