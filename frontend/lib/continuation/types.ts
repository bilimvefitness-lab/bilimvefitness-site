import type { AnalyticsEventName, AnalyticsPayload } from "@/lib/analytics/events";

export type ContinuationConfig = {
  title: string;
  description: string;
  deliverables: string[];
  whyNow?: string;
  delayCost?: string;
  buttonLabel: string;
  successMessage: string;
  helperText: string;
  inputPlaceholder: string;
  submitEventName?: AnalyticsEventName;
  submitEventPayload?: AnalyticsPayload;
};

export type RouteRecommendation = {
  label: string;
  title: string;
  description: string;
  href: string;
  commandLabel: string;
};
