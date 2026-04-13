import { getProductSegmentRelevance } from "@/content/personalization";
import type { ContinuationConfig } from "@/lib/continuation/types";
import type { TestSegment } from "@/lib/test/types";

type ProductHero = {
  eyebrow: string;
  title: string;
  description: string;
  panelEyebrow: string;
  panelTitle: string;
  panelDescription: string;
  primaryCommand: {
    href: string;
    label: string;
  };
  secondaryCommand?: {
    href: string;
    label: string;
  };
  hint: string;
};

type ProductSection = {
  eyebrow: string;
  title: string;
  description: string;
};

type ProductCard = {
  title: string;
  description: string;
};

type FitSection = {
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
};

type SystemRoute = {
  label: string;
  title: string;
  description: string;
  commandLabel: string;
  href: string;
};

type SegmentRelevance = {
  segment: TestSegment;
  label: string;
  title: string;
  description: string;
};

type ContinuationSection = ContinuationConfig & {
  eyebrow: string;
};

export const bookPageContent = {
  hero: {
    eyebrow: "Kitap Katmani",
    title: "Kitap, daginik bilgiyi tasinabilir bir sisteme cevirir.",
    description:
      "Bu sayfa bir urun vitrini degil. Temeli daha sakin, daha net ve daha sirali kurmak isteyen kullanici icin ilk ciddi araci tanimlar.",
    panelEyebrow: "Ana rol",
    panelTitle: "Kitap burada ilk duzen katmanidir.",
    panelDescription:
      "Sistem sayfasi cerceveyi kurar. Test seni yerine yerlestirir. Kitap ise o cerceveyi elde tutulur bir uygulama duzenine indirir.",
    primaryCommand: {
      href: "/test",
      label: "Kitap Yolunu Netlestir",
    },
    secondaryCommand: {
      href: "/sistem",
      label: "Omurgayi Oku",
    },
    hint: "Bu sayfa, kitabi herkese degil; sisteme giris katmani arayan kisilere aciklar.",
  } satisfies ProductHero,
  whatItIs: {
    eyebrow: "Bu Kitap Nedir",
    title: "Genel fitness tavsiyelerini yan yana dizmez; calisan bir siralama kurar.",
    description:
      "Kitabin rolu daha cok bilgi vermek degil, hangi bilgi ne zaman ise yarar sorusunu kapatmaktir. Boylece kullanici neyi once kuracagini ve neyi simdilik disarida birakacagini net gorur.",
  } satisfies ProductSection,
  solvedProblems: [
    {
      title: "Netlik",
      description:
        "Ne yapman gerektigi kadar, neden simdi onu yapman gerektigi de berraklasir.",
    },
    {
      title: "Yapi",
      description:
        "Hedef, antrenman ve davranis ayni mantikta toplandigi icin kararlar dagilmaz.",
    },
    {
      title: "Yon",
      description:
        "Ilk haftalarda neye odaklanacagini belirsiz birakmaz; giris hizini sakinlestirir.",
    },
  ] satisfies ProductCard[],
  gains: [
    {
      title: "Ilk siralama kapanir",
      description:
        "Hangi alanin once duzelmesi gerektigi netlestigi icin enerji yanlis yere dagilmaz.",
    },
    {
      title: "Tek kaynak hissi kurulur",
      description:
        "Parca parca tavsiyeler yerine tek omurgadan ilerlemek daha temiz karar uretir.",
    },
    {
      title: "Daha sakin uygulama baslar",
      description:
        "Hizli ama daginik denemeler yerine, tekrar edilebilir bir baslangic duzeni olusur.",
    },
    {
      title: "Sureklilige hazirlik dogar",
      description:
        "Kitap, ileride uygulama katmanina tasinacak davranis mantigini erken safhada kurar.",
    },
  ] satisfies ProductCard[],
  forYou: {
    eyebrow: "Kimler Icin",
    title: "Bu kitap, once sistemi temiz kurmak isteyenler icin dogrudur.",
    description:
      "Asagidaki profiller kitaptan en fazla faydayi alir:",
    items: [
      "Baslangicta olup neye once odaklanacagini netlestirmek isteyenler",
      "Yeniden baslarken eski karmasaya geri donmek istemeyenler",
      "Testte temel netlik veya temel kurulum profiline dusenler",
      "Daha ciddi bir sonraki adimdan once iskeleti sakinlestirmek isteyenler",
    ],
  } satisfies FitSection,
  notForYou: {
    eyebrow: "Kimler Icin Degil",
    title: "Bu sayfa herkes icin ayni cevap gibi davranmaz.",
    description:
      "Asagidaki durumlarda kitap ilk arac olmayabilir:",
    items: [
      "Sorunu temel kurulum degil, ileri seviye ince ayar olanlar",
      "Ana ihtiyaci gunluk takip ve sureklilik sistemi olanlar",
      "Performans ya da optimizasyon tarafinda daha hassas bir katman arayanlar",
      "Sadece motivasyon arayip yapisal degisim istemeyenler",
    ],
  } satisfies FitSection,
  systemRoutes: [
    {
      label: "Sistem",
      title: "Kitap, markanin teorisini pratik duzene indirir.",
      description:
        "Buradaki iddia bagimsiz degil. Kitap, /sistem sayfasinda tanimlanan mantigin elde tutulan ilk formudur.",
      commandLabel: "Sistemi Oku",
      href: "/sistem",
    },
    {
      label: "Test",
      title: "Test, bu katmanin sende ilk arac olup olmadigini dogrular.",
      description:
        "Kitap herkese ilk cevap diye acilmaz. Test sonucu, kitabin sende netlik mi kurulum mu problemi cozecegini ayirir.",
      commandLabel: "Teste Don",
      href: "/test",
    },
    {
      label: "Sureklilik",
      title: "Uygulama, kitapla kurulan mantigi gunluk tekrar katmanina tasir.",
      description:
        "Kitap bir son nokta degil; tekrar eden davranisi tasiyan daha genis sistemin ilk sakin adimidir.",
      commandLabel: "Uygulama Katmanini Gor",
      href: "/uygulama",
    },
  ] satisfies SystemRoute[],
  segmentRelevance: getProductSegmentRelevance("book") satisfies SegmentRelevance[],
  hesitation: {
    eyebrow: "Kararsizlik Katmani",
    title: "Kitap hemen acilmiyorsa rotani kaybetme.",
    description:
      "Buradan cikmadan once kitapla iliskili temel rotani kendine gonder. Boylece daha sonra geri dondugunde sifirdan dusunmezsin.",
    whyNow:
      "Kitap sana uygunsa bu genelde ilk netlik aninda gorunur. Simdi korursan geri donuste ayni yerden devam edersin.",
    delayCost:
      "Beklersen kitapla ilgili ilk kurulum gerekcen dagilir ve geri geldiginde yine sifirdan karsilastirma yaparsin.",
    deliverables: [
      "Kitap uygunluk notu",
      "Ilk kurulum odagi",
      "Geri donus noktasi",
    ],
    buttonLabel: "Rotami Koru",
    successMessage:
      "Kitap rotasi kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
    helperText:
      "Bu alan bulten icin degil; kitap katmanina ne zaman donecegini ve neden dondugunu kaybetmemen icin hazirlandi.",
    inputPlaceholder: "Kitap rotani gonderecegimiz e-posta",
  } satisfies ContinuationSection,
  finalCta: {
    title: "Kitap dogruysa, bir sonraki mantikli katman budur.",
    description:
      "Eger ihtiyacin daha fazla girdi degil daha temiz bir kurulumsa, rotani simdi netlestir. Daginik baslangic sonra daha pahaliya mal olur.",
    command: {
      href: "/test",
      label: "Kitap Yolunu Simdi Netlestir",
    },
  },
};

export const appPageContent = {
  hero: {
    eyebrow: "Sureklilik Katmani",
    title: "Uygulama, sistemi gunluk uygulamaya indirir. Ilk erisim sirasi sinirlidir.",
    description:
      "Bu rota bagimsiz bir uygulama tanitimi degil. Karar, takip ve tekrar katmaninin neden var oldugunu aciklarken ilk kullanicilar icin kontrollu bir erken erisim cagrisi da kurar.",
    panelEyebrow: "Henuz tam acik degil",
    panelTitle: "Uygulama katmani once ilk kullanicilarla acilacak.",
    panelDescription:
      "Test seni tanir. Kitap temeli kurar. Uygulama ise gunluk tekrar, geri donus ve davranis surekliligini tasir. Bu katman herkese ayni anda acilmayacak.",
    primaryCommand: {
      href: "/uygulama#erken-erisim",
      label: "Erken Erisim Yerini Koru",
    },
    secondaryCommand: {
      href: "/test",
      label: "Uygunlugunu Dogrula",
    },
    hint: "Ilk kullanicilar, bu katmana herkesten once girip sureklilik hattini erken kuracak.",
  } satisfies ProductHero,
  whatItDoes: [
    {
      title: "Karar destegi",
      description:
        "Gunluk akista neye odaklanacagini sade tutar; her gun yeniden karar vermek zorunda birakmaz.",
    },
    {
      title: "Takip",
      description:
        "Davranis ve tekrar ritmini gorunur hale getirir; kopuslar sessizce buyumez.",
    },
    {
      title: "Yonlendirme",
      description:
        "Sadece veri toplamaz; veri uzerinden bir sonraki mantikli duzeltmeyi isaret eder.",
    },
  ] satisfies ProductCard[],
  whyItExists: {
    eyebrow: "Neden Var",
    title: "Bilgi ile davranis arasindaki kopuyu kapatmak icin var.",
    description:
      "Bir sistemi okumak ile onu her gun surdurmek ayni sey degildir. Uygulama katmani, tam bu araliga girer: unutulan kararlari geri cagirir, ritmi takip eder ve dagilmayi gorunur hale getirir.",
  } satisfies ProductSection,
  futurePositioning: [
    {
      title: "Gunluk tekrar katmani",
      description:
        "Asil deger, davranisi her gun yeniden baslatmak yerine ayni yol uzerinde tutmaktir.",
    },
    {
      title: "Ilk kullanicilarla sertlesecek",
      description:
        "Uygulama buyudukce kitap, test ve gelecekteki diger katmanlarla birlikte calisacak sekilde ilk kullanim desenleriyle sertlesecek.",
    },
    {
      title: "Olculu gelisim",
      description:
        "Burada olmayan ozellikler vaat edilmez. Yalnizca sistemin gerektirdigi katmanlar eklenir.",
    },
  ] satisfies ProductCard[],
  forYou: {
    eyebrow: "Kimler Icin",
    title: "Uygulama, bilgiyi hatirlamak degil uygulamak isteyenler icindir.",
    description:
      "Ozellikle su profiller icin anlamli hale gelir:",
    items: [
      "Ritmi tekrar tekrar kaybeden ve geri donus yolunu sabit tutmak isteyenler",
      "Performans veya optimizasyon tarafinda gunluk takip duzeni arayanlar",
      "Testte sureklilik, performans hassasiyeti ya da ileri seviye optimizasyon profiline dusenler",
      "Kitapla ya da sistemle kurulan mantigi gunluk davranisa indirmek isteyenler",
    ],
  } satisfies FitSection,
  systemRoutes: [
    {
      label: "Sistem",
      title: "Uygulama, omurgayi tekrar eden davranisa baglar.",
      description:
        "/sistem sayfasinda kurulan mantik uygulamada her gun yeniden aktif hale gelir.",
      commandLabel: "Omurgayi Oku",
      href: "/sistem",
    },
    {
      label: "Test",
      title: "Test, uygulamanin sende erkenden mi yoksa sonra mi acilmasi gerektigini ayirir.",
      description:
        "Uygulama ilk cevap olmak zorunda degildir. Bazen once netlik, bazen once kurulum gerekir.",
      commandLabel: "Teste Don",
      href: "/test",
    },
    {
      label: "Kitap",
      title: "Kitap temel kurarsa, uygulama o temeli gunde tutar.",
      description:
        "Uygulama bilgi deposu gibi degil; daha once kurulan mantigi kalici davranisa cevirmek icin gelir.",
      commandLabel: "Kitap Katmanini Gor",
      href: "/kitap",
    },
  ] satisfies SystemRoute[],
  segmentRelevance: getProductSegmentRelevance("app") satisfies SegmentRelevance[],
  waitlist: {
    eyebrow: "Erken Erisim",
    title: "Erken erisim acildiginda disarida kalma.",
    description:
      "Buraya e-postani birakirsan bir haber bultenine yazilmis olmazsin. Ilk acilis notunu, sana uygun kullanim profilini ve kontrollu erken erisim sirani korursun.",
    whyNow:
      "Bu katman tam acildiginda yeniden dusunmek zorunda kalmamak icin yerini simdi koruman gerekir.",
    delayCost:
      "Beklersen ilk kullanim dalgasi acildiginda baglami yeniden kurman ve sisteme daha gec girmen gerekebilir.",
    deliverables: [
      "Erken erisim sirasi",
      "Ilk kullanim cercevesi",
      "Sana uygun oldugunda oncelikli haber",
    ],
    buttonLabel: "Sirami Koru",
    successMessage:
      "Erken erisim yerin kaydedildi. Gercek gonderim baglantisi sonraki asamada eklenecek.",
    helperText:
      "Bu alan haber bulteni icin degil; uygulama katmani acildiginda baglamini kaybetmeden geri donmen icin hazirlandi.",
    inputPlaceholder: "Erken erisim sirani gonderecegimiz e-posta",
    submitEventName: "uygulama_waitlist_click",
    submitEventPayload: {
      location: "uygulama_waitlist_form",
    },
  } satisfies ContinuationSection,
};
