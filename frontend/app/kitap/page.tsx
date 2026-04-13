import { InterestEntry } from "@/components/product/interest-entry";
import { CtaCluster } from "@/components/ui/cta-cluster";
import { CommandButton } from "@/components/ui/command-button";
import { HeadingSystem } from "@/components/ui/heading-system";
import { RouteBlock } from "@/components/ui/route-block";
import { SectionWrapper } from "@/components/ui/section-wrapper";
import { SystemLayerCard } from "@/components/ui/system-layer-card";
import { TrustBlock } from "@/components/ui/trust-block";
import { bookPageContent } from "@/content/product-layer";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Kitap",
  description:
    "Bilim ve Fitness kitap sayfasi; kitabi genel fitness tavsiyesi degil, netlik, yapi ve yon kuran ilk sistem katmani olarak konumlandirir.",
  path: "/kitap",
  keywords: [
    "fitness kitabi",
    "bilimsel fitness kitabi",
    "fitness baslangic sistemi",
    "antrenman kitabi",
  ],
});

export default function BookPage() {
  return (
    <>
      <SectionWrapper className="border-none">
        <div className="grid gap-8 rounded-[2.5rem] border border-line/10 bg-white/74 px-6 py-14 shadow-panel sm:px-9 lg:grid-cols-[1.05fr,0.95fr] lg:px-14 lg:py-18">
          <HeadingSystem
            eyebrow={bookPageContent.hero.eyebrow}
            title={bookPageContent.hero.title}
            description={bookPageContent.hero.description}
            as="h1"
          >
            <CtaCluster
              primary={{
                ...bookPageContent.hero.primaryCommand,
                analyticsEvent: "kitap_cta_click",
                analyticsPayload: {
                  location: "kitap_hero",
                },
              }}
              secondary={bookPageContent.hero.secondaryCommand}
              hint={bookPageContent.hero.hint}
            />
          </HeadingSystem>

          <div className="rounded-[2rem] border border-line/10 bg-ink p-7 text-white">
            <p className="text-xs uppercase tracking-[0.22em] text-white/56">
              {bookPageContent.hero.panelEyebrow}
            </p>
            <p className="mt-4 font-display text-3xl leading-tight">
              {bookPageContent.hero.panelTitle}
            </p>
            <p className="mt-5 text-sm leading-7 text-white/72">
              {bookPageContent.hero.panelDescription}
            </p>
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-10 lg:grid-cols-[0.92fr,1.08fr]">
          <HeadingSystem
            eyebrow={bookPageContent.whatItIs.eyebrow}
            title={bookPageContent.whatItIs.title}
            description={bookPageContent.whatItIs.description}
            as="h2"
          />
          <TrustBlock items={bookPageContent.solvedProblems} />
        </div>
      </SectionWrapper>

      <SectionWrapper surface="panel">
        <div className="space-y-8 px-6 py-10 lg:px-10 lg:py-14">
          <HeadingSystem
            eyebrow="Ne Kazanirsin"
            title="Kitap, soyut fayda degil daha sakin bir ilk duzen uretir."
            description="Buradaki kazanc motivasyon degil; daha temiz siralama, daha dusuk karar yorgunlugu ve daha kontrollu giristir."
            as="h2"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {bookPageContent.gains.map((item, index) => (
              <SystemLayerCard
                key={item.title}
                index={`0${index + 1} / Kazanim`}
                title={item.title}
                description={item.description}
              />
            ))}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-4 lg:grid-cols-2">
          <article className="rounded-[1.75rem] border border-line/10 bg-white/82 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/48">
              {bookPageContent.forYou.eyebrow}
            </p>
            <h2 className="mt-3 font-display text-[2rem] leading-tight text-ink">
              {bookPageContent.forYou.title}
            </h2>
            <p className="mt-4 max-w-reading text-sm leading-7 text-ink/68 sm:text-base">
              {bookPageContent.forYou.description}
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-ink/72">
              {bookPageContent.forYou.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-ink/70" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[1.75rem] border border-line/10 bg-white/82 p-6 sm:p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/48">
              {bookPageContent.notForYou.eyebrow}
            </p>
            <h2 className="mt-3 font-display text-[2rem] leading-tight text-ink">
              {bookPageContent.notForYou.title}
            </h2>
            <p className="mt-4 max-w-reading text-sm leading-7 text-ink/68 sm:text-base">
              {bookPageContent.notForYou.description}
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-ink/72">
              {bookPageContent.notForYou.items.map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="mt-2 h-1.5 w-1.5 rounded-full bg-ink/70" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-10 lg:grid-cols-[0.92fr,1.08fr]">
          <HeadingSystem
            eyebrow="Sistemdeki Yeri"
            title="Kitap, /sistem ve /test ile birlikte calisan ilk uygulama katmanidir."
            description="Bu sayfa tek basina ikna olmaya calismaz. Sistemin mantigi, testin tani gucu ve kitabin giris duzeni ayni akista calisir."
            as="h2"
          />
          <div className="grid gap-4">
            {bookPageContent.systemRoutes.map((item) => (
              <RouteBlock
                key={item.title}
                label={item.label}
                title={item.title}
                description={item.description}
                commandLabel={item.commandLabel}
                href={item.href}
              />
            ))}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper surface="panel">
        <div className="space-y-8 px-6 py-10 lg:px-10 lg:py-14">
          <HeadingSystem
            eyebrow="Testten Gelen Rota"
            title="Bu sayfa ozellikle belirli test profillerinde anlam kazanir."
            description="Dinamik eslestirme sonraki asamada baglanacak. Simdilik hangi segmentlerin kitapla dogal olarak ortustugunu acik sekilde sabitliyoruz."
            as="h2"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {bookPageContent.segmentRelevance.map((item) => (
              <SystemLayerCard
                key={item.segment}
                index={item.label}
                title={item.title}
                description={item.description}
              />
            ))}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper id="kitap-rotasi">
        <InterestEntry
          id="kitap-rotasi-formu"
          eyebrow={bookPageContent.hesitation.eyebrow}
          title={bookPageContent.hesitation.title}
          description={bookPageContent.hesitation.description}
          deliverables={bookPageContent.hesitation.deliverables}
          whyNow={bookPageContent.hesitation.whyNow}
          delayCost={bookPageContent.hesitation.delayCost}
          buttonLabel={bookPageContent.hesitation.buttonLabel}
          successMessage={bookPageContent.hesitation.successMessage}
          helperText={bookPageContent.hesitation.helperText}
          inputPlaceholder={bookPageContent.hesitation.inputPlaceholder}
        />
      </SectionWrapper>

      <SectionWrapper className="border-none">
        <div className="rounded-[2.5rem] border border-line/10 bg-ink px-6 py-12 text-white shadow-panel sm:px-9 lg:px-14 lg:py-16">
          <HeadingSystem
            eyebrow="Sonraki Adim"
            title={bookPageContent.finalCta.title}
            description={bookPageContent.finalCta.description}
            as="h2"
            tone="light"
          >
            <div className="pt-1">
              <CommandButton
                href={bookPageContent.finalCta.command.href}
                tone="secondary"
                analyticsEvent="kitap_cta_click"
                analyticsPayload={{ location: "kitap_final" }}
              >
                {bookPageContent.finalCta.command.label}
              </CommandButton>
            </div>
          </HeadingSystem>
        </div>
      </SectionWrapper>
    </>
  );
}
