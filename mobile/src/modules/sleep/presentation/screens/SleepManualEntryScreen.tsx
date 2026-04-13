import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import {
  createSleepRepository,
  type SleepRepository,
  type SleepRepositoryResult,
} from "../../domain/repository/SleepRepository";
import { buildSleepInsightSnapshot } from "../../domain/services/SleepInsightEngine";
import { useLanguage } from "../../../../i18n";

type SavedResult = {
  durationMinutes: number | null;
  shortStatus: string;
  firstInsight: string | null;
};

function formatSleepDuration(minutes: number, hourAbbr: string, minAbbr: string): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}${hourAbbr} ${m}${minAbbr}` : `${h}${hourAbbr}`;
}

function toLocalInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function defaultBedtime() {
  const value = new Date();
  value.setDate(value.getDate() - 1);
  value.setHours(23, 0, 0, 0);
  return toLocalInput(value);
}

function defaultWakeTime() {
  const value = new Date();
  value.setHours(7, 0, 0, 0);
  return toLocalInput(value);
}

function parseLocalInput(value: string) {
  const normalized = String(value || "").trim().replace(" ", "T");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return parsed.toISOString();
}

export function SleepManualEntryScreen({
  repository,
  userId,
  onSaved,
}: {
  repository?: SleepRepository;
  userId?: string | null;
  onSaved?: (result: SleepRepositoryResult) => void;
}) {
  const { t } = useLanguage();
  const repositoryRef = useRef(repository || createSleepRepository());
  const repo = repository || repositoryRef.current;
  const [bedtime, setBedtime] = useState(defaultBedtime());
  const [wakeTime, setWakeTime] = useState(defaultWakeTime());
  const [awakenings, setAwakenings] = useState("");
  const [quality, setQuality] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [savedResult, setSavedResult] = useState<SavedResult | null>(null);

  async function handleSave() {
    const bedtimeIso = parseLocalInput(bedtime);
    const wakeTimeIso = parseLocalInput(wakeTime);
    if (!bedtimeIso || !wakeTimeIso) {
      setMessage(t("sleep.manual.invalidFormat"));
      return;
    }

    setSubmitting(true);
    try {
      const result = await repo.saveManualEntry(
        {
          bedtime: bedtimeIso,
          wakeTime: wakeTimeIso,
          awakeningsCount: awakenings ? Number(awakenings) : null,
          manualQualityScore: quality ? Number(quality) : null,
          notes: notes || null,
        },
        { userId }
      );
      // Build structured result display from saved summary + insight engine.
      const snapshot = result.summary ? buildSleepInsightSnapshot(result.summary) : null;
      setSavedResult({
        durationMinutes: result.summary?.totalSleepMinutes ?? null,
        shortStatus: snapshot
          ? t("sleep.insight." + snapshot.shortStatusCode + ".title")
          : t("sleep.repo." + result.messageCode),
        firstInsight: result.insights?.[0]
          ? t("sleep.insight." + result.insights[0].type + ".message", result.insights[0].meta as Record<string, string | number>)
          : null,
      });
      setMessage(t("sleep.repo." + result.messageCode));
      onSaved?.(result);
    } catch (error) {
      const code = String((error as Error)?.message || "");
      const validCodes = ["INVALID_DATETIME", "WAKE_BEFORE_BEDTIME", "DURATION_TOO_SHORT", "DURATION_TOO_LONG", "QUALITY_OUT_OF_RANGE"];
      if (validCodes.includes(code)) {
        setMessage(t(`sleep.manual.validation.${code}`));
      } else {
        setMessage(t("sleep.manual.saveFailed"));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>{t("sleep.manual.eyebrow")}</Text>
        <Text style={styles.title}>{t("sleep.manual.title")}</Text>
        <Text style={styles.description}>{t("sleep.manual.description")}</Text>

        <View style={styles.field}>
          <Text style={styles.label}>{t("sleep.manual.bedtime")}</Text>
          <TextInput value={bedtime} onChangeText={setBedtime} style={styles.input} />
          <Text style={styles.helper}>{t("sleep.manual.helperText")}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t("sleep.manual.wakeTime")}</Text>
          <TextInput value={wakeTime} onChangeText={setWakeTime} style={styles.input} />
          <Text style={styles.helper}>{t("sleep.manual.helperText")}</Text>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.rowField]}>
            <Text style={styles.label}>{t("sleep.manual.awakenings")}</Text>
            <TextInput
              value={awakenings}
              onChangeText={setAwakenings}
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>
          <View style={[styles.field, styles.rowField]}>
            <Text style={styles.label}>{t("sleep.manual.quality")}</Text>
            <TextInput
              value={quality}
              onChangeText={setQuality}
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>{t("sleep.manual.notes")}</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            style={[styles.input, styles.textArea]}
            multiline
          />
        </View>

        {savedResult ? (
          <View style={styles.resultCard}>
            <Text style={styles.resultEyebrow}>{t("sleep.manual.savedEyebrow")}</Text>
            {savedResult.durationMinutes != null && (
              <Text style={styles.resultDuration}>
                {formatSleepDuration(savedResult.durationMinutes, t("sleep.hourAbbr"), t("sleep.minAbbr"))}
              </Text>
            )}
            <Text style={styles.resultStatus}>{savedResult.shortStatus}</Text>
            {savedResult.firstInsight ? (
              <Text style={styles.resultInsight}>{savedResult.firstInsight}</Text>
            ) : null}
          </View>
        ) : message ? (
          <Text style={styles.message}>{message}</Text>
        ) : null}

        <Pressable onPress={handleSave} style={styles.button} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? t("sleep.manual.saving") : t("sleep.manual.save")}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#eef4e8",
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: "#f7fbf6",
    borderRadius: 22,
    padding: 18,
    gap: 12,
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
    color: "#14301f",
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "900",
  },
  description: {
    color: "#567059",
    lineHeight: 20,
  },
  field: {
    gap: 6,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  rowField: {
    flex: 1,
  },
  label: {
    color: "#31553a",
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d1ddd0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#173625",
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  helper: {
    color: "#678067",
    fontSize: 12,
  },
  message: {
    color: "#23412b",
    lineHeight: 20,
  },
  resultCard: {
    backgroundColor: "#eef4e8",
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: "#c8ddc9",
  },
  resultEyebrow: {
    color: "#59705e",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  resultDuration: {
    color: "#14301f",
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },
  resultStatus: {
    color: "#295c41",
    fontSize: 15,
    fontWeight: "800",
  },
  resultInsight: {
    color: "#567059",
    fontSize: 14,
    lineHeight: 20,
  },
  button: {
    marginTop: 4,
    backgroundColor: "#295c41",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 15,
  },
});
