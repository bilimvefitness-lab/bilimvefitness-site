import { getClusterDefinition } from "@/content/articles";
import type { ContinuationConfig, RouteRecommendation } from "@/lib/continuation/types";
import type { RecommendationPath, TestSegment } from "@/lib/test/types";

type ProductSurface = RecommendationPath;

type SegmentBaseConnection = {
  segmentLabel: string;
  productSurface: ProductSurface;
  productRelevance: {
    label: string;
    title: string;
    description: string;
  };
  recommendation: {
    path: RecommendationPath;
    title: string;
    description: string;
  };
  nextStep: {
    title: string;
    label: string;
    href: string;
    support: string;
  };
  supportingRoute?: RouteRecommendation;
  continuation: ContinuationConfig;
};

function buildClusterRoute(clusterKey: string) {
  return `/yazilar#${clusterKey}`;
}

const segmentConnections: Record<TestSegment, SegmentBaseConnection> = {
  foundation_clarity: {
    segmentLabel: "Temel netlik profili",
    productSurface: "book",
    productRelevance: {
      label: "Temel netlik profili",
      title: "Odak daginiksa kitap ilk siralamayi toplar.",
      description:
        "Bu profilde daha fazla taktik degil, hangi katmanin once gelecegini sabitleyen temiz bir kurulum gerekir.",
    },
    recommendation: {
      path: "book",
      title: "Kitap + baslangic rotasi",
      description:
        "Bu profilde ilk arac daha sert baski degil; daginik baslangici tek bir omurgada toplayan kitap katmanidir.",
    },
    nextStep: {
      title: "Ilk kurulum katmanini ac.",
      label: "Kitap Katmanina Gec",
      href: "/kitap",
      support:
        "Temel kararlarini tek bir yapida toplarsan gereksiz girdi trafigi durur ve ilk ritim sakinlesir.",
    },
    supportingRoute: {
      label: "Baslangic Okuma Rotasi",
      title: "Temel ritmi kuran yazilarla once zihni temizle.",
      description:
        "Aliskanliklar ve sureklilik cluster'i, baslangic karmasasini azaltan kisa ama kullanilabilir yazilari toplar.",
      href: buildClusterRoute("habits_consistency"),
      commandLabel: "Baslangic Yazilarini Ac",
    },
    continuation: {
      title: "Temel rotani kendine gonder.",
      description:
        "Bu sonucu kaydedersen kitap katmanina gecerken ilk siralamani, ana odagini ve geri donus notunu kaybetmezsin.",
      whyNow:
        "Bu netlik en guclu halini tam sonucu gordugun anda tasir. Simdi korursan dogru katmana dagilmadan gecersin.",
      delayCost:
        "Beklersen hangi bilgiyi once kapatman gerektigi yine bulanir ve ayni daginik girise donersin.",
      deliverables: [
        "Temel netlik ozeti",
        "Ilk odak sirasi",
        "Kitap gecis notu",
      ],
      buttonLabel: "Rotami Koru",
      successMessage:
        "Temel rota kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
      helperText:
        "Bu alan bulten icin degil; ilk kurulum sirani kitap katmanina gecerken elde tutman icin hazirlandi.",
      inputPlaceholder: "Temel rotani gonderecegimiz e-posta",
    },
  },
  foundation_action: {
    segmentLabel: "Temel kurulum profili",
    productSurface: "book",
    productRelevance: {
      label: "Temel kurulum profili",
      title: "Baslangic istegi varsa kitap duzeni erken kurar.",
      description:
        "Istek vardir ama ilk kurulum dagilmaya aciktir. Kitap bu profilde hizdan once iskeleti korur.",
    },
    recommendation: {
      path: "book",
      title: "Kitap katmani",
      description:
        "Burada yeni bilgi toplamak degil, ilk haftalari dagitmayan net bir kurulum mantigi gerekiyor.",
    },
    nextStep: {
      title: "Temeli tek yerde kur.",
      label: "Kitap Katmanina Gec",
      href: "/kitap",
      support:
        "Bu profil icin en mantikli ilk hamle, daginik girisi tek kaynak uzerinden toplamak.",
    },
    continuation: {
      title: "Kurulum yolunu kendine gonder.",
      description:
        "Rotayi kaydedersen kitap katmanina gectiginde ilk odagini, kurulum gerekcesini ve baslangic notunu ayni yerde tutarsin.",
      whyNow:
        "Baslangic enerjisi simdi yuksek. Bu ani duzgun kuruluma baglarsan ilk hafta dagilmaz.",
      delayCost:
        "Beklersen hizli baslama istegi eski karmasaya doner ve yine cok seyi ayni anda kurmaya calisirsin.",
      deliverables: [
        "Kurulum ozeti",
        "Ilk hafta odagi",
        "Kitap gecis gerekcesi",
      ],
      buttonLabel: "Kurulumumu Koru",
      successMessage:
        "Kurulum yolu kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
      helperText:
        "Bu alan bulten icin degil; kurulum enerjisini kitap katmanina tasirken dagilmamani saglamak icin hazirlandi.",
      inputPlaceholder: "Kurulum yolunu gonderecegimiz e-posta",
    },
  },
  consistency_reset: {
    segmentLabel: "Ritim reset profili",
    productSurface: "app",
    productRelevance: {
      label: "Ritim reset profili",
      title: "Ana risk kopussa sureklilik katmani anlam kazanir.",
      description:
        "Bu profilde sorun daha fazla bilgi degil, duzeni tekrar tekrar geri cagiracak gunluk katmanin eksigidir.",
    },
    recommendation: {
      path: "app",
      title: "Sureklilik + geri donus yolu",
      description:
        "Ritim kaybiyla giden profilde ilk kazanc, kopus aninda geri donecegin hattin sabitlenmesidir. Uygulama katmani bunun icin anlam kazanir.",
    },
    nextStep: {
      title: "Ritmi simdi koru.",
      label: "Ritmi Kaydet",
      href: "#email-capture",
      support:
        "Bu profil icin ilk hamle yeni bilgi degil, kopus aninda ayni noktaya donecegin rotayi sabitlemek.",
    },
    supportingRoute: {
      label: "Sureklilik Katmani",
      title: "Ritmin neden uygulama katmanina baglandigini gor.",
      description:
        "Uygulama sayfasi, tekrar, takip ve geri donus mantiginin bu profilde neden kritik oldugunu aciklar.",
      href: "/uygulama#erken-erisim",
      commandLabel: "Uygulama Katmanini Gor",
    },
    continuation: {
      title: "Ritim planini kendine gonder.",
      description:
        "Bu sonucu kaydedersen kopus aninda geri donecegin ritim notunu, ilk davranis onceligini ve uygulama baglantisini ayni yerde tutarsin.",
      whyNow:
        "Ritim problemi bekledikce degil, geri donus yolu simdi sabitlenince yumusar.",
      delayCost:
        "Beklersen bir sonraki kopusta yine nereden donecegini arar ve ayni basa donersin.",
      deliverables: [
        "Ritim reset ozeti",
        "Ilk davranis onceligi",
        "Uygulama gecis notu",
      ],
      buttonLabel: "Ritmi Bana Gonder",
      successMessage:
        "Ritim plani kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
      helperText:
        "Bu alan bulten icin degil; kopus aninda ayni rotaya hizli donmen icin hazirlandi.",
      inputPlaceholder: "Ritim planini gonderecegimiz e-posta",
    },
  },
  plateau_breakthrough: {
    segmentLabel: "Plato kirma profili",
    productSurface: "content_email",
    productRelevance: {
      label: "Plato kirma profili",
      title: "Tikaniyorsan once sorunu ayiran derin bir rota gerekir.",
      description:
        "Bu profil bazen kitapla netlesir, bazen yazi ve test hattinda daha derin ayrim ister. Ilk is tikanan degiskeni ayirmaktir.",
    },
    recommendation: {
      path: "content_email",
      title: "Derin yorum rotasi",
      description:
        "Burada ana ihtiyac yeni hacim degil; tikanan degiskeni ayirip daha temiz bir karar hattina gecmek.",
    },
    nextStep: {
      title: "Derin yazilarla sorunu ayir.",
      label: "Plato Yazilarini Ac",
      href: buildClusterRoute("performance_optimization"),
      support:
        "Bu profilde ilk kazanc, hangi degiskenin seni durdurdugunu daha temiz ayirmaktir. Ileri cluster bunu hizlandirir.",
    },
    supportingRoute: {
      label: "Temel Kontrol",
      title: "Tikandigin yer temelden geliyorsa kitap katmani once acilabilir.",
      description:
        "Bazen plateau ileri seviye detay degil, alt katman kararlarinin daginikligidir.",
      href: "/kitap",
      commandLabel: "Kitap Katmanina Bak",
    },
    continuation: {
      title: "Plato rotani kendine gonder.",
      description:
        "Bu sonucu kaydedersen hangi degiskeni once ayiracagini, ilk mudahale hattini ve daha derin rota notunu kaybetmezsin.",
      whyNow:
        "Plato yorumlari en cok ilk fark ettigin anda degerlidir. Sorunu simdi ayirirsan gereksiz mudahaleyi kesersin.",
      delayCost:
        "Beklersen rahatsizligi yeniden yuk ekleyerek kapatma egilimin guclenir ve asil sorun saklanir.",
      deliverables: [
        "Plato ozeti",
        "Ilk mudahale alani",
        "Derin rota notu",
      ],
      buttonLabel: "Platoyu Koru",
      successMessage:
        "Plato rotasi kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
      helperText:
        "Bu alan bulten icin degil; plato yorumunu daha sonra ayni netlikle acabilmen icin hazirlandi.",
      inputPlaceholder: "Plato rotani gonderecegimiz e-posta",
    },
  },
  performance_precision: {
    segmentLabel: "Performans hassasiyet profili",
    productSurface: "app",
    productRelevance: {
      label: "Performans hassasiyet profili",
      title: "Ince ayar icin tekrar ve sinyal takibi gerekir.",
      description:
        "Performans hedefi sabitse, gunluk sinyal ve takip katmani daha anlamli hale gelir.",
    },
    recommendation: {
      path: "app",
      title: "Sureklilik katmani",
      description:
        "Bu profilde kazanci buyuten sey daha sert baski degil; sinyali duzenli okuyup karari tekrar edilebilir tutan katmandir.",
    },
    nextStep: {
      title: "Performans icin sureklilik katmanini ac.",
      label: "Uygulama Katmanini Gor",
      href: "/uygulama#erken-erisim",
      support:
        "Performans hassasiyeti, gunluk tekrar ve sinyal takibiyle guclenir. Uygulama katmani tam burada anlam kazanir.",
    },
    supportingRoute: {
      label: "Derin Okuma",
      title: "Optimizasyon cluster'i ile sinyal tarafini daha derin temizle.",
      description:
        "Performans ve optimizasyon yazilari, yuk, toparlanma ve ince ayar mantigini ayni hat uzerinde toplar.",
      href: buildClusterRoute("performance_optimization"),
      commandLabel: "Optimizasyon Yazilarini Ac",
    },
    continuation: {
      title: "Performans yolunu kendine gonder.",
      description:
        "Bu sonucu kaydedersen ilk optimizasyon odagini, uygulama baglantisini ve sonraki sinyal notunu ayni yerde tutarsin.",
      whyNow:
        "Sinyal temizligi, karar sicakken en kolay kurulur. Simdi sabitlersen ince ayar dagilmaz.",
      delayCost:
        "Beklersen daha cok uyaran ekleyip hangi degiskenin ise yaradigini yine bulaniklastirabilirsin.",
      deliverables: [
        "Performans ozeti",
        "Ilk sinyal odagi",
        "Uygulama baglantisi",
      ],
      buttonLabel: "Performansi Koru",
      successMessage:
        "Performans rotasi kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
      helperText:
        "Bu alan bulten icin degil; performans odagini ileride ayni sinyal disipliniyle acabilmen icin hazirlandi.",
      inputPlaceholder: "Performans yolunu gonderecegimiz e-posta",
    },
  },
  advanced_optimization: {
    segmentLabel: "Ileri seviye optimizasyon profili",
    productSurface: "app",
    productRelevance: {
      label: "Ileri seviye optimizasyon profili",
      title: "Bu seviyede en buyuk kayip, netligi koruyacak takip katmaninin olmamasi.",
      description:
        "Temel kuruluysa takip, ritim ve sinyal katmani daha yuksek deger uretir.",
    },
    recommendation: {
      path: "app",
      title: "Sureklilik katmani",
      description:
        "Ileri seviye profilde ana kazanc yeni temel kurulum degil; calisan yapinin sinyal ve tekrar kalitesini korumak.",
    },
    nextStep: {
      title: "Ileri seviye takip katmanini ac.",
      label: "Uygulama Katmanini Gor",
      href: "/uygulama#erken-erisim",
      support:
        "Bu seviyede en buyuk kayip, karari dagitip takibi gevsetmek olur. Uygulama katmani bu boslugu kapatir.",
    },
    supportingRoute: {
      label: "Optimizasyon Rotasi",
      title: "Ileri seviye yazilarla sinyal ve karar kalitesini derinlestir.",
      description:
        "Optimizasyon cluster'i, yuksek seviyede hangi degiskenin once okunmasi gerektigini daha net ayirir.",
      href: buildClusterRoute("performance_optimization"),
      commandLabel: "Optimizasyon Yazilarini Ac",
    },
    continuation: {
      title: "Ileri seviye rotani kendine gonder.",
      description:
        "Bu sonucu kaydedersen ana optimizasyon odagini, uygulama baglantisini ve sureklilik notunu kaybetmezsin.",
      whyNow:
        "Bu seviyede kayip buyuk hatadan degil, kucuk dagilmalardan gelir. Rotayi simdi korursan hassasiyet dusmez.",
      delayCost:
        "Beklersen calisan yapiyi yeni uyaranlarla gereksiz yere karistirabilir ve karar kalitesini gevsetebilirsin.",
      deliverables: [
        "Optimizasyon ozeti",
        "Oncelikli sinyal",
        "Sureklilik notu",
      ],
      buttonLabel: "Rotami Koru",
      successMessage:
        "Ileri seviye rota kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
      helperText:
        "Bu alan bulten icin degil; yuksek seviye kararlari dagilmadan sonra ayni netlikle acabilmen icin hazirlandi.",
      inputPlaceholder: "Ileri seviye rotani gonderecegimiz e-posta",
    },
  },
};

export function getSegmentConnection(segment: TestSegment) {
  return segmentConnections[segment];
}

export function getProductSegmentRelevance(surface: "book" | "app") {
  return (Object.entries(segmentConnections) as [TestSegment, SegmentBaseConnection][])
    .filter(([, connection]) => connection.productSurface === surface)
    .map(([segment, connection]) => ({
      segment,
      label: connection.productRelevance.label,
      title: connection.productRelevance.title,
      description: connection.productRelevance.description,
    }));
}

export function getSegmentContentCluster(segment: TestSegment) {
  const route = segmentConnections[segment].supportingRoute;

  if (route) {
    return route;
  }

  const fallbackCluster =
    segment === "foundation_clarity" || segment === "foundation_action"
      ? "habits_consistency"
      : segment === "consistency_reset"
        ? "habits_consistency"
        : "performance_optimization";
  const cluster = getClusterDefinition(fallbackCluster);

  return {
    label: cluster?.label ?? "Yazi Rotasi",
    title: `${cluster?.label ?? "Ilgili"} yazilari ile devam et.`,
    description:
      "Bu cluster, test sonucundan sonra dar soruyu daha sistemli sekilde acmana yardim eder.",
    href: buildClusterRoute(fallbackCluster),
    commandLabel: "Ilgili Yazilari Ac",
  } satisfies RouteRecommendation;
}
