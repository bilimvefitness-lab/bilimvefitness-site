import Link from "next/link";

import { ArticleClusterLabel } from "@/components/article/article-cluster-label";
import {
  getClusterDefinition,
  getIntentLabel,
  type AuthorityArticle,
} from "@/content/articles";

type ArticleCardProps = {
  article: AuthorityArticle;
  featured?: boolean;
};

export function ArticleCard({ article, featured = false }: ArticleCardProps) {
  const cluster = getClusterDefinition(article.cluster);
  const intentLabel = getIntentLabel(article.intent);

  return (
    <Link
      href={`/yazilar/${article.slug}`}
      className={`group flex h-full flex-col rounded-[1.9rem] border border-line/10 bg-white/82 transition hover:border-line/20 hover:bg-white ${
        featured ? "p-7 shadow-panel sm:p-8" : "p-6 sm:p-7"
      }`}
    >
      <ArticleClusterLabel
        cluster={cluster?.label ?? article.cluster}
        intent={intentLabel}
        readingTime={article.readingTime}
      />
      <h2
        className={`mt-5 break-words font-display leading-tight text-ink ${
          featured ? "text-[2rem] sm:text-[2.4rem]" : "text-[1.55rem]"
        }`}
      >
        {article.title}
      </h2>
      <p className="mt-4 max-w-reading text-sm leading-7 text-ink/68 sm:text-base">
        {article.summary}
      </p>
      <div className="mt-6 text-sm font-medium tracking-[0.03em] text-ink/74 transition group-hover:text-ink">
        Yaziyi Oku
      </div>
    </Link>
  );
}
