import { ArticleCard } from "@/components/article/article-card";
import { CommandButton } from "@/components/ui/command-button";
import { HeadingSystem } from "@/components/ui/heading-system";
import { RouteBlock } from "@/components/ui/route-block";
import { SectionWrapper } from "@/components/ui/section-wrapper";
import {
  articleClusters,
  authorityArticles,
  featuredAuthorityArticle,
  getLeadArticleByCluster,
} from "@/content/articles";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Yazilar",
  description:
    "Bilim ve Fitness yazilar sayfasi; daginik bir blog akisi degil, dar sorulari sistem ve test katmanina baglayan kontrollu otorite dizinidir.",
  path: "/yazilar",
  keywords: [
    "antrenman bilimi",
    "fitness yazilari",
    "beslenme ve vucut kompozisyonu",
    "fitness mitleri",
  ],
});

const secondaryArticles = authorityArticles.filter(
  (article) => article.slug !== featuredAuthorityArticle.slug,
);

const authorityRoutes = [
  {
    label: "Sistem",
    title: "Sorun dar gorunuyor ama cerceve eksikse, once omurgayi oku.",
    description:
      "Yazilar dar soruyu cozer. /sistem ise o sorunun daha buyuk mantikta nereye oturdugunu gosterir.",
    commandLabel: "Omurgayi Simdi Oku",
    href: "/sistem",
  },
  {
    label: "Test",
    title: "Soru genel ama karar kisiselse, bir sonraki durak tani katmanidir.",
    description:
      "Yazidan sonra kendin icin hangi rotanin acilmasi gerektigini netlestirmek istiyorsan teste gec.",
    commandLabel: "Teste Gir",
    href: "/test",
  },
];

export default function ArticlesPage() {
  return (
    <>
      <SectionWrapper className="border-none">
        <div className="grid gap-8 rounded-[2.5rem] border border-line/10 bg-white/74 px-6 py-14 shadow-panel sm:px-9 lg:grid-cols-[1fr,0.95fr] lg:px-14 lg:py-18">
          <HeadingSystem
            eyebrow="Bilgi Katmani"
            title="Yazilar, bir akis degil; dar sorulari sirayla temizleyen bilgi katmani."
            description="Buradaki her yazi belirli bir arama niyetini hizli sekilde karsilar, sonra konuyu Bilim ve Fitness omurgasina baglar. Okuma yonu basittir: sorudan gir, sistemi gor, gerekiyorsa taniya gec."
            as="h1"
          >
            <div className="flex flex-wrap gap-3">
              <CommandButton href={`/yazilar/${featuredAuthorityArticle.slug}`}>
                Secili Yaziyi Oku
              </CommandButton>
              <CommandButton href="/test" tone="secondary">
                Teste Gir
              </CommandButton>
            </div>
          </HeadingSystem>

          <ArticleCard article={featuredAuthorityArticle} featured />
        </div>
      </SectionWrapper>

      <SectionWrapper surface="panel">
        <div className="space-y-8 px-6 py-10 lg:px-10 lg:py-14">
          <HeadingSystem
            eyebrow="Konu Omurgasi"
            title="Icerik duvar gibi buyumez; konu mantigina gore acilir."
            description="Asagidaki cluster'lar yazilari kategori olsun diye degil, kullanicinin hangi soru tipinden girdigini anlasin diye sabitlenir."
            as="h2"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {articleClusters.map((cluster) => {
              const count = authorityArticles.filter(
                (article) => article.cluster === cluster.key,
              ).length;
              const leadArticle = getLeadArticleByCluster(cluster.key);

              return (
                <article
                  key={cluster.key}
                  id={cluster.key}
                  className="rounded-[1.6rem] border border-line/10 bg-white/82 p-6 sm:p-7"
                >
                  <p className="text-xs uppercase tracking-[0.2em] text-ink/46">
                    {cluster.label}
                  </p>
                  <h2 className="mt-3 font-display text-[1.45rem] leading-tight text-ink">
                    {count} yazi ile ayni soruyu farkli acilardan toplar.
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-ink/68">{cluster.description}</p>
                  {leadArticle ? (
                    <div className="mt-5">
                      <CommandButton href={`/yazilar/${leadArticle.slug}`} tone="secondary">
                        Cluster'dan Basla
                      </CommandButton>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-10 lg:grid-cols-[0.88fr,1.12fr]">
          <HeadingSystem
            eyebrow="Okuma Yonu"
            title="Ilk olarak soruya en yakin yazidan gir. Sonra konuyu daha buyuk sistemde yerine koy."
            description="Liste bilerek sinirlidir. Buradaki her kart, cluster mantigi gorunur kalsin ve her bir yazi seni bir sonraki dogru duraga itsin diye secildi."
            as="h2"
          />
          <div className="grid gap-4 md:grid-cols-2">
            {secondaryArticles.map((article) => (
              <ArticleCard key={article.slug} article={article} />
            ))}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper className="border-none">
        <div className="rounded-[2.5rem] border border-line/10 bg-ink px-6 py-12 text-white shadow-panel sm:px-9 lg:px-14 lg:py-16">
          <HeadingSystem
            eyebrow="Sonraki Ayrim"
            title="Yazi dar soruyu kapatir. Sonraki hamle, sistem mi tani mi gerektigine gore acilir."
            description="Eger okuduklarin sende tekrarlayan daha buyuk bir yapisal soruna isaret ediyorsa omurgaya gec. Eger konu artik kisisel rotana donusuyorsa tani katmanina ilerle."
            as="h2"
            tone="light"
          />
          <div className="mt-8 grid gap-4 lg:grid-cols-2">
            {authorityRoutes.map((route) => (
              <RouteBlock
                key={route.title}
                label={route.label}
                title={route.title}
                description={route.description}
                commandLabel={route.commandLabel}
                href={route.href}
              />
            ))}
          </div>
        </div>
      </SectionWrapper>
    </>
  );
}
