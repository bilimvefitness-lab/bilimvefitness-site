"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import {
  trackEvent,
  type AnalyticsEventName,
  type AnalyticsPayload,
} from "@/lib/analytics/events";

type AnalyticsLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
  children: ReactNode;
  analyticsEvent?: AnalyticsEventName;
  analyticsPayload?: AnalyticsPayload;
};

export function AnalyticsLink({
  children,
  analyticsEvent,
  analyticsPayload,
  onClick,
  ...props
}: AnalyticsLinkProps) {
  return (
    <Link
      {...props}
      onClick={(event) => {
        if (analyticsEvent) {
          trackEvent(analyticsEvent, analyticsPayload);
        }

        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
