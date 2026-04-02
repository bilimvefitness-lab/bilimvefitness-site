import { useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import {
  createSleepRepository,
  type SleepRepository,
  type SleepRepositoryResult,
} from "../../domain/repository/SleepRepository";

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
  const repositoryRef = useRef(repository || createSleepRepository());
  const repo = repository || repositoryRef.current;
  const [bedtime, setBedtime] = useState(defaultBedtime());
  const [wakeTime, setWakeTime] = useState(defaultWakeTime());
  const [awakenings, setAwakenings] = useState("");
  const [quality, setQuality] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const helperText = "Format: YYYY-MM-DD HH:MM. Ornek: 2026-04-01 23:15";

  async function handleSave() {
    const bedtimeIso = parseLocalInput(bedtime);
    const wakeTimeIso = parseLocalInput(wakeTime);
    if (!bedtimeIso || !wakeTimeIso) {
      setMessage("Yatis ve kalkis zamani gecerli formatta olmali.");
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
      setMessage(result.message);
      onSaved?.(result);
    } catch (error) {
      setMessage(String((error as Error)?.message || "Manuel uyku girisi kaydedilemedi."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <Text style={styles.eyebrow}>Manuel Kayit</Text>
        <Text style={styles.title}>Uyku girisini sen ekle</Text>
        <Text style={styles.description}>
          Saglik kaynagi yoksa veya eksikse, manuel kayit dusuk guven seviyesiyle korunur.
        </Text>

        <View style={styles.field}>
          <Text style={styles.label}>Yatis saati</Text>
          <TextInput value={bedtime} onChangeText={setBedtime} style={styles.input} />
          <Text style={styles.helper}>{helperText}</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Kalkis saati</Text>
          <TextInput value={wakeTime} onChangeText={setWakeTime} style={styles.input} />
          <Text style={styles.helper}>{helperText}</Text>
        </View>

        <View style={styles.row}>
          <View style={[styles.field, styles.rowField]}>
            <Text style={styles.label}>Gece uyanma sayisi</Text>
            <TextInput
              value={awakenings}
              onChangeText={setAwakenings}
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>
          <View style={[styles.field, styles.rowField]}>
            <Text style={styles.label}>Kalite (1-5)</Text>
            <TextInput
              value={quality}
              onChangeText={setQuality}
              style={styles.input}
              keyboardType="number-pad"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Not</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            style={[styles.input, styles.textArea]}
            multiline
          />
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}

        <Pressable onPress={handleSave} style={styles.button} disabled={submitting}>
          <Text style={styles.buttonText}>{submitting ? "Kaydediliyor..." : "Kaydi Kaydet"}</Text>
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
