import { ArticleClusterLabel } from "@/components/article/article-cluster-label";
import {
  getClusterDefinition,
  getIntentLabel,
  type AuthorityArticle,
} from "@/content/articles";

type ArticleHeaderProps = {
  article: AuthorityArticle;
};

export function ArticleHeader({ article }: ArticleHeaderProps) {
  const cluster = getClusterDefinition(article.cluster);
  const intentLabel = getIntentLabel(article.intent);

  return (
    <div className="flex max-w-3xl flex-col gap-5 text-left">
      <ArticleClusterLabel
        cluster={cluster?.label ?? article.cluster}
        intent={intentLabel}
        readingTime={article.readingTime}
      />
      <h1 className="break-words font-display text-[2.65rem] leading-tight text-ink sm:text-5xl lg:text-6xl">
        {article.opening.title}
      </h1>
      <p className="max-w-reading text-base leading-8 text-ink/72 sm:text-lg">
        {article.opening.description}
      </p>
    </div>
  );
}
