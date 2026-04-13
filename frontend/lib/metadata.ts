import type { Metadata } from "next";

import { getSiteUrl, siteName } from "@/lib/site";

const defaultDescription =
  "Bilim ve Fitness; bilimsel netlik, premium yapi ve uzun vadeli donusum uzerine kurulu modern fitness ekosistemidir.";

export function buildMetadata({
  title,
  description = defaultDescription,
  path = "",
  keywords = [],
  ogType = "website",
  category = "fitness",
  noIndex = false,
}: {
  title: string;
  description?: string;
  path?: string;
  keywords?: string[];
  ogType?: "website" | "article";
  category?: string;
  noIndex?: boolean;
}): Metadata {
  const siteUrl = getSiteUrl();
  const defaultImage = `${siteUrl}/og-default.svg`;
  const fullTitle = `${title} | ${siteName}`;
  const url = `${siteUrl}${path}`;

  return {
    title: fullTitle,
    description,
    metadataBase: new URL(siteUrl),
    applicationName: siteName,
    creator: siteName,
    publisher: siteName,
    category,
    keywords,
    alternates: {
      canonical: url,
    },
    robots: {
      index: !noIndex,
      follow: !noIndex,
      googleBot: {
        index: !noIndex,
        follow: !noIndex,
        "max-image-preview": "large",
        "max-snippet": -1,
        "max-video-preview": -1,
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName,
      locale: "tr_TR",
      type: ogType,
      images: [
        {
          url: defaultImage,
          width: 1200,
          height: 630,
          alt: fullTitle,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [defaultImage],
    },
  };
}
