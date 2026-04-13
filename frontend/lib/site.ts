const fallbackSiteUrl = "https://bilimvefitness.com";

function normalizeSiteUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || fallbackSiteUrl;

  return normalizeSiteUrl(configuredUrl);
}

export const siteName = "Bilim ve Fitness";
