import { StyleSheet, Text, View } from "react-native";

import { SleepSource } from "../../domain/models/SleepRawSegment";
import { useLanguage } from "../../../../i18n";

function labelForSource(source?: string | null, manual = "Manuel", unknown = "Bilinmiyor") {
  if (source === SleepSource.APPLE_HEALTH) {
    return "Apple Health";
  }
  if (source === SleepSource.HEALTH_CONNECT) {
    return "Health Connect";
  }
  if (source === SleepSource.MANUAL) {
    return manual;
  }
  return unknown;
}

function toneForSource(source?: string | null) {
  if (source === SleepSource.APPLE_HEALTH) {
    return styles.apple;
  }
  if (source === SleepSource.HEALTH_CONNECT) {
    return styles.healthConnect;
  }
  if (source === SleepSource.MANUAL) {
    return styles.manual;
  }
  return styles.unknown;
}

export function SleepSourceBadge({ source }: { source?: string | null }) {
  const { t } = useLanguage();
  return (
    <View style={[styles.badge, toneForSource(source)]}>
      <Text style={styles.text}>
        {labelForSource(source, t("sleep.source.manual"), t("sleep.source.unknown"))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    alignSelf: "flex-start",
  },
  apple: {
    backgroundColor: "#e9eef8",
  },
  healthConnect: {
    backgroundColor: "#e6f5ec",
  },
  manual: {
    backgroundColor: "#f8efe4",
  },
  unknown: {
    backgroundColor: "#ececeb",
  },
  text: {
    fontSize: 12,
    fontWeight: "800",
    color: "#183024",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
