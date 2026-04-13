import { notFound } from "next/navigation";

import { ArticleContinuationBlock } from "@/components/article/article-continuation-block";
import { ArticleHeader } from "@/components/article/article-header";
import { ArticleSummaryBlock } from "@/components/article/article-summary-block";
import { CommandButton } from "@/components/ui/command-button";
import { HeadingSystem } from "@/components/ui/heading-system";
import { RouteBlock } from "@/components/ui/route-block";
import { SectionWrapper } from "@/components/ui/section-wrapper";
import {
  authorityArticles,
  buildArticleContinuationConfig,
  getClusterDefinition,
  getArticleBySlug,
} from "@/content/articles";
import { articleSchema } from "@/lib/schema";
import { buildMetadata } from "@/lib/metadata";

type ArticlePageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return authorityArticles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    return buildMetadata({
      title: "Yazi Bulunamadi",
      path: "/yazilar",
    });
  }

  return buildMetadata({
    title: article.title,
    description: article.summary,
    path: `/yazilar/${article.slug}`,
    ogType: "article",
    category: "article",
    keywords: [
      article.title,
      getClusterDefinition(article.cluster)?.label ?? article.cluster,
      "bilimsel fitness",
    ],
  });
}

export default async function ArticlePage({ params }: ArticlePageProps) {
  const { slug } = await params;
  const article = getArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  const continuation = buildArticleContinuationConfig(article);
  const schema = articleSchema(article);

  return (
    <article>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
      />
      <SectionWrapper className="border-none">
        <div className="grid gap-8 rounded-[2.5rem] border border-line/10 bg-white/74 px-6 py-14 shadow-panel sm:px-9 lg:grid-cols-[1fr,0.95fr] lg:px-14 lg:py-18">
          <ArticleHeader article={article} />
          <ArticleSummaryBlock
            eyebrow={article.opening.eyebrow}
            title={article.opening.answerTitle}
            description={article.opening.answer}
          />
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-10 lg:grid-cols-[0.88fr,1.12fr]">
          <HeadingSystem
            eyebrow="Problem Netlestirme"
            title={article.clarification.title}
            description={article.clarification.description}
            as="h2"
          />
          <article className="rounded-[1.75rem] border border-line/10 bg-white/82 p-6 sm:p-8">
            <ul className="space-y-3 text-sm leading-7 text-ink/72 sm:text-base">
              {article.clarification.points.map((point) => (
                <li key={point} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-ink/70" />
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </SectionWrapper>

      <SectionWrapper surface="panel">
        <div className="grid gap-10 px-6 py-10 lg:grid-cols-[0.88fr,1.12fr] lg:px-10 lg:py-14">
          <HeadingSystem
            eyebrow="Bilimsel Aciklama"
            title={article.explanation.title}
            description="Dar soruyu buyuten mekanizma acik olmadiginda tavsiye kolayca yanlis yere oturur. Bu bolum o mekanizmayi sabitler."
            as="h2"
          />
          <article className="space-y-5 rounded-[1.75rem] border border-line/10 bg-white/78 p-6 sm:p-8">
            {article.explanation.paragraphs.map((paragraph) => (
              <p key={paragraph} className="text-sm leading-7 text-ink/72 sm:text-base">
                {paragraph}
              </p>
            ))}
          </article>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-10 lg:grid-cols-[0.88fr,1.12fr]">
          <HeadingSystem
            eyebrow="Pratik Yorum"
            title={article.practical.title}
            description={article.practical.description}
            as="h2"
          />
          <article className="rounded-[1.75rem] border border-line/10 bg-white/82 p-6 sm:p-8">
            <ol className="space-y-4 text-sm leading-7 text-ink/72 sm:text-base">
              {article.practical.actions.map((action, index) => (
                <li key={action} className="flex gap-4">
                  <span className="inline-flex h-8 w-8 flex-none items-center justify-center rounded-full border border-line/10 bg-shell text-xs font-medium uppercase tracking-[0.16em] text-ink/58">
                    0{index + 1}
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          </article>
        </div>
      </SectionWrapper>

      <SectionWrapper surface="panel">
        <div className="space-y-6 px-6 py-10 lg:px-10 lg:py-14">
          <HeadingSystem
            eyebrow="Sistem Koprusu"
            title={article.systemBridge.title}
            description={`${article.systemBridge.description} Bu yaziyi okurken kendini gorduysen bunu olcmeden ilerleme.`}
            as="h2"
          >
            <div className="flex flex-wrap gap-3">
              <CommandButton
                href={article.systemBridge.primaryCommand.href}
                analyticsEvent="article_to_system_click"
                analyticsPayload={{ slug: article.slug, cluster: article.cluster }}
              >
                {article.systemBridge.primaryCommand.label}
              </CommandButton>
              <CommandButton
                href={article.systemBridge.secondaryCommand.href}
                tone="secondary"
                analyticsEvent="article_to_test_click"
                analyticsPayload={{ slug: article.slug, cluster: article.cluster }}
              >
                {article.systemBridge.secondaryCommand.label}
              </CommandButton>
            </div>
          </HeadingSystem>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-10 lg:grid-cols-[0.88fr,1.12fr]">
          <HeadingSystem
            eyebrow="Duruma Gore Sonraki Adim"
            title={article.stateNextStep.title}
            description={`${article.stateNextStep.description} Bu noktada not alip cikmak yerine hangi kapidan ilerleyecegini kapatman gerekir.`}
            as="h2"
          />
          <div className="grid gap-4">
            {article.stateNextStep.routes.map((route) => (
              <RouteBlock
                key={route.title}
                label={route.label}
                title={route.title}
                description={route.description}
                commandLabel={route.commandLabel}
                href={route.href}
                analyticsEvent={
                  route.href === "/test"
                    ? "article_to_test_click"
                    : route.href === "/sistem"
                      ? "article_to_system_click"
                      : undefined
                }
                analyticsPayload={{ slug: article.slug, cluster: article.cluster }}
              />
            ))}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper id="article-continuation" className="border-none">
        <ArticleContinuationBlock
          eyebrow="Devam Katmani"
          title={continuation.title}
          description={continuation.description}
          deliverables={continuation.deliverables}
          whyNow={continuation.whyNow}
          delayCost={continuation.delayCost}
          buttonLabel={continuation.buttonLabel}
          successMessage={continuation.successMessage}
          helperText={continuation.helperText}
          inputPlaceholder={continuation.inputPlaceholder}
        />
      </SectionWrapper>
    </article>
  );
}
