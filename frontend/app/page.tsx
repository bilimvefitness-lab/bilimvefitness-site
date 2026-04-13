import { CtaCluster } from "@/components/ui/cta-cluster";
import { HeadingSystem } from "@/components/ui/heading-system";
import { RouteBlock } from "@/components/ui/route-block";
import { SectionWrapper } from "@/components/ui/section-wrapper";
import { SystemLayerCard } from "@/components/ui/system-layer-card";
import { TrustBlock } from "@/components/ui/trust-block";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Bilimsel Fitness Ekosistemi",
  description:
    "Bilim ve Fitness ana sayfasi; markayi net tanimlayan, siradan fitness algisini kiran ve kullaniciyi dogrudan test akisina iten kontrollu giris merkezidir.",
  path: "/",
  keywords: [
    "bilimsel fitness",
    "fitness ekosistemi",
    "fitness testi",
    "fitness sistemi",
  ],
});

export default function HomePage() {
  return (
    <>
      <SectionWrapper className="border-none">
        <div className="surface-grid grid gap-8 rounded-[2.5rem] border border-line/10 bg-white/72 px-6 py-14 shadow-panel sm:px-9 lg:grid-cols-[1.35fr,0.78fr] lg:px-14 lg:py-18">
          <HeadingSystem
            eyebrow="Bilim ve Fitness"
            title="Bilimsel fitness icin kurulan net yon merkezi."
            description="Bu marka yalnizca fitness icerigi yayinlamaz. Durumu tanimlar, sonraki adimi belirler ve tum ekosistemi ayni sistem mantiginda kurar."
            as="h1"
          >
            <CtaCluster
              primary={{ href: "/test", label: "Teste Gir" }}
              secondary={{ href: "/sistem", label: "Sistemi Oku", tone: "secondary" }}
              hint="Ilk adim tek: durumunu tanimla."
            />
          </HeadingSystem>
          <div className="rounded-[2rem] border border-line/10 bg-ink p-7 text-white">
            <p className="text-xs uppercase tracking-[0.24em] text-white/56">Ilk komut</p>
            <p className="mt-4 font-display text-3xl leading-tight">
              Siradan fitness anlatisini birak. Once yerini gor.
            </p>
            <ul className="mt-6 space-y-3 text-sm leading-7 text-white/72">
              <li>Bilgi degil, netlik onceliklenir.</li>
              <li>Test, kitap ve uygulama tek sistemde konumlanir.</li>
              <li>Karar yukunu sistem tasir.</li>
            </ul>
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-10 lg:grid-cols-[0.9fr,1.05fr]">
          <HeadingSystem
            eyebrow="Problem"
            title="Asil eksik bilgi degil, sistemdir."
            description="Ilerleme durur cunku kullanici once hangi sorunu cozmesi gerektigini bilmez."
            as="h2"
          />
          <div className="grid gap-4">
            <RouteBlock
              label="Daginik bilgi"
              title="Rastgele tavsiye ilerleme uretmez."
              description="Parca parca bilgi, uygulanabilir bir rota kurmaz. Bu yuzden hazirlik artar, hareket gecikir."
              commandLabel="Durumunu Tanimla"
              href="/test"
            />
            <RouteBlock
              label="Yanlis odak"
              title="Motivasyon aramak taniyi geciktirir."
              description="Ne yapman gerektigini bilmeden daha fazla motivasyon istemek yalnizca sureyi uzatir."
              commandLabel="Sistemi Oku"
              href="/sistem"
            />
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="space-y-8">
          <HeadingSystem
            eyebrow="Ekosistem"
            title="Icerik, test, kitap ve uygulama tek ilerleme zinciridir."
            description="Her katman farkli hazirlik seviyesine cevap verir ve bir sonrakini acar."
            as="h2"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SystemLayerCard
              index="01 / Icerik"
              title="Dikkati toplar"
              description="Arama niyetini ve ilgiyi dogru ciddiyetle karsilar."
            />
            <SystemLayerCard
              index="02 / Test"
              title="Durumu tanimlar"
              description="Hedefi, seviyeyi ve engeli tek giriste netlestirir."
            />
            <SystemLayerCard
              index="03 / Kitap"
              title="Temeli kurar"
              description="Daginik bilgiyi tasinabilir bir sisteme cevirir."
            />
            <SystemLayerCard
              index="04 / Uygulama"
              title="Surekliligi kurar"
              description="Takip ve tekrar katmanini kalici hale getirir."
            />
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper surface="panel">
        <div className="space-y-10 px-6 py-10 lg:px-10 lg:py-14">
          <HeadingSystem
            eyebrow="Yontem"
            title="Bilim ve Fitness, tavsiye vermez; sirayi kurar."
            description="Yontemin isi daha cok bilgi eklemek degil, once neyin oncelikli oldugunu belirlemektir."
            as="h2"
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <RouteBlock
              label="Netlik"
              title="Oncelik ayiklanir"
              description="Her kullaniciya ayni komut verilmez. Sistem once asli sorunu secer."
              commandLabel="Sistemi Oku"
              href="/sistem"
            />
            <RouteBlock
              label="Sadelik"
              title="Karar yuku azalir"
              description="Kullanicidan tum cozumleri karsilastirmasi beklenmez. Sonraki adim atanir."
              commandLabel="Teste Gir"
              href="/test"
            />
            <RouteBlock
              label="Sureklilik"
              title="Tekrar korunur"
              description="Sistem ilk hareketi degil, kalici ilerlemeyi hedefler."
              commandLabel="Uygulama Katmanini Gor"
              href="/uygulama"
            />
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-8 lg:grid-cols-[1.02fr,0.98fr]">
          <HeadingSystem
            eyebrow="Test"
            title="Genel tavsiye alma. Yerini dogrula."
            description="Test, hedefini ve darboagazini yorumlayip sana tek bir sonraki adim verir. Bu yuzden test ek ozellik degil, sistemin ana girisidir."
            as="h2"
          >
            <CtaCluster
              primary={{ href: "/test", label: "Teste Gir ve Ilerle" }}
              secondary={{ href: "/sistem", label: "Test Mantigini Oku", tone: "secondary" }}
              hint="Hazir hissetmek yetmez. Dogru katmanda olman gerekir."
            />
          </HeadingSystem>
          <div className="rounded-[2rem] border border-line/10 bg-white/85 p-7">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/48">Test sonucu</p>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-ink/68">
              <li>Asil darboagaz adlandirilir.</li>
              <li>Ilk odak netlesir.</li>
              <li>Dogru arac secilir.</li>
              <li>Sonraki hareket kapanir.</li>
            </ul>
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="space-y-8">
          <HeadingSystem
            eyebrow="Urun Yollari"
            title="Urunler vitrin gibi degil, durumuna gore acilan katmanlar gibi calisir."
            description="Her sey ayni anda acilmaz. Dogru anda dogru arac devreye girer."
            as="h2"
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <RouteBlock
              label="Ilk giris"
              title="Kitap, temiz ilk katmandir."
              description="Guveni olusan ama hala daginik olan kullaniciya temel kurar."
              commandLabel="Kitap Katmanina Gec"
              href="/kitap"
            />
            <RouteBlock
              label="Secim"
              title="Test, uygun araci belirler."
              description="Secim yoruma birakilmaz. Sistem uygunlugu once netlestirir."
              commandLabel="Uygunlugu Tanimla"
              href="/test"
            />
            <RouteBlock
              label="Sureklilik"
              title="Uygulama, tekrar katmanidir."
              description="Uzun vadeli kullanim mantigini gunluk ritme tasir."
              commandLabel="Uygulama Katmanini Gor"
              href="/uygulama"
            />
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper surface="panel">
        <div className="space-y-8 px-6 py-10 lg:px-10 lg:py-14">
          <HeadingSystem
            eyebrow="Guven"
            title="Bu sistem daha cok konustugu icin degil, daha net kuruldugu icin guven verir."
            description="Ton, yapi ve baglanti mantigi ayni ciddiyeti korur."
            as="h2"
          />
          <TrustBlock
            items={[
              {
                title: "Bilimsel ciddiyet",
                description: "Yontem, hype yerine acik ilke ve yorum mantigiyla kurulur.",
              },
              {
                title: "Premium sadelik",
                description: "Fazla secenek yerine kontrollu aciklik sunulur.",
              },
              {
                title: "Butun sistem",
                description: "Icerik, test, kitap ve uygulama ayni omurgadan beslenir.",
              },
            ]}
          />
        </div>
      </SectionWrapper>

      <SectionWrapper className="border-b border-line/10">
        <div className="rounded-[2.25rem] bg-ink px-6 py-14 text-white sm:px-10 lg:px-14">
          <HeadingSystem
            eyebrow="Son komut"
            title="Bekleme. Yerini simdi tanimla."
            description="Bu noktadan sonra dogru hareket tek: testi ac ve sonraki adimi netlestir."
            as="h2"
            tone="light"
          >
            <CtaCluster
              primary={{ href: "/test", label: "Testi Ac", tone: "primary" }}
              secondary={{ href: "/sistem", label: "Sistemi Oku", tone: "secondary" }}
              hint="Belirsizligi uzatma."
              tone="light"
            />
          </HeadingSystem>
        </div>
      </SectionWrapper>
    </>
  );
}
