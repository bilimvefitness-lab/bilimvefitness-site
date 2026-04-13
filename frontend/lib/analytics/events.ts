export const analyticsEventNames = [
  "test_start",
  "test_complete",
  "continuation_submit",
  "kitap_cta_click",
  "uygulama_waitlist_click",
  "article_to_test_click",
  "article_to_system_click",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export type AnalyticsPayload = Record<
  string,
  string | number | boolean | null | undefined
>;

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
  }
}

export function trackEvent(name: AnalyticsEventName, payload: AnalyticsPayload = {}) {
  if (typeof window === "undefined") {
    return;
  }

  const detail = {
    name,
    payload,
    timestamp: Date.now(),
  };

  window.dispatchEvent(new CustomEvent("bilim-ve-fitness:event", { detail }));

  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({
      event: name,
      ...payload,
    });
  }
}
