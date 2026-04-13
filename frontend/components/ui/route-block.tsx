import { CommandButton } from "@/components/ui/command-button";
import type {
  AnalyticsEventName,
  AnalyticsPayload,
} from "@/lib/analytics/events";

type RouteBlockProps = {
  label: string;
  title: string;
  description: string;
  commandLabel: string;
  href: string;
  analyticsEvent?: AnalyticsEventName;
  analyticsPayload?: AnalyticsPayload;
};

export function RouteBlock({
  label,
  title,
  description,
  commandLabel,
  href,
  analyticsEvent,
  analyticsPayload,
}: RouteBlockProps) {
  return (
    <article className="flex h-full flex-col gap-4 rounded-[1.6rem] border border-line/10 bg-white/82 p-6 sm:p-7">
      <span className="text-xs uppercase tracking-[0.2em] text-ink/46">{label}</span>
      <h3 className="break-words font-display text-[1.55rem] leading-tight text-ink">{title}</h3>
      <p className="text-sm leading-7 text-ink/68 sm:text-[0.95rem]">{description}</p>
      <div className="pt-1">
        <CommandButton
          href={href}
          tone="secondary"
          analyticsEvent={analyticsEvent}
          analyticsPayload={analyticsPayload}
        >
          {commandLabel}
        </CommandButton>
      </div>
    </article>
  );
}
