import AsyncStorage from "@react-native-async-storage/async-storage";

export const POSTURE_HISTORY_STORAGE_KEY = "posture_history";
const MAX_HISTORY_ITEMS = 24;
const DUPLICATE_WINDOW_MS = 12 * 60 * 60 * 1000;

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeHistoryEntry(entry) {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const score = Number(entry.score);
  const date = Number(entry.date);

  if (!entry.id || !Number.isFinite(score) || !Number.isFinite(date)) {
    return null;
  }

  return {
    id: String(entry.id),
    date,
    score,
    findings: entry.findings ?? {},
    confidence: entry.confidence ?? "low",
    frontImageUri: entry.frontImageUri ?? "",
    sideImageUri: entry.sideImageUri ?? "",
    summary: Array.isArray(entry.summary) ? entry.summary : [],
    recommendation: entry.recommendation ?? "capture_retry",
    consistency: entry.consistency ?? { score: 1.0, isConsistent: true },
    qualityScore: Number(entry.qualityScore ?? 50),
    qualityLevel: entry.qualityLevel ?? "low",
    consistencyLevel: entry.consistencyLevel ?? (entry.consistency?.consistencyLevel || "high"),
    comparisonEligible: entry.comparisonEligible ?? true,
  };
}

function normalizeSummary(summary) {
  if (!Array.isArray(summary)) {
    return [];
  }

  return Array.from(new Set(summary.filter(Boolean))).sort();
}

function normalizeFindings(findings) {
  if (!findings || typeof findings !== "object") {
    return {};
  }

  return {
    kyphosis: findings.kyphosis ?? "unknown",
    forwardHead: findings.forwardHead ?? null,
    shoulderAsymmetry: findings.shoulderAsymmetry ?? "unknown",
    lordosis: findings.lordosis ?? "unknown",
  };
}

function isEquivalentHistoryEntry(left, right) {
  try {
    if (!left || !right) {
      return false;
    }

    return (
      Number(left.score) === Number(right.score) &&
      String(left.confidence ?? "low") === String(right.confidence ?? "low") &&
      JSON.stringify(normalizeFindings(left.findings)) === JSON.stringify(normalizeFindings(right.findings)) &&
      JSON.stringify(normalizeSummary(left.summary)) === JSON.stringify(normalizeSummary(right.summary)) &&
      String(left.recommendation ?? "capture_retry") === String(right.recommendation ?? "capture_retry")
    );
  } catch (_) {
    return false;
  }
}

function createHistoryEntry({ analysisResult, captures }) {
  const score = Number.isFinite(Number(analysisResult?.score))
    ? Number(analysisResult.score)
    : null;

  return {
    id: createId(),
    date: Date.now(),
    score,
    findings: analysisResult?.findings ?? {},
    confidence: analysisResult?.confidence ?? "low",
    frontImageUri: captures?.front?.uri ?? "",
    sideImageUri: captures?.side?.uri ?? "",
    summary: Array.isArray(analysisResult?.summary) ? analysisResult.summary : [],
    recommendation: analysisResult?.recommendation ?? "capture_retry",
    consistency: analysisResult?.consistency ?? { score: 1.0, isConsistent: true },
    qualityScore: Number(analysisResult?.qualityScore ?? 50),
    qualityLevel: analysisResult?.qualityLevel ?? "low",
    consistencyLevel: analysisResult?.consistency?.consistencyLevel ?? "high",
    comparisonEligible: analysisResult?.consistency?.comparisonEligible ?? true,
  };
}

export async function getPostureHistory() {
  try {
    const raw = await AsyncStorage.getItem(POSTURE_HISTORY_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map(sanitizeHistoryEntry)
      .filter(Boolean)
      .sort((left, right) => right.date - left.date);
  } catch (_) {
    return [];
  }
}

export async function savePostureHistoryEntry({ analysisResult, captures }) {
  const existing = await getPostureHistory();
  const nextEntry = createHistoryEntry({ analysisResult, captures });
  const previousEntry = existing[0] ?? null;

  if (!nextEntry || !Number.isFinite(nextEntry.score)) {
    return {
      savedEntry: null,
      previousEntry,
      history: existing,
      deduped: false,
    };
  }

  if (
    previousEntry &&
    Date.now() - Number(previousEntry.date ?? 0) <= DUPLICATE_WINDOW_MS &&
    isEquivalentHistoryEntry(nextEntry, previousEntry)
  ) {
    return {
      savedEntry: previousEntry,
      previousEntry: existing[1] ?? null,
      history: existing,
      deduped: true,
    };
  }

  const nextHistory = [nextEntry, ...existing].slice(0, MAX_HISTORY_ITEMS);

  await AsyncStorage.setItem(POSTURE_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory));

  return {
    savedEntry: nextEntry,
    previousEntry,
    history: nextHistory,
    deduped: false,
  };
}
