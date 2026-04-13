import { CtaCluster } from "@/components/ui/cta-cluster";
import { HeadingSystem } from "@/components/ui/heading-system";
import { SectionWrapper } from "@/components/ui/section-wrapper";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Sayfa Bulunamadi",
  description:
    "Bilim ve Fitness icinde aradigin rota bulunamadi. Tani katmanina ya da yazi omurgasina geri donerek dogru akisa gecebilirsin.",
  path: "/not-found",
  noIndex: true,
});

export default function NotFoundPage() {
  return (
    <SectionWrapper className="border-none">
      <div className="rounded-[2.5rem] border border-line/10 bg-white/82 px-6 py-16 shadow-panel sm:px-10 lg:px-14 lg:py-20">
        <HeadingSystem
          eyebrow="Bulunamadi"
          title="Aradigin sayfa bu rotada yer almiyor."
          description="Yanlis veya eski bir baglantiya gelmis olabilirsin. Dogru giris icin ya tani katmanina don ya da bilgi omurgasindan ilerle."
          as="h1"
        >
          <CtaCluster
            primary={{ href: "/test", label: "Teste Gir" }}
            secondary={{ href: "/yazilar", label: "Yazilara Don", tone: "secondary" }}
            hint="Boslukta kalma. Tek sonraki adimi sec."
          />
        </HeadingSystem>
      </div>
    </SectionWrapper>
  );
}
