/**
 * Lightweight analytics event tracker.
 *
 * Logs events to AsyncStorage as an append-only array.
 * Easy to swap for a real provider (Amplitude, Mixpanel, PostHog) later
 * by replacing the `persist` function below.
 *
 * Usage:  import { trackEvent } from "../utils/analytics";
 *         trackEvent("meal_added", { mealType: "kahvalti" });
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const ANALYTICS_KEY = "fitness-notebook-analytics-events";
const MAX_LOCAL_EVENTS = 500; // ring-buffer cap to prevent unbounded growth

/**
 * Track a named event with optional properties.
 * Fire-and-forget — never throws, never blocks UI.
 */
export function trackEvent(name, properties = {}) {
  const event = {
    name,
    properties,
    timestamp: new Date().toISOString(),
  };

  // Console output in dev for quick debugging
  if (__DEV__) {
    console.log(`[analytics] ${name}`, properties);
  }

  persist(event).catch(() => {});
}

// ── Internal ──────────────────────────────────────────────────────────────────

async function persist(event) {
  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_KEY);
    const events = raw ? JSON.parse(raw) : [];
    events.push(event);

    // Keep only the most recent MAX_LOCAL_EVENTS
    const trimmed = events.length > MAX_LOCAL_EVENTS
      ? events.slice(events.length - MAX_LOCAL_EVENTS)
      : events;

    await AsyncStorage.setItem(ANALYTICS_KEY, JSON.stringify(trimmed));
  } catch (_) {
    // Silently swallow — analytics must never crash the app
  }
}

/**
 * Retrieve all locally stored events (for debugging or future batch upload).
 */
export async function getStoredEvents() {
  try {
    const raw = await AsyncStorage.getItem(ANALYTICS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Clear all locally stored events (e.g. after successful batch upload).
 */
export async function clearStoredEvents() {
  try {
    await AsyncStorage.removeItem(ANALYTICS_KEY);
  } catch (_) {}
}
