import { getClusterDefinition, type AuthorityArticle } from "@/content/articles";
import { getSiteUrl } from "@/lib/site";

export function organizationSchema() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bilim ve Fitness",
    url: siteUrl,
    description:
      "Bilimsel fitness, test sistemleri ve dijital urunler etrafinda kurulan premium modern ekosistem.",
  };
}

export function websiteSchema() {
  const siteUrl = getSiteUrl();

  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Bilim ve Fitness",
    url: siteUrl,
    description:
      "Bilim ve Fitness; bilimsel fitness bilgisini sistem, test, kitap, uygulama ve yazi katmanlariyla birlestiren dijital merkezdir.",
    inLanguage: "tr-TR",
  };
}

export function articleSchema(article: AuthorityArticle) {
  const siteUrl = getSiteUrl();
  const cluster = getClusterDefinition(article.cluster);
  const readingMinutes = Number.parseInt(article.readingTime, 10);

  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    inLanguage: "tr-TR",
    mainEntityOfPage: `${siteUrl}/yazilar/${article.slug}`,
    url: `${siteUrl}/yazilar/${article.slug}`,
    author: {
      "@type": "Organization",
      name: "Bilim ve Fitness",
    },
    publisher: {
      "@type": "Organization",
      name: "Bilim ve Fitness",
    },
    articleSection: cluster?.label ?? article.cluster,
    timeRequired: Number.isNaN(readingMinutes) ? undefined : `PT${readingMinutes}M`,
  };
}
