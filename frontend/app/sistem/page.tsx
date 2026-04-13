import { CtaCluster } from "@/components/ui/cta-cluster";
import { HeadingSystem } from "@/components/ui/heading-system";
import { RouteBlock } from "@/components/ui/route-block";
import { SectionWrapper } from "@/components/ui/section-wrapper";
import { SystemLayerCard } from "@/components/ui/system-layer-card";
import { buildMetadata } from "@/lib/metadata";

export const metadata = buildMetadata({
  title: "Sistem",
  description:
    "Bilim ve Fitness sistem sayfasi; markanin kanonik sayfasi olarak metodolojiyi sabitleyen ve kullaniciyi test ile ileri iten merkezi otorite merkezidir.",
  path: "/sistem",
  keywords: [
    "fitness sistemi",
    "bilimsel fitness sistemi",
    "antrenman mantigi",
    "fitness metodolojisi",
  ],
});

export default function SystemPage() {
  return (
    <>
      <SectionWrapper className="border-none">
        <div className="grid gap-8 rounded-[2.5rem] border border-line/10 bg-white/74 px-6 py-14 shadow-panel sm:px-9 lg:grid-cols-[1.2fr,0.8fr] lg:px-14 lg:py-18">
          <HeadingSystem
            eyebrow="Sistem Omurgasi"
            title="Bilim ve Fitness, fitnessi bilgi yiginindan cikarip isleyen bir sisteme cevirir."
            description="Bu sayfa markanin merkezidir. Icerik, test, kitap ve uygulama ayni omurgaya baglidir: once tani, sonra rota, sonra arac."
            as="h1"
          >
            <CtaCluster
              primary={{ href: "/test", label: "Durumunu Tanimla" }}
              secondary={{ href: "/kitap", label: "Ilk Katmana Gec", tone: "secondary" }}
              hint="Bu sistemi kabul ediyorsan bir sonraki is okumak degil, yerini gormektir."
            />
          </HeadingSystem>
          <div className="rounded-[2rem] border border-line/10 bg-ink p-7 text-white">
            <p className="text-xs uppercase tracking-[0.22em] text-white/56">Merkezi iddia</p>
            <p className="mt-4 font-display text-3xl leading-tight">
              Fitness sorunlari cogu zaman irade degil, tani eksikligidir.
            </p>
            <p className="mt-5 text-sm leading-7 text-white/72">
              Bu yuzden sistem once durumu tanimlar. Ardindan icerik, urun ve sureklilik
              katmanini dogru sirada acar.
            </p>
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-10 lg:grid-cols-[0.95fr,1.05fr]">
          <HeadingSystem
            eyebrow="Neden Cogu Yol Bozulur"
            title="Cogu yol bozulur cunku bilgi artarken yon kaybolur."
            description="Daha cok program ve tavsiye, kullaniciya daha cok karar yuku bindirir. Sistem yoksa ilerleme gecikmeye doner."
            as="h2"
          />
          <div className="grid gap-4">
            <RouteBlock
              label="Parcali bilgi"
              title="Dogru bilgi bile yanlis sirada ise bozulur."
              description="Seviyesini bilmeden ileri cozum kopyalayan kullanici sistem kurmaz; sadece yuk toplar."
              commandLabel="Yerini Tanimla"
              href="/test"
            />
            <RouteBlock
              label="Yanlis yorum"
              title="Cogu kisi problemi degil, semptomu duzeltmeye calisir."
              description="Plato, kararsizlik veya duzensizlik genelde daha derin bir tani eksikliginin sonucudur."
              commandLabel="Teste Gec"
              href="/test"
            />
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper surface="panel">
        <div className="space-y-8 px-6 py-10 lg:px-10 lg:py-14">
          <HeadingSystem
            eyebrow="Temel Ilkeler"
            title="Sistem uc ilke uzerine kurulur."
            description="Bu ilkeler her karari yonlendirir."
            as="h2"
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <SystemLayerCard
              index="01 / Netlik"
              title="Once tani"
              description="Kullaniciya genel tavsiye verilmez. Hangi seviyede oldugu ve hangi sorunun asli darbogaz oldugu netlestirilir."
            />
            <SystemLayerCard
              index="02 / Yapi"
              title="Sonra sira"
              description="Bilgi tek basina deger uretmez. Dogru adimlar dogru sirada acilmadikca kullanici yine dagilir."
            />
            <SystemLayerCard
              index="03 / Sureklilik"
              title="En son tekrar"
              description="Sistem tek seferlik heyecan degil, tekrar eden ve ilerlemeyi koruyan bir kullanim mantigi kurar."
            />
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="space-y-8">
          <HeadingSystem
            eyebrow="Katmanlar"
            title="Her katman ayri urun degil, ayni yontemin farkli asamasidir."
            description="Bu sayfa urun vitrini degil; sistem baglantisini sabitleyen merkezdir."
            as="h2"
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <SystemLayerCard
              index="01 / Yazilar"
              title="Dikkati toplar"
              description="Dar bir soruyu aciklar ve kullaniciyi sistem mantigina yaklastirir."
            />
            <SystemLayerCard
              index="02 / Test"
              title="Durumu netlestirir"
              description="Kullaniciya hangi kapidan girmesi gerektigini soyler."
            />
            <SystemLayerCard
              index="03 / Kitap"
              title="Temeli sabitler"
              description="Guvenen ama hala daginik olan kullaniciyi sistemli bir zemine alir."
            />
            <SystemLayerCard
              index="04 / Uygulama"
              title="Sistemi tekrar ettirir"
              description="Geri donus ve gunluk kullanim katmanini olusturur."
            />
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper>
        <div className="grid gap-10 lg:grid-cols-[1fr,1fr]">
          <HeadingSystem
            eyebrow="Kimler Icin"
            title="Bu sistem, ciddiyet arayan ama daginik kalan kullanici icin tasarlandi."
            description="Amac motivasyon satmak degil; dogru sonraki adimi gostermektir."
            as="h2"
          />
          <div className="grid gap-4">
            <RouteBlock
              label="Uygun profil"
              title="Baslamak, duzene girmek veya sikistigi yeri gormek isteyenler."
              description="Sistem; baslangic, orta seviye ya da karmasa yasayan kullanicida en net sonucunu verir."
              commandLabel="Yerini Goster"
              href="/test"
            />
            <RouteBlock
              label="Uygun olmayan profil"
              title="Hizli hype ve rastgele motivasyon arayanlar."
              description="Bu site gosteri degil, yon verir. Dikkat yerine netlik isteyen kullanici icin kuruldu."
              commandLabel="Dogru Rotaya Gir"
              href="/test"
            />
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper surface="panel">
        <div className="grid gap-10 px-6 py-10 lg:grid-cols-[1fr,1fr] lg:px-10 lg:py-14">
          <HeadingSystem
            eyebrow="Siradaki Asama"
            title="Sistemi anladiktan sonra siradaki is kendi durumunu tanimlamaktir."
            description="Test; icgoru, plan, arac ve sonraki komutu ayni cikista birlestirir."
            as="h2"
          >
            <CtaCluster
              primary={{ href: "/test", label: "Teste Gec" }}
              secondary={{ href: "/kitap", label: "Ilk Katmana Gir", tone: "secondary" }}
              hint="Bu noktadan sonra beklemek sadece belirsizligi uzatir."
            />
          </HeadingSystem>
          <div className="rounded-[1.9rem] border border-line/10 bg-white/82 p-8">
            <p className="text-xs uppercase tracking-[0.22em] text-ink/48">Test cikisi</p>
            <ul className="mt-5 space-y-3 text-sm leading-7 text-ink/68">
              <li>Asil problem yeniden adlandirilir.</li>
              <li>Ilk odak netlesir.</li>
              <li>Dogru katman acilir.</li>
              <li>Momentum korunur.</li>
            </ul>
          </div>
        </div>
      </SectionWrapper>

      <SectionWrapper className="border-b border-line/10">
        <div className="rounded-[2.25rem] bg-ink px-6 py-14 text-white sm:px-10 lg:px-14">
          <HeadingSystem
            eyebrow="Son Karar"
            title="Bekleme. Baslangic katmanini simdi dogrula."
            description="Bu sayfanin isi ikna etmek degil, karari kapatmaktir."
            as="h2"
            tone="light"
          >
            <CtaCluster
              primary={{ href: "/test", label: "Testi Ac", tone: "primary" }}
              secondary={{ href: "/kitap", label: "Ilk Katmana Gec", tone: "secondary" }}
              hint="Once tani. Sonra rota."
              tone="light"
            />
          </HeadingSystem>
        </div>
      </SectionWrapper>
    </>
  );
}
