"use client";

import { ContinuationPanel } from "@/components/continuation/continuation-panel";
import type { ContinuationConfig } from "@/lib/continuation/types";

type InterestEntryProps = {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  deliverables: string[];
  whyNow?: string;
  delayCost?: string;
  buttonLabel: string;
  successMessage: string;
  helperText?: string;
  inputPlaceholder?: string;
  submitEventName?: ContinuationConfig["submitEventName"];
  submitEventPayload?: ContinuationConfig["submitEventPayload"];
};

export function InterestEntry({
  id,
  eyebrow,
  title,
  description,
  deliverables,
  whyNow,
  delayCost,
  buttonLabel,
  successMessage,
  helperText = "Bu alan haber bulteni icin degil; uygulama katmani acildiginda baglamini kaybetmeden geri donmen icin hazirlandi.",
  inputPlaceholder = "E-posta adresin",
  submitEventName,
  submitEventPayload,
}: InterestEntryProps) {
  return (
    <ContinuationPanel
      id={id}
      eyebrow={eyebrow}
      config={{
        title,
        description,
        deliverables,
        whyNow,
        delayCost,
        buttonLabel,
        successMessage,
        helperText,
        inputPlaceholder,
        submitEventName,
        submitEventPayload,
      }}
    />
  );
}
