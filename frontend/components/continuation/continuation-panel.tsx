"use client";

import { useState } from "react";

import { trackEvent } from "@/lib/analytics/events";
import type { ContinuationConfig } from "@/lib/continuation/types";

type ContinuationPanelProps = {
  id?: string;
  eyebrow: string;
  config: ContinuationConfig;
};

export function ContinuationPanel({
  id,
  eyebrow,
  config,
}: ContinuationPanelProps) {
  const [email, setEmail] = useState("");
  const [saved, setSaved] = useState(false);

  const normalizedEmail = email.trim();
  const canSubmit =
    normalizedEmail.length > 5 &&
    normalizedEmail.includes("@") &&
    normalizedEmail.includes(".");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSubmit) {
      return;
    }

    trackEvent("continuation_submit", {
      location: id ?? eyebrow,
    });

    if (config.submitEventName) {
      trackEvent(config.submitEventName, config.submitEventPayload);
    }

    setSaved(true);
  }

  return (
    <form
      id={id}
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-line/10 bg-white/88 p-6 shadow-panel sm:p-7"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-ink/48">{eyebrow}</p>
      <h2 className="mt-3 break-words font-display text-[1.85rem] leading-tight text-ink sm:text-[2.2rem]">
        {config.title}
      </h2>
      <p className="mt-3 max-w-reading text-sm leading-7 text-ink/68 sm:text-base">
        {config.description}
      </p>

      <ul className="mt-5 space-y-2 text-sm leading-7 text-ink/70">
        {config.deliverables.map((item) => (
          <li key={item} className="flex gap-3">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-ink/70" />
            <span>{item}</span>
          </li>
        ))}
      </ul>

      {config.whyNow || config.delayCost ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {config.whyNow ? (
            <div className="rounded-[1.2rem] border border-line/10 bg-shell px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink/48">Neden simdi</p>
              <p className="mt-2 text-sm leading-6 text-ink/68">{config.whyNow}</p>
            </div>
          ) : null}
          {config.delayCost ? (
            <div className="rounded-[1.2rem] border border-line/10 bg-shell px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.18em] text-ink/48">
                Beklersen ne olur
              </p>
              <p className="mt-2 text-sm leading-6 text-ink/68">{config.delayCost}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <input
          type="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setSaved(false);
          }}
          placeholder={config.inputPlaceholder}
          autoComplete="email"
          inputMode="email"
          aria-label="E-posta adresi"
          className="min-h-11 min-w-0 flex-1 rounded-full border border-line/15 bg-shell px-4 text-sm text-ink outline-none transition focus:border-ink/30"
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-11 rounded-full bg-ink px-5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-ink/28 disabled:text-white/76"
        >
          {config.buttonLabel}
        </button>
      </div>

      <p className="mt-4 text-sm leading-7 text-ink/62" role="status" aria-live="polite">
        {saved ? config.successMessage : config.helperText}
      </p>
    </form>
  );
}
