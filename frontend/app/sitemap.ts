import type { MetadataRoute } from "next";

import { authorityArticles } from "@/content/articles";
import { getSiteUrl } from "@/lib/site";

const staticRoutes = [
  "",
  "/sistem",
  "/test",
  "/yazilar",
  "/kitap",
  "/uygulama",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  const staticEntries = staticRoutes.map((route) => ({
    url: `${siteUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: route === "" ? 1 : route === "/test" || route === "/sistem" ? 0.9 : 0.8,
  }));

  const articleEntries = authorityArticles.map((article) => ({
    url: `${siteUrl}/yazilar/${article.slug}`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.72,
  }));

  return [...staticEntries, ...articleEntries];
}
