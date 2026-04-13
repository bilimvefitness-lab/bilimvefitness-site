import { TestEngine } from "@/components/test/test-engine";
import { HeadingSystem } from "@/components/ui/heading-system";
import { SectionWrapper } from "@/components/ui/section-wrapper";
import { SystemLayerCard } from "@/components/ui/system-layer-card";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Test",
  description:
    "Bilim ve Fitness test sayfasi; kullanicinin hedefini, seviyesini, ritmini ve darbogazini yorumlayip kisisel rota ureten ilk gercek test motorunu sunar.",
  path: "/test",
  keywords: [
    "fitness testi",
    "bilimsel fitness testi",
    "fitness yonlendirme testi",
    "antrenman degerlendirme",
  ],
});

export default function TestPage() {
  return (
    <>
      <SectionWrapper className="border-none">
        <div className="grid gap-8 rounded-[2.5rem] border border-line/10 bg-white/74 px-6 py-14 shadow-panel sm:px-9 lg:grid-cols-[1.05fr,0.95fr] lg:px-14 lg:py-18">
          <HeadingSystem
            eyebrow="Tani Katmani"
            title="Bu test, seni dogru baslangic noktasina yerlestirir."
            description="Bu yuzeysel bir test degil. Hedefini, seviyeni, ritmini ve darbogazini okuyup sana ait sonraki adimi aciga cikarir."
            as="h1"
          />
          <div className="rounded-[2rem] border border-line/10 bg-ink p-7 text-white">
            <p className="text-xs uppercase tracking-[0.22em] text-white/56">Tamamlama suresi</p>
            <p className="mt-4 font-display text-3xl leading-tight">Yaklasik 3 dakika.</p>
            <p className="mt-5 text-sm leading-7 text-white/72">
              Bu sure, yanlis rota uzerinde daha fazla enerji harcamamani onlemek icin ayrilir.
            </p>
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper surface="panel">
        <div className="space-y-8 px-6 py-10 lg:px-10 lg:py-14">
          <HeadingSystem
            eyebrow="Neden Simdi"
            title="En buyuk kayip, yanlis yolda hizli ilerlemektir."
            description="Bu testi ertelemek, ayni karmasayi surdurmek demek. Tamamladiginda ise sadece sonuc degil, uygulanacak rota cikacak."
            as="h2"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SystemLayerCard
              index="01 / Icgoru"
              title="Asil sorunu gorursun"
              description="Sadece hedefini degil, seni durduran esas noktayi da gorursun."
            />
            <SystemLayerCard
              index="02 / Plan"
              title="Ilk odagi alirsin"
              description="Her seyi ayni anda degil, once neyi duzeltmen gerektigi netlesir."
            />
            <SystemLayerCard
              index="03 / Rota"
              title="Dogru yola girersin"
              description="Kitap, yazi rotasi ya da sureklilik katmani uygunluga gore acilir."
            />
            <SystemLayerCard
              index="04 / Devam"
              title="Enerjiyi korursun"
              description="Sonuc, devam katmanina baglanir; sadece okunup kapanmaz."
            />
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper id="start">
        <TestEngine />
      </SectionWrapper>
    </>
  );
}
