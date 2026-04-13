"use client";

import { ContinuationPanel } from "@/components/continuation/continuation-panel";

type ArticleContinuationBlockProps = {
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
};

export function ArticleContinuationBlock({
  id,
  eyebrow,
  title,
  description,
  deliverables,
  whyNow,
  delayCost,
  buttonLabel,
  successMessage,
  helperText = "Bu alan bulten toplamak icin degil; yazidan cikarken rotani ve sonraki adimini kaybetmemen icin hazirlandi.",
  inputPlaceholder = "E-posta adresin",
}: ArticleContinuationBlockProps) {
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
      }}
    />
  );
}
