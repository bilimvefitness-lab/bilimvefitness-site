/**
 * Canonical sleepDay utilities.
 *
 * ALL date comparisons in the sleep module must use LOCAL calendar dates
 * (YYYY-MM-DD).  new Date().toISOString().slice(0,10) gives the UTC date
 * which is ±1 day from local for users outside UTC — causing
 * pickSummaryForDay to silently return null.
 *
 * Single source of truth: import getLocalDateString / resolveSleepDay from
 * here instead of re-implementing in each service.
 */

/**
 * Returns the LOCAL calendar date of `date` as a YYYY-MM-DD string.
 * Uses the en-CA locale which guarantees that format across all platforms.
 */
export function getLocalDateString(date: Date): string {
  return date.toLocaleDateString("en-CA");
}

/**
 * Derives the sleepDay for a sleep session.
 * sleepDay is defined as the LOCAL calendar date the user woke up (endTime).
 */
export function resolveSleepDay(start: Date, end: Date): string {
  return getLocalDateString(end);
}

/**
 * Parses any ISO timestamp or YYYY-MM-DD string and returns a LOCAL YYYY-MM-DD.
 * Returns null for invalid / empty input.
 */
export function parseToLocalDay(value?: string | null): string | null {
  const normalized = String(value || "").trim();
  if (!normalized) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return normalized;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return getLocalDateString(parsed);
}
