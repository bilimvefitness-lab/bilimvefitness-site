import { CommandButton } from "@/components/ui/command-button";
import type {
  AnalyticsEventName,
  AnalyticsPayload,
} from "@/lib/analytics/events";

type Command = {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
  analyticsEvent?: AnalyticsEventName;
  analyticsPayload?: AnalyticsPayload;
};

type CtaClusterProps = {
  primary: Command;
  secondary?: Command;
  hint?: string;
  tone?: "dark" | "light";
};

export function CtaCluster({ primary, secondary, hint, tone = "dark" }: CtaClusterProps) {
  const hintClass = tone === "light" ? "text-white/68" : "text-ink/56";

  return (
    <div className="flex flex-col items-start gap-4">
      <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap">
        <CommandButton
          href={primary.href}
          tone={primary.tone}
          analyticsEvent={primary.analyticsEvent}
          analyticsPayload={primary.analyticsPayload}
        >
          {primary.label}
        </CommandButton>
        {secondary ? (
          <CommandButton
            href={secondary.href}
            tone={secondary.tone ?? "secondary"}
            analyticsEvent={secondary.analyticsEvent}
            analyticsPayload={secondary.analyticsPayload}
          >
            {secondary.label}
          </CommandButton>
        ) : null}
      </div>
      {hint ? <p className={`max-w-xl text-sm leading-7 ${hintClass}`}>{hint}</p> : null}
    </div>
  );
}
