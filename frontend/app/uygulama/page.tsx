import { InterestEntry } from "@/components/product/interest-entry";
import { CtaCluster } from "@/components/ui/cta-cluster";
import { HeadingSystem } from "@/components/ui/heading-system";
import { RouteBlock } from "@/components/ui/route-block";
import { SectionWrapper } from "@/components/ui/section-wrapper";
import { SystemLayerCard } from "@/components/ui/system-layer-card";
import { TrustBlock } from "@/components/ui/trust-block";
import { appPageContent } from "@/content/product-layer";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Uygulama",
  description:
    "Bilim ve Fitness uygulama sayfasi; uygulamayi bagimsiz bir urun degil, karar, takip ve sureklilik tasiyan uygulama katmani olarak konumlandirir.",
  path: "/uygulama",
  keywords: [
    "fitness uygulamasi",
    "antrenman takibi",
    "fitness sureklilik sistemi",
    "erken erisim fitness uygulamasi",
  ],
});

export default function AppPage() {
  return (
    <>
      <SectionWrapper className="border-none">
        <div className="grid gap-8 rounded-[2.5rem] border border-line/10 bg-white/74 px-6 py-14 shadow-panel sm:px-9 lg:grid-cols-[1.05fr,0.95fr] lg:px-14 lg:py-18">
          <HeadingSystem
            eyebrow={appPageContent.hero.eyebrow}
            title={appPageContent.hero.title}
            description={appPageContent.hero.description}
            as="h1"
          >
            <CtaCluster
              primary={appPageContent.hero.primaryCommand}
              secondary={appPageContent.hero.secondaryCommand}
              hint={appPageContent.hero.hint}
            />
          </HeadingSystem>

          <div className="rounded-[2rem] border border-line/10 bg-ink p-7 text-white">
            <p className="text-xs uppercase tracking-[0.22em] text-white/56">
              {appPageContent.hero.panelEyebrow}
            </p>
            <p className="mt-4 font-display text-3xl leading-tight">
              {appPageContent.hero.panelTitle}
            </p>
            <p className="mt-5 text-sm leading-7 text-white/72">
              {appPageContent.hero.panelDescription}
            </p>
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-10 lg:grid-cols-[0.92fr,1.08fr]">
          <HeadingSystem
            eyebrow="Bu Katman Ne Yapar"
            title="Uygulama, karar destegi, takip ve yonlendirmeyi ayni yerde toplar."
            description="Amaci daha cok ozellik gostermek degil; bilgiyi gunluk tekrar ritmine baglamaktir."
            as="h2"
          />
          <TrustBlock items={appPageContent.whatItDoes} />
        </div>
      </SectionWrapper>

      <SectionWrapper surface="panel">
        <div className="grid gap-10 px-6 py-10 lg:grid-cols-[0.92fr,1.08fr] lg:px-10 lg:py-14">
          <HeadingSystem
            eyebrow={appPageContent.whyItExists.eyebrow}
            title={appPageContent.whyItExists.title}
            description={appPageContent.whyItExists.description}
            as="h2"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {appPageContent.futurePositioning.map((item, index) => (
              <SystemLayerCard
                key={item.title}
                index={`0${index + 1} / Katman`}
                title={item.title}
                description={item.description}
              />
            ))}
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <article className="rounded-[1.75rem] border border-line/10 bg-white/82 p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-ink/48">
            {appPageContent.forYou.eyebrow}
          </p>
          <h2 className="mt-3 font-display text-[2rem] leading-tight text-ink">
            {appPageContent.forYou.title}
          </h2>
          <p className="mt-4 max-w-reading text-sm leading-7 text-ink/68 sm:text-base">
            {appPageContent.forYou.description}
          </p>
          <ul className="mt-5 grid gap-3 text-sm leading-7 text-ink/72 lg:grid-cols-2">
            {appPageContent.forYou.items.map((item) => (
              <li key={item} className="flex gap-3">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-ink/70" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-10 lg:grid-cols-[0.92fr,1.08fr]">
          <HeadingSystem
            eyebrow="Sistemdeki Yeri"
            title="Uygulama, test ve sistem mantigini gunluk uygulama duzenine baglar."
            description="Bu sayfa bir uygulama vaadi degil; hangi kosulda neden gerekli oldugunu acik sekilde sabitler."
            as="h2"
          />
          <div className="grid gap-4">
            {appPageContent.systemRoutes.map((item) => (
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
            title="Uygulama katmani her segment icin acilmaz; belirli profillerde anlam kazanir."
            description="Dinamik eslestirme sonraki asamada baglanacak. Simdilik hangi test profillerinin uygulama ile daha dogal eslestigini sabitliyoruz."
            as="h2"
          />
          <div className="grid gap-4 md:grid-cols-3">
            {appPageContent.segmentRelevance.map((item) => (
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

      <SectionWrapper id="erken-erisim">
        <InterestEntry
          id="erken-erisim-formu"
          eyebrow={appPageContent.waitlist.eyebrow}
          title={appPageContent.waitlist.title}
          description={appPageContent.waitlist.description}
          deliverables={appPageContent.waitlist.deliverables}
          whyNow={appPageContent.waitlist.whyNow}
          delayCost={appPageContent.waitlist.delayCost}
          buttonLabel={appPageContent.waitlist.buttonLabel}
          successMessage={appPageContent.waitlist.successMessage}
          helperText={appPageContent.waitlist.helperText}
          inputPlaceholder={appPageContent.waitlist.inputPlaceholder}
          submitEventName={appPageContent.waitlist.submitEventName}
          submitEventPayload={appPageContent.waitlist.submitEventPayload}
        />
      </SectionWrapper>
    </>
  );
}
