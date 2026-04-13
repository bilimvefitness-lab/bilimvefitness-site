import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import {
  createSleepRepository,
  type SleepRepository,
} from "../../domain/repository/SleepRepository";
import { SleepPermissionStatus, type SleepPermissionState } from "../../domain/models/SleepSession";
import { useLanguage } from "../../../../i18n";

export function SleepPermissionScreen({
  repository,
  onResolved,
}: {
  repository?: SleepRepository;
  onResolved?: (permission: SleepPermissionState) => void;
}) {
  const { t } = useLanguage();
  const repositoryRef = useRef(repository || createSleepRepository());
  const repo = repository || repositoryRef.current;
  const [permission, setPermission] = useState<SleepPermissionState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadPermission() {
      const nextPermission = await repo.getPermissionState();
      if (!active) {
        return;
      }
      setPermission(nextPermission);
      setLoading(false);
    }

    void loadPermission();
    return () => {
      active = false;
    };
  }, [repo]);

  async function handleRequest() {
    const nextPermission = await repo.requestPermission();
    setPermission(nextPermission);
    if (nextPermission.status === SleepPermissionStatus.GRANTED) {
      onResolved?.(nextPermission);
    }
  }

  async function handleSettings() {
    await repo.openPermissionSettings();
  }

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#295c41" />
      </View>
    );
  }

  const isDenied = permission?.status === SleepPermissionStatus.DENIED;
  const needsSettings = isDenied || permission?.status === SleepPermissionStatus.NOT_INSTALLED;

  return (
    <View style={styles.card}>
      <Text style={styles.eyebrow}>{t("sleep.permission.eyebrow")}</Text>
      <Text style={styles.title}>{t("sleep.permission.title")}</Text>
      <Text style={styles.description}>{t("sleep.permission.description1")}</Text>
      <Text style={styles.description}>{t("sleep.permission.description2")}</Text>

      <View style={styles.actions}>
        <Pressable onPress={handleRequest} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>
            {permission?.status === SleepPermissionStatus.GRANTED
              ? t("sleep.permission.granted")
              : t("sleep.permission.request")}
          </Text>
        </Pressable>
        {needsSettings ? (
          <Pressable onPress={handleSettings} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>{t("sleep.permission.settings")}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  card: {
    backgroundColor: "#f7fbf6",
    borderRadius: 22,
    padding: 20,
    gap: 10,
    borderWidth: 1,
    borderColor: "#dde9db",
  },
  eyebrow: {
    color: "#59705e",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  title: {
    color: "#163423",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },
  description: {
    color: "#567059",
    lineHeight: 21,
  },
  note: {
    marginTop: 6,
    color: "#5f4b1a",
    lineHeight: 20,
    backgroundColor: "#fff5df",
    borderRadius: 14,
    padding: 12,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 8,
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
    borderColor: "#d6e0d5",
  },
  primaryButtonText: {
    color: "#ffffff",
    fontWeight: "800",
  },
  secondaryButtonText: {
    color: "#295c41",
    fontWeight: "800",
  },
});
