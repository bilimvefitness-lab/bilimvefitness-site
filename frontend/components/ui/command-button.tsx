import { AnalyticsLink } from "@/components/analytics/analytics-link";
import type {
  AnalyticsEventName,
  AnalyticsPayload,
} from "@/lib/analytics/events";

type CommandButtonProps = {
  href: string;
  children: string;
  tone?: "primary" | "secondary";
  analyticsEvent?: AnalyticsEventName;
  analyticsPayload?: AnalyticsPayload;
};

export function CommandButton({
  href,
  children,
  tone = "primary",
  analyticsEvent,
  analyticsPayload,
}: CommandButtonProps) {
  const styles =
    tone === "primary"
      ? "bg-ink text-white hover:bg-[#10233b]"
      : "border border-line/15 bg-white text-ink hover:border-line/30 hover:bg-shell";

  return (
    <AnalyticsLink
      href={href}
      analyticsEvent={analyticsEvent}
      analyticsPayload={analyticsPayload}
      className={`inline-flex min-h-11 w-full items-center justify-center rounded-full px-4 py-2.5 text-center text-sm font-medium leading-tight tracking-[0.03em] transition sm:w-auto ${styles}`}
    >
      {children}
    </AnalyticsLink>
  );
}
