export type NavigationItem = {
  href: string;
  label: string;
};

export type HeroCommand = {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
};

export type PageSection = {
  eyebrow: string;
  title: string;
  description: string;
  command?: HeroCommand;
};

export type HighlightCard = {
  title: string;
  description: string;
  href: string;
};

export const siteNavigation: NavigationItem[] = [
  { href: "/", label: "Ana Sayfa" },
  { href: "/sistem", label: "Sistem" },
  { href: "/test", label: "Test" },
  { href: "/yazilar", label: "Yazilar" },
  { href: "/kitap", label: "Kitap" },
  { href: "/uygulama", label: "Uygulama" },
];

export const homeHero = {
  eyebrow: "Bilim ve Fitness",
  title: "Bilimsel fitness icin sakin, premium ve yon veren merkez.",
  description:
    "Bilim ve Fitness; icerik, test, kitap ve gelecekteki uygulama katmanlarini tek bir sistem altinda toplayan modern fitness ekosistemidir.",
  primaryCommand: { href: "/test", label: "Testi Başlat", tone: "primary" as const },
  secondaryCommand: { href: "/sistem", label: "Sistemi Anla", tone: "secondary" as const },
};

export const homepageSections: PageSection[] = [
  {
    eyebrow: "Konumlandırma",
    title: "Gurultulu fitness tavsiyelerini net bir sisteme donusturur.",
    description:
      "Site, motivasyon odakli tavsiye akisina karsi bilimsel netlik, yapi ve uzun vadeli donusum uzerinde durur.",
    command: { href: "/sistem", label: "Yaklaşımı İncele" },
  },
  {
    eyebrow: "Yonlendirme",
    title: "Herkese ayni seyi soylemez; once durumunu tanimlar.",
    description:
      "Test sistemi kullaniciyi seviyesine, hedeflerine ve darboagazina gore ayirarak dogru sonraki adima yonlendirir.",
    command: { href: "/test", label: "Durumunu Tanimla" },
  },
  {
    eyebrow: "Ekosistem",
    title: "Icerik, kitap ve uygulama tek bir mantigin farkli katmanlaridir.",
    description:
      "Her urun ayni metodolojiyi uygular: icerik dikkat ceker, test yon verir, kitap temel kurar, uygulama sureklilik saglar.",
    command: { href: "/kitap", label: "Ilk Katmani Gor" },
  },
];

export const homepageCards: HighlightCard[] = [
  {
    title: "Sistem Sayfası",
    description: "Bilim ve Fitness metodolojisinin kavramsal omurgasi.",
    href: "/sistem",
  },
  {
    title: "Test Motoru",
    description: "Kullaniciyi siniflandirmaz; kisisel bir yol uretir.",
    href: "/test",
  },
  {
    title: "Yazilar",
    description: "SEO ve otorite icin calisan icerik katmani.",
    href: "/yazilar",
  },
];

export const systemSections: PageSection[] = [
  {
    eyebrow: "Tez",
    title: "Fitness basarisi daha fazla icerikle degil, dogru sistemle gelir.",
    description:
      "Bilim ve Fitness, bilgiyi parcali tavsiyeler yerine karar verebilen bir cerceve halinde sunar.",
    command: { href: "/test", label: "Baslangic Noktani Bul" },
  },
  {
    eyebrow: "Ilkeler",
    title: "Netlik, surdurulebilirlik ve bilimsel tutarlilik ana eksendir.",
    description:
      "Sistem; gecici motivasyon, asiri karmasa ve rastgele program mantigini reddeder. Her adim olculebilir ilerleme icin tasarlanir.",
  },
  {
    eyebrow: "Katmanlar",
    title: "Icerik farkindalik yaratir, test yon verir, urunler uygulamayi tasir.",
    description:
      "Bu yapi siteyi basit bir tanitim alani olmaktan cikarir ve kullaniciyi dogru cozum katmanina iter.",
    command: { href: "/kitap", label: "Dogru Araci Gor" },
  },
];

export const testSections: PageSection[] = [
  {
    eyebrow: "Giriş",
    title: "Genel tavsiye yerine kisisel rota uretmek icin tasarlandi.",
    description:
      "Test; hedef, seviye, engel ve readiness sinyallerini toplayarak kullaniciya net bir sonraki adim sunar.",
  },
  {
    eyebrow: "Cikti",
    title: "Sonuc; icgoru, plan, oneri ve sonraki adimdan olusur.",
    description:
      "Son ekran yalnizca puan gostermez; kullaniciyi e-posta, urun veya icerik icinde dogru hatta tasir.",
    command: { href: "/uygulama", label: "Sureklilik Katmanini Gor" },
  },
];

export const articlePreview = {
  eyebrow: "Icerik Motoru",
  title: "Her yazi, dar bir soruyu cozerken genis sisteme baglanir.",
  description:
    "Yazilar; arama niyetini yakalar, bilimsel aciklama sunar ve kullaniciyi test ya da sistem sayfasina tasir.",
};

export const productSections = {
  book: [
    {
      eyebrow: "Temel Katman",
      title: "Kitap, daginik bilgiyi tasinabilir bir sisteme donusturur.",
      description:
        "Ilk satin alma katmani olarak dusuk surtunme sunar ve kullaniciyi daha disiplinli bir yolculuga hazirlar.",
      command: { href: "/test", label: "Once Uygunlugunu Gor" },
    },
  ],
  app: [
    {
      eyebrow: "Sureklilik Katmani",
      title: "Uygulama, yontemi gunluk tekrar ve ilerleme sistemine cevirir.",
      description:
        "Gelecekteki uygulama alani; retention, aliskanlik takibi ve sistem ici tekrar kullanim icin tasarlanir.",
      command: { href: "/test", label: "Ihtiyacini Tanimla" },
    },
  ],
};
