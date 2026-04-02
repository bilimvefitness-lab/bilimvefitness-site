import { Pressable, StyleSheet, Text, View } from "react-native";

import { SleepRepositoryStatus } from "../../domain/repository/SleepRepository";

type SleepErrorStateProps = {
  status: string;
  message: string;
  onPrimaryAction?: () => void;
  onSecondaryAction?: () => void;
};

function buildCopy(status: string, fallbackMessage: string) {
  switch (status) {
    case SleepRepositoryStatus.PERMISSION_DENIED:
      return {
        title: "Uyku izni kapali",
        description: fallbackMessage || "Apple Health veya Health Connect uyku verisine erisim izni verilmedi.",
        primaryLabel: "Izinleri Ac",
        secondaryLabel: "Manuel Gir",
      };
    case SleepRepositoryStatus.SOURCE_NOT_INSTALLED:
      return {
        title: "Health Connect gerekli",
        description: fallbackMessage || "Android cihazda Health Connect kurulu veya guncel degil.",
        primaryLabel: "Ayarlar",
        secondaryLabel: "Manuel Gir",
      };
    case SleepRepositoryStatus.SOURCE_NOT_AVAILABLE:
      return {
        title: "Cihaz desteklemiyor",
        description: fallbackMessage || "Bu cihaz veya build otomatik uyku entegrasyonunu desteklemiyor.",
        primaryLabel: "",
        secondaryLabel: "Manuel Gir",
      };
    case SleepRepositoryStatus.SYNC_FAILED_BUT_CACHE_AVAILABLE:
      return {
        title: "Son veri gosteriliyor",
        description: fallbackMessage || "Yeni senkronizasyon tamamlanamadi, son cache korunuyor.",
        primaryLabel: "Tekrar Dene",
        secondaryLabel: "",
      };
    case SleepRepositoryStatus.PARTIAL_DATA:
      return {
        title: "Stage verisi eksik",
        description: fallbackMessage || "Toplam uyku bulundu ancak REM/deep/core parcasi mevcut degil.",
        primaryLabel: "",
        secondaryLabel: "",
      };
    default:
      return {
        title: "Uyku verisi okunamadi",
        description: fallbackMessage || "Uyku verisi okunurken beklenmeyen bir durum olustu.",
        primaryLabel: "Tekrar Dene",
        secondaryLabel: "Manuel Gir",
      };
  }
}

export function SleepErrorState({
  status,
  message,
  onPrimaryAction,
  onSecondaryAction,
}: SleepErrorStateProps) {
  const copy = buildCopy(status, message);

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>Durum</Text>
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
