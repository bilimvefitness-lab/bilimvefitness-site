/**
 * Shared premium UI components.
 * Standardized for Nutrition, Hydration, Steps, and Sleep screens.
 */

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

// ── Shared Tokens ────────────────────────────────────────────────────────────
const THEME = {
  primary: "#295c41",
  secondary: "#7fa88a",
  text: "#14301f",
  muted: "#4a6654",
  bg: "#eef4e8",
  card: "#ffffff",
  border: "#d8e9dc",
  track: "#dde9db",
  radius: 18,
  spacing: 16,
};

// ── Tiny progress bar ─────────────────────────────────────────────────────────

export function Bar({ value, target, color = THEME.primary }) {
  const width = target && value ? Math.min(Math.round((Number(value) / Number(target)) * 100), 100) : 0;
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${Math.max(width, width > 0 ? 4 : 0)}%`, backgroundColor: color }]} />
    </View>
  );
}

// ── Section block ─────────────────────────────────────────────────────────────

export function Block({ label, loading, children }) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockLabel}>{label}</Text>
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={THEME.primary} size="small" />
        </View>
      ) : children}
    </View>
  );
}

// ── Row: label + value ────────────────────────────────────────────────────────

export function Row({ label, value, sub }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>{value ?? "-"}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
    </View>
  );
}

// ── Date navigation ───────────────────────────────────────────────────────────

const MONTH_NAMES = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

export function DateNav({ date, onPrev, onNext }) {
  const d = new Date();
  const todayKey = d.toISOString().slice(0, 10);
  const isToday = date === todayKey;
  
  const [, month, day] = date.split("-");
  const label = `${parseInt(day)} ${MONTH_NAMES[parseInt(month) - 1]}`;

  return (
    <View style={styles.dateNav}>
      <Pressable onPress={onPrev} style={styles.dateArrow} hitSlop={15}>
        <Text style={styles.dateArrowText}>‹</Text>
      </Pressable>
      <View style={styles.dateLabelBox}>
        <Text style={styles.dateLabel}>{isToday ? "Bugün" : label}</Text>
      </View>
      <Pressable 
        onPress={onNext} 
        style={[styles.dateArrow, isToday && styles.dateArrowDisabled]} 
        disabled={isToday}
        hitSlop={15}
      >
        <Text style={[styles.dateArrowText, isToday && styles.dateArrowTextDisabled]}>›</Text>
      </Pressable>
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

export function Divider() {
  return <View style={styles.divider} />;
}

// ── Helpers (Formatting) ──────────────────────────────────────────────────────

export function minutesToHMS(minutes) {
  const m = Number(minutes || 0);
  if (m <= 0) return "-";
  return `${Math.floor(m / 60)}s ${m % 60}dk`;
}

export function mlToL(ml) {
  const v = Number(ml || 0);
  if (v <= 0) return "-";
  return `${(v / 1000).toFixed(1)}L`;
}

export function stepFmt(n) {
  return Math.max(Number(n || 0), 0).toLocaleString("tr-TR");
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  barTrack: {
    height: 8,
    backgroundColor: THEME.track,
    borderRadius: 4,
    overflow: "hidden",
    marginVertical: 4,
  },
  barFill: {
    height: 8,
    borderRadius: 4,
  },

  block: {
    gap: 12,
    paddingVertical: 18,
  },
  blockLabel: {
    fontSize: 12,
    fontWeight: "900",
    color: THEME.secondary,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  loadingBox: {
    paddingVertical: 20,
    alignItems: "center",
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: THEME.muted,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 4,
  },
  rowValue: {
    fontSize: 20,
    fontWeight: "900",
    color: THEME.text,
  },
  rowSub: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.secondary,
  },

  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 30,
    paddingVertical: 14,
    backgroundColor: THEME.bg,
  },
  dateArrow: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  dateArrowDisabled: {
    opacity: 0.15,
  },
  dateArrowText: {
    fontSize: 32,
    color: THEME.primary,
    fontWeight: "300",
  },
  dateArrowTextDisabled: {
    color: THEME.secondary,
  },
  dateLabelBox: {
    flex: 1,
    alignItems: "center",
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: "900",
    color: THEME.text,
    textAlign: "center",
  },

  divider: {
    height: 1,
    backgroundColor: THEME.border,
    marginVertical: 4,
  },
});
