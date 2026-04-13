/**
 * i18n/index.ts — Centralised internationalisation system.
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * USAGE
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   // 1. Wrap the app once in App.js:
 *   import { I18nProvider } from "./src/i18n";
 *   <I18nProvider><App /></I18nProvider>
 *
 *   // 2. In any React component:
 *   import { useLanguage } from "../i18n";
 *   const { t, language, setLanguage } = useLanguage();
 *   <Text>{t("common.save")}</Text>
 *   <Text>{t("friends.social.nowFriend", { name: "Ahmet" })}</Text>
 *
 *   // 3. For array values (days, months):
 *   import { tRaw } from "../i18n";
 *   const days = tRaw(language, "home.days") as string[];
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * RESOLUTION ORDER
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   1. DICTS[selectedLang][key]  → hit: return (interpolated if params supplied)
 *   2. DICTS["tr"][key]          → Turkish fallback if English key is missing
 *   3. key itself                → last resort so the UI never shows undefined
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * VARIABLE INTERPOLATION
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   Supports {{variable}} placeholders.
 *   t("friends.social.nowFriend", { name: "Ahmet" })
 *   → "Ahmet artık arkadaşın!"  (tr)
 *   → "Ahmet is now your friend!"  (en)
 *
 * ──────────────────────────────────────────────────────────────────────────────
 * PERSISTENCE
 * ──────────────────────────────────────────────────────────────────────────────
 *
 *   Selected language is saved to AsyncStorage under STORAGE_KEY.
 *   On app launch the stored value is read asynchronously; the UI starts in
 *   Turkish and switches (triggering a single re-render) once the stored
 *   preference is loaded.
 *
 * No JSX — this file is plain TypeScript. The I18nProvider uses
 * React.createElement so the .ts extension is preserved as required.
 */

import React from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import tr from "./tr";
import en from "./en";

// ── Public types ──────────────────────────────────────────────────────────────

export type Language = "tr" | "en";

export const SUPPORTED_LANGUAGES: Language[] = ["tr", "en"];

// ── Internals ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "@app_language";

const DICTS = { tr, en } as const;

/**
 * Walk a dot-separated path through an object.
 * Returns `undefined` when any segment is missing.
 */
function getByPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc !== null && typeof acc === "object") {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * Replace {{key}} placeholders in a string with values from params.
 * Unknown placeholders are left verbatim ({{key}}) for easy debugging.
 */
function interpolate(
  template: string,
  params: Record<string, string | number>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    String(params[k] !== undefined ? params[k] : `{{${k}}}`),
  );
}

function humanizeMissingKey(key: string): string {
  const segments = key.split(".").filter(Boolean);
  const genericTail = new Set([
    "title",
    "subtitle",
    "label",
    "message",
    "messages",
    "hint",
    "body",
    "text",
    "primary",
    "secondary",
  ]);
  const tailSegments = segments.length >= 2 && genericTail.has(segments[segments.length - 1])
    ? segments.slice(-2)
    : segments.slice(-1);

  return tailSegments
    .join(" ")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (match) => match.toUpperCase());
}

// ── Core t() factory ──────────────────────────────────────────────────────────

/**
 * Returns a `t` function bound to the given language.
 * The result is a plain function — safe to call outside React trees
 * (e.g. error handlers, analytics).
 */
export function createT(lang: Language) {
  return function t(
    key: string,
    params?: Record<string, string | number>,
  ): string {
    // Primary lookup → Turkish fallback → bare key
    const raw =
      getByPath(DICTS[lang], key) ??
      getByPath(DICTS["tr"], key);

    if (typeof raw !== "string") return humanizeMissingKey(key);
    return params ? interpolate(raw, params) : raw;
  };
}

/**
 * Return the raw (possibly non-string) value at a path.
 * Use this for arrays like home.days / home.months.
 */
export function tRaw(lang: Language, key: string): unknown {
  return getByPath(DICTS[lang], key) ?? getByPath(DICTS["tr"], key);
}

// ── React context ─────────────────────────────────────────────────────────────

interface I18nCtx {
  language: Language;
  setLanguage: (l: Language) => Promise<void>;
  t: ReturnType<typeof createT>;
}

const DEFAULT_CTX: I18nCtx = {
  language:    "tr",
  setLanguage: async () => {},
  t:           createT("tr"),
};

const I18nContext = React.createContext<I18nCtx>(DEFAULT_CTX);

// ── Provider ──────────────────────────────────────────────────────────────────

/**
 * Wrap the app root once.  Restores the persisted language on mount,
 * then exposes language / setLanguage / t to every descendant.
 */
export function I18nProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [language, setLang] = React.useState<Language>("tr");

  // Restore stored language preference on first mount
  React.useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored && SUPPORTED_LANGUAGES.includes(stored as Language)) {
          setLang(stored as Language);
        }
      })
      .catch(() => {/* stay with default "tr" */});
  }, []);

  // Persist and update simultaneously — UI reacts instantly
  const setLanguage = React.useCallback(async (l: Language): Promise<void> => {
    setLang(l);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, l);
    } catch {/* non-fatal */}
  }, []);

  // Recreate `t` only when language changes
  const value = React.useMemo<I18nCtx>(
    () => ({ language, setLanguage, t: createT(language) }),
    [language, setLanguage],
  );

  // No JSX — createElement keeps this a .ts file
  return React.createElement(I18nContext.Provider, { value }, children);
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Primary hook for all components.
 *
 *   const { t, language, setLanguage } = useLanguage();
 */
export function useLanguage(): I18nCtx {
  return React.useContext(I18nContext);
}
