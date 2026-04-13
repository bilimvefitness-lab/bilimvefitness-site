import type { ContinuationConfig } from "@/lib/continuation/types";

export type ArticleClusterKey =
  | "training_science"
  | "nutrition_body_composition"
  | "recovery_sleep"
  | "habits_consistency"
  | "performance_optimization"
  | "myths_clarifications";

export type ArticleIntent = "question" | "decision" | "clarification";

export type ArticleNextBestStep = "sistem" | "test" | "continuation";

export type ArticleCommand = {
  href: string;
  label: string;
};

export type ArticleRoute = {
  label: string;
  title: string;
  description: string;
  href: string;
  commandLabel: string;
};

export type AuthorityArticle = {
  title: string;
  slug: string;
  cluster: ArticleClusterKey;
  summary: string;
  intent: ArticleIntent;
  readingTime: string;
  featured?: boolean;
  continuationTarget: ArticleNextBestStep;
  opening: {
    eyebrow: string;
    title: string;
    description: string;
    answerTitle: string;
    answer: string;
  };
  clarification: {
    title: string;
    description: string;
    points: string[];
  };
  explanation: {
    title: string;
    paragraphs: string[];
  };
  practical: {
    title: string;
    description: string;
    actions: string[];
  };
  systemBridge: {
    title: string;
    description: string;
    primaryCommand: ArticleCommand;
    secondaryCommand: ArticleCommand;
  };
  stateNextStep: {
    title: string;
    description: string;
    routes: ArticleRoute[];
  };
  continuation: {
    title: string;
    description: string;
    deliverables: string[];
    buttonLabel: string;
    successMessage: string;
  };
};

export const articleClusters = [
  {
    key: "training_science",
    label: "Antrenman Bilimi",
    description:
      "Hacim, yogunluk, hareket secimi ve ilerleme mantigini gosterisiz ama net bicimde ayirir.",
  },
  {
    key: "nutrition_body_composition",
    label: "Beslenme ve Vucut Kompozisyonu",
    description:
      "Kalori, protein, agirlik degisimi ve surdurulebilir beslenme kararlarini ayni cercevede toplar.",
  },
  {
    key: "recovery_sleep",
    label: "Toparlanma ve Uyku",
    description:
      "Toparlanma sinyallerini performans ve davranis surekliligiyle birlikte yorumlar.",
  },
  {
    key: "habits_consistency",
    label: "Aliskanliklar ve Sureklilik",
    description:
      "Kopusu sadece irade sorunu gibi gormez; ritim, ortam ve karar yorgunlugu uzerinden okur.",
  },
  {
    key: "performance_optimization",
    label: "Performans ve Optimizasyon",
    description:
      "Plato, performans sinyalleri ve ileri seviye duzeltmeleri tek tek degil sistem halinde ele alir.",
  },
  {
    key: "myths_clarifications",
    label: "Fitness Mitleri ve Netlestirmeler",
    description:
      "Populer ama zayif tavsiyeleri ayirir; gosteris yerine uygulanabilir netlik sunar.",
  },
] as const satisfies {
  key: ArticleClusterKey;
  label: string;
  description: string;
}[];

export const authorityArticles: AuthorityArticle[] = [
  {
    title: "Duzen neden uc gunde bozuluyor?",
    slug: "duzen-neden-uc-gunde-bozuluyor",
    cluster: "habits_consistency",
    summary:
      "Problem genelde motivasyon eksigi degil; ilk kurulumun fazla yuklu, fazla daginik ve geri donus kuralsiz olmasidir.",
    intent: "decision",
    readingTime: "6 dk",
    featured: true,
    continuationTarget: "test",
    opening: {
      eyebrow: "Sureklilik Sorusu",
      title: "Ritmin uc gunde bozuluyorsa sorun karakter degil, kurulum olabilir.",
      description:
        "Cogu kisi duzenin bozulmasini irade zayifligi sanir. Aslinda ilk plan kaldirabileceginden buyuk kuruldugunda kopus neredeyse kacinilmaz olur.",
      answerTitle: "Kisa cevap",
      answer:
        "Duzenin erken bozulmasi, sistemin tasinabilir olmadigini gosterir. Ilk duzeltilmesi gereken sey hedefin kendisi degil, ritmi tasiyan en kucuk tekrar birimidir.",
    },
    clarification: {
      title: "Kopusu ne buyutur?",
      description:
        "Kopusu buyuten ana hatalar birbirine benzer. Sorunlar farkli gorunse de yapisal desen aynidir:",
      points: [
        "Bir anda fazla seyi degistirmek ve plana giris maliyetini yuksek tutmak",
        "Baslangic ritmini guclendirmeden sonuc beklentisini yukarida tutmak",
        "Kopustan sonra nereye donecegini belirlememis olmak",
      ],
    },
    explanation: {
      title: "Bilimsel taraf",
      paragraphs: [
        "Davranis surekliligini bozan sey, sadece disiplin eksigi degil; tekrar sinyalinin belirsiz olmasidir. Sistem her gun yeniden karar istediginde zihinsel maliyet artar ve tekrar orani duser.",
        "Bu nedenle iyi kurulan bir fitness sistemi her gun daha cok sey yapmayi degil, ayni kritik davranisi daha az surtunmeyle tekrar etmeyi hedefler. Once ritim oturur, sonra yuk artar.",
      ],
    },
    practical: {
      title: "Pratik yorum",
      description:
        "Duzenin erken dagiliyorsa ilk duzeltme daha fazla sertlik degil daha dusuk giris maliyetidir.",
      actions: [
        "Tek bir antrenman veya davranis kalibini ilk hafta boyunca sabit tut.",
        "Kopustan sonra geri donecegin minimum versiiyonunu onceden tanimla.",
        "Ilk on gunu sonuc degil tekrar sayisi ile takip et.",
      ],
    },
    systemBridge: {
      title: "Bu soru aslinda daha genis bir sistem sorusu.",
      description:
        "Sureklilik problemi tek basina aliskanlik meselesi degildir. Bilim ve Fitness sisteminde ritim; hedef, karar maliyeti ve toparlanma ile birlikte kurulur. Bu nedenle dar soru ancak daha buyuk omurga icinde tam cevap bulur.",
      primaryCommand: {
        href: "/sistem",
        label: "Omurgayi Oku",
      },
      secondaryCommand: {
        href: "/test",
        label: "Durumunu Ayir",
      },
    },
    stateNextStep: {
      title: "Siradaki adimi durumuna gore sec.",
      description:
        "Ayni yazidan cikan iki kullanicinin sonraki adimi ayni olmak zorunda degil. Asagidaki ayrim bu yuzden var:",
      routes: [
        {
          label: "Cerceve Eksigi",
          title: "Sorunun nerede basladigini daha genis sistemde gormek istiyorsan omurgaya git.",
          description:
            "Bu konu sende hep tekrar ediyorsa yalnizca taktik degil, daha buyuk kurulum mantigi eksik olabilir.",
          href: "/sistem",
          commandLabel: "Omurgayi Simdi Oku",
        },
        {
          label: "Kisisel Rota",
          title: "Bu kopusun sende tam olarak hangi profile girdigini ayirmak istiyorsan teste gec.",
          description:
            "Test, sureklilik probleminin bilgi, ritim ya da darbogaz kaynakli olup olmadigini netlestirir.",
          href: "/test",
          commandLabel: "Teste Gec",
        },
        {
          label: "Devam Katmani",
          title: "Simdi cikman gerekiyorsa rotani kaybetmeden ayril.",
          description:
            "Yazini ve ilk odagini kendine gonderirsen geri donus noktan acik kalir.",
          href: "#article-continuation",
          commandLabel: "Rotami Koru",
        },
      ],
    },
    continuation: {
      title: "Bu rotayi kendine gonder.",
      description:
        "Buraya e-postani biraktiginda bulten listesine dusmezsin. Bu yazinin ana sonucunu, ilk ritim odagini ve uygun sonraki adimi korursun.",
      deliverables: ["Yazinin kisa ozeti", "Ilk ritim odagi", "Sana uygun sonraki adim"],
      buttonLabel: "Rotami Gonder",
      successMessage:
        "Yazi rotasi kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
    },
  },
  {
    title: "Kalori acigi ne kadar olmali?",
    slug: "kalori-acigi-ne-kadar-olmali",
    cluster: "nutrition_body_composition",
    summary:
      "Kalori acigi ne kadar buyurse o kadar iyi degildir; fazla acik daha hizli degil, daha kirilgan bir surec uretir.",
    intent: "question",
    readingTime: "7 dk",
    continuationTarget: "continuation",
    opening: {
      eyebrow: "Beslenme Karari",
      title: "Kalori acigi, sonucu hizlandirmak icin degil surdurmek icin ayarlanir.",
      description:
        "Yag kaybi hedefinde en yaygin hata, acigi gereksiz buyutup performansi ve surekliligi bozmaktir.",
      answerTitle: "Kisa cevap",
      answer:
        "Iyi kalori acigi agresif gorunen degil, birkac hafta korunabilen aciktir. Hizli kayip arayisi, toparlanma ve davranis kalitesini zayiflatiyorsa sistem bozulur.",
    },
    clarification: {
      title: "Neden bu konu yanlis anlasiliyor?",
      description:
        "Kalori acigi cogu zaman matematik problemi gibi gorulur. Oysa davranis tarafi hesaba katilmadiginda tablo bozulur:",
      points: [
        "Fazla acik kisa surede daha cok yorgunluk ve terk riski uretir",
        "Antrenman kalitesi dusunce yag kaybi disindaki kayiplar da buyuyebilir",
        "Sadece tarti hizina bakmak, surecin korunabilirligini gormezden gelir",
      ],
    },
    explanation: {
      title: "Bilimsel taraf",
      paragraphs: [
        "Enerji acigi teorik olarak yag kaybi icin gerekir; ancak pratikte acigin buyuklugu tek basina iyi sonuc anlamina gelmez. Istah, yorgunluk, toparlanma ve antrenman kalitesi de denklemde yer alir.",
        "Bu nedenle vucut kompozisyonu tarafinda iyi karar, kagit ustunde maksimum acigi degil davranis ve performansla beraber tasinabilen acigi secmektir. Uzun vadede surdurulebilen strateji genelde daha iyi toplam sonuc verir.",
      ],
    },
    practical: {
      title: "Pratik yorum",
      description:
        "Dogru acik, seni her gun yeniden savas moduna sokmaz; ritmi korumana izin verir.",
      actions: [
        "Acigi sonuca degil, iki-uc haftalik korunabilirligine gore degerlendir.",
        "Agir yorgunluk ve antrenman dususu varsa once sisteme geri bak.",
        "Tarti degisimi kadar gunluk istek, uyku ve toparlanma hissini de izle.",
      ],
    },
    systemBridge: {
      title: "Bu soru sadece beslenme sorusu degil.",
      description:
        "Kalori acigi tek basina karar verdirmez. Bilim ve Fitness sisteminde beslenme karari, antrenman yuku, toparlanma ve davranis surekliligiyle birlikte kurulur. Bu yuzden net cevap daha buyuk sistemin icinde anlam kazanir.",
      primaryCommand: {
        href: "/sistem",
        label: "Beslenme Mantigini Sistemde Gor",
      },
      secondaryCommand: {
        href: "/test",
        label: "Kendi Durumunu Ayir",
      },
    },
    stateNextStep: {
      title: "Sonraki adim duruma gore degisir.",
      description:
        "Ayni kalori acigi tavsiyesi herkes icin ayni sonucu vermez. Kendi profilini asagidaki mantikla ayir:",
      routes: [
        {
          label: "Cerceve",
          title: "Yag kaybini hep sadece kalori acigi diye goruyorsan once sistemi oku.",
          description:
            "Sorunu tek degiskende aramak, daha buyuk baglanti hatalarini saklayabilir.",
          href: "/sistem",
          commandLabel: "Sistemi Oku",
        },
        {
          label: "Tani",
          title: "Acik mi, sureklilik mi, toparlanma mi sorunu buyutuyor bilmiyorsan teste gec.",
          description:
            "Test, yag kaybi hedefinde hangi darbogazin esas oldugunu daha net ayirir.",
          href: "/test",
          commandLabel: "Teste Gec",
        },
        {
          label: "Devam",
          title: "Bu karari daha sonra uygulayacaksan notu kendine gonder.",
          description:
            "Boylece yazidan ciktiktan sonra karar mantigin kaybolmaz.",
          href: "#article-continuation",
          commandLabel: "Notu Koru",
        },
      ],
    },
    continuation: {
      title: "Beslenme kararini kaybetme.",
      description:
        "Yazinin kisa sonucunu, kalori acigi icin ilk kontrol noktasini ve uygun sonraki rotayi kendine gonder.",
      deliverables: ["Kalori acigi ozeti", "Ilk kontrol noktasi", "Sonraki rota notu"],
      buttonLabel: "Notu Gonder",
      successMessage:
        "Beslenme notu kaydedildi. Gercek e-posta teslimi sonraki asamada baglanacak.",
    },
  },
  {
    title: "Uyku duzelmeden performans neden artmaz?",
    slug: "uyku-duzelmeden-performans-neden-artmaz",
    cluster: "recovery_sleep",
    summary:
      "Performans dususu her zaman program problemi degildir; uyku bozuksa yuklenme karari da dogru okunmaz.",
    intent: "question",
    readingTime: "6 dk",
    continuationTarget: "test",
    opening: {
      eyebrow: "Toparlanma Sorusu",
      title: "Uyku zayifsa performans sinyalleri gurultulu hale gelir.",
      description:
        "Bir cok kullanici performans dususunu daha az efor sanir. Oysa uyku bozuk oldugunda beden dogru sinyal vermez.",
      answerTitle: "Kisa cevap",
      answer:
        "Uyku duzelmeden performansin artmamasi normaldir. Cunku toparlanma sinyali zayifken antrenman kalitesi, algilanan efor ve tekrar kapasitesi ayni anda bozulur.",
    },
    clarification: {
      title: "Sorun neden saklanir?",
      description:
        "Uyku sorunu dogrudan gorulmeyebilir. Cogu zaman su sekillerde kendini gizler:",
      points: [
        "Programi surekli yetersiz sanmak",
        "Yuksek efor hissini performans gelisimiyle karistirmak",
        "Toparlanma dususunu motivasyon eksigi zannetmek",
      ],
    },
    explanation: {
      title: "Bilimsel taraf",
      paragraphs: [
        "Uyku; performans, toparlanma ve karar kalitesi icin temel sinyal katmanidir. Yetersiz uyku durumda antrenman verimi kadar acik hissi, stres toleransi ve tekrar kabiliyeti de etkilenir.",
        "Bu nedenle performansi yorumlarken sadece program degiskenine bakmak eksik olur. Uyku zayifsa daha fazla yuk eklemek bazen ilerleme degil birikmis yorgunlugu buyutur.",
      ],
    },
    practical: {
      title: "Pratik yorum",
      description:
        "Bu durumda ilk hamle daha sert program degil, sinyali temizleyecek toparlanma duzeltmesidir.",
      actions: [
        "Bir hafta boyunca uyku suresi ve uyandigindaki his ile antrenman hissini birlikte kaydet.",
        "Toparlanma zayifsa yuk artirmak yerine karar degiskenlerini sadelestir.",
        "Uyku duzelmeden performans yorumunu nihai karar gibi kullanma.",
      ],
    },
    systemBridge: {
      title: "Bu konu performans sisteminin icinde anlam kazanir.",
      description:
        "Bilim ve Fitness sisteminde uyku, ayrik bir wellness basligi degil; yuklenme, toparlanma ve davranis surekliligiyle ayni karar zincirinin parcasidir.",
      primaryCommand: {
        href: "/sistem",
        label: "Toparlanma Mantigini Oku",
      },
      secondaryCommand: {
        href: "/test",
        label: "Darbogazini Ayir",
      },
    },
    stateNextStep: {
      title: "Siradaki hareketin ihtiyacina gore degisir.",
      description:
        "Uyku sorunu bazen bilgi, bazen ritim, bazen de performans hassasiyeti problemi olarak gorunur:",
      routes: [
        {
          label: "Cerceve",
          title: "Uykuyu hala ikincil detay gibi goruyorsan once sistem baglantisini oku.",
          description:
            "Toparlanma, sistemde ayri bolum degil tum yuk kararlarinin sessiz belirleyicisidir.",
          href: "/sistem",
          commandLabel: "Baglantiyi Oku",
        },
        {
          label: "Tani",
          title: "Uyku mu, yuk mu, sureklilik mi seni geride tutuyor bilmiyorsan teste gec.",
          description:
            "Test, toparlanma sinyalini daha buyuk profil icinde yerlestirir.",
          href: "/test",
          commandLabel: "Teste Gec",
        },
        {
          label: "Devam",
          title: "Yorumu sonra kullanacaksan ana notlari simdi kaydet.",
          description:
            "Boylece toparlanma sinyalini tekrar gordugunde ayni noktadan devam edebilirsin.",
          href: "#article-continuation",
          commandLabel: "Notu Koru",
        },
      ],
    },
    continuation: {
      title: "Toparlanma notunu kendine gonder.",
      description:
        "Bu yazinin ozetini, ilk kontrol edecegin toparlanma sinyalini ve sana uygun sonraki adimi kendine gonder.",
      deliverables: ["Toparlanma ozeti", "Ilk kontrol sinyali", "Sonraki rota"],
      buttonLabel: "Notu Gonder",
      successMessage:
        "Toparlanma notu kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
    },
  },
  {
    title: "Antrenman hacmi ne zaman artirilmali?",
    slug: "antrenman-hacmi-ne-zaman-artirilmali",
    cluster: "training_science",
    summary:
      "Hacim, her tikanmada artirilmaz. Hareket kalitesi ve toparlanma tasimiyorsa daha cok set, daha cok ilerleme anlamina gelmez.",
    intent: "decision",
    readingTime: "7 dk",
    continuationTarget: "sistem",
    opening: {
      eyebrow: "Antrenman Karari",
      title: "Hacim artisi karar degil sonuc olmalidir.",
      description:
        "Bir cok kisi plateau gordugunde ilk refleks olarak daha fazla set ekler. Oysa hacim artisi ancak mevcut sistem tasiyorsa ise yarar.",
      answerTitle: "Kisa cevap",
      answer:
        "Hacim, tekrar kalitesi korunuyor ve toparlanma sinyalleri saglamsa artirilir. Tikanma varken otomatik hacim eklemek genelde sorunu gizler.",
    },
    clarification: {
      title: "Nerede hata yapiliyor?",
      description:
        "Hacim kararinin yanlis kullanildigi uc tipik desen vardir:",
      points: [
        "Hareket secimi zayifken daha fazla tekrar eklemek",
        "Toparlanma duzeyi dusukken yuklenmeyi buyutmek",
        "Plateau gordugunde once teshis yapmadan sadece miktari artirmak",
      ],
    },
    explanation: {
      title: "Bilimsel taraf",
      paragraphs: [
        "Hacim artisi gelisim icin guclu bir arac olabilir; ancak tek basina iyi bir arac degildir. Uyaranin kalitesi, toparlanma kapasitesi ve teknik tekrar kalitesiyle birlikte deger kazanir.",
        "Bu nedenle iyi antrenman planlamasi, hacmi varsayilan cozum olarak kullanmaz. Once hangi degiskenin tikandigini ayirir; sonra gerekiyorsa hacmi artirir.",
      ],
    },
    practical: {
      title: "Pratik yorum",
      description:
        "Hacim karari vermeden once tasiyici sinyalleri temizlemek daha dogru baslangictir.",
      actions: [
        "Mevcut tekrar kalitesini ve toparlanma hissini bir hafta gozlemle.",
        "Plateau varsa once hareket secimi ve yorgunluk tarafini ayir.",
        "Hacim artisina ancak mevcut sistemin bunu kaldirdigini gordugunde gec.",
      ],
    },
    systemBridge: {
      title: "Bu karar, sadece set sayisi karari degildir.",
      description:
        "Bilim ve Fitness sisteminde antrenman bilimi, beslenme ve toparlanmadan bagimsiz okunmaz. Hacim karari da bu yuzden daha buyuk yuk yonetimi icinde degerlendirilir.",
      primaryCommand: {
        href: "/sistem",
        label: "Yuk Mantigini Oku",
      },
      secondaryCommand: {
        href: "/test",
        label: "Profilini Ayir",
      },
    },
    stateNextStep: {
      title: "Sonraki adim her profil icin ayni degil.",
      description:
        "Bazi kullanicida sorun bilgi eksigi, bazisinda toparlanma, bazisinda ise plateau teshisidir:",
      routes: [
        {
          label: "Cerceve",
          title: "Hacim konusunu hala yalnizca sayi olarak goruyorsan once sistemi oku.",
          description:
            "Hacim, daha buyuk yuk yonetimi mantigi icinde yerini bulur.",
          href: "/sistem",
          commandLabel: "Sistemi Oku",
        },
        {
          label: "Tani",
          title: "Hacim artisi mi, toparlanma mi, teknik mi sorun bilmiyorsan teste gec.",
          description:
            "Test, plateau ve yuk kararlarini daha net profile ayirir.",
          href: "/test",
          commandLabel: "Teste Gec",
        },
        {
          label: "Devam",
          title: "Karari daha sonra uygulayacaksan ciktini kendine gonder.",
          description:
            "Boylece sonraki antrenman planina dagilmadan donersin.",
          href: "#article-continuation",
          commandLabel: "Notu Koru",
        },
      ],
    },
    continuation: {
      title: "Antrenman kararini kaydet.",
      description:
        "Yazinin kisa sonucunu, hacim artisi oncesi kontrol edecegin noktayi ve sonraki rotayi kendine gonder.",
      deliverables: ["Hacim ozeti", "Kontrol listesi", "Sonraki rota"],
      buttonLabel: "Karari Gonder",
      successMessage:
        "Antrenman notu kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
    },
  },
  {
    title: "Performans ilerlemiyorsa ilk neyi kontrol etmeli?",
    slug: "performans-ilerlemiyorsa-ilk-neyi-kontrol-etmeli",
    cluster: "performance_optimization",
    summary:
      "Performans dususu tek bir nedene baglanmaz; ilk kontrol, yuku degil sinyalin kendisini dogru okumaktir.",
    intent: "decision",
    readingTime: "7 dk",
    continuationTarget: "test",
    opening: {
      eyebrow: "Optimizasyon Sorusu",
      title: "Performans durdugunda ilk bakis noktasi daha sert antrenman degildir.",
      description:
        "Performans dususunu gorur gormez daha fazla yuk eklemek ya da sistemi degistirmek, problemi daha da bulanik hale getirebilir.",
      answerTitle: "Kisa cevap",
      answer:
        "Ilk kontrol edilmesi gereken sey, sinyalin hangi katmanda bozuldugudur: toparlanma, yuklenme, ritim ya da hedef uyumu. Dogru teshis olmadan yapilan degisiklik, genelde daha fazla gurultu uretir.",
    },
    clarification: {
      title: "Yanlis ilk tepkiler",
      description:
        "Performans dususunde en sik gorulen uc yanlis tepki sunlardir:",
      points: [
        "Tek seferde fazla degiskeni degistirmek",
        "Yuku hemen artirip asagidaki sorunu gizlemek",
        "Toparlanma ve davranis tarafini yok saymak",
      ],
    },
    explanation: {
      title: "Bilimsel taraf",
      paragraphs: [
        "Performans yalnizca kas ya da kondisyon ciktisi degildir; sinyal kalitesiyle ilgilidir. Uykudan yuklenmeye, hedef seciminden tekrar ritmine kadar bircok katman bu sinyali etkiler.",
        "Bu nedenle iyi optimizasyon, anlik agresyon degil karar sirasidir. Ilk adim daha cok degil daha net okumaktir. Aksi halde dogru sorunu yanlis yerde ararsin.",
      ],
    },
    practical: {
      title: "Pratik yorum",
      description:
        "Bir anda her seyi degistirmek yerine asagidaki sira daha temiz sonuc verir:",
      actions: [
        "Son bir haftadaki uyku, yorgunluk ve tekrar kalitesini yan yana koy.",
        "Hedefe hizmet etmeyen yukleri gecici olarak azalt.",
        "Tek bir performans gostergesini sec ve yalnizca onu izle.",
      ],
    },
    systemBridge: {
      title: "Optimizasyon, temelden kopuk calismaz.",
      description:
        "Bilim ve Fitness sisteminde performans, temel duzen kurulmadan ayri bir katman olarak ele alinmaz. Bu konu ancak sistemin onceki katmanlariyla birlikte netlesir.",
      primaryCommand: {
        href: "/sistem",
        label: "Sistemin Sirasini Oku",
      },
      secondaryCommand: {
        href: "/test",
        label: "Profilini Dogrula",
      },
    },
    stateNextStep: {
      title: "Ilerleme durdugunda sonraki adim acik olmali.",
      description:
        "Asagidaki uc yol, performans dususunu daha az gurultu ile ayirmana yardim eder:",
      routes: [
        {
          label: "Cerceve",
          title: "Optimizasyona erken gectiginden supheleniyorsan once sistemi oku.",
          description:
            "Bazen sorun ileri seviye detay degil, onceki katmanlarin zayifligidir.",
          href: "/sistem",
          commandLabel: "Sirayi Oku",
        },
        {
          label: "Tani",
          title: "Hangi darbogazin baskin oldugunu ayirmak icin teste gec.",
          description:
            "Test, performans dususunun hangi profil icinde anlam kazandigini ayirir.",
          href: "/test",
          commandLabel: "Teste Gec",
        },
        {
          label: "Devam",
          title: "Yorumu kaybetmeden sonra donmek istiyorsan notu koru.",
          description:
            "Boylece optimizasyon rotasina ayni netlikle geri gelirsin.",
          href: "#article-continuation",
          commandLabel: "Rotami Koru",
        },
      ],
    },
    continuation: {
      title: "Optimizasyon notunu sakla.",
      description:
        "Yazinin kisa yorumunu, once kontrol edecegin sinyali ve uygun sonraki rotayi kendine gonder.",
      deliverables: ["Optimizasyon ozeti", "Ilk sinyal kontrolu", "Sonraki rota"],
      buttonLabel: "Notu Gonder",
      successMessage:
        "Optimizasyon notu kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
    },
  },
  {
    title: "Ac karnina kardiyo yag yakimini gercekten artirir mi?",
    slug: "ac-karnina-kardiyo-yag-yakimini-gercekten-artirir-mi",
    cluster: "myths_clarifications",
    summary:
      "Ac karnina kardiyo, tek basina daha iyi yag kaybi garantisi vermez; toplam sistem bozuksa bu detay anlamini kaybeder.",
    intent: "clarification",
    readingTime: "5 dk",
    continuationTarget: "sistem",
    opening: {
      eyebrow: "Mit Kontrolu",
      title: "Ac karnina kardiyo, sonucu tek basina ust duzeye tasiyan gizli arac degil.",
      description:
        "Bu konu uzun sure buyutuldu; ancak pratikte asil belirleyici olan toplam enerji dengesi, surdurulebilirlik ve uygulama kalitesidir.",
      answerTitle: "Kisa cevap",
      answer:
        "Ac karnina kardiyo otomatik olarak daha iyi yag kaybi uretmez. Toplam sistem zayifsa zamanlama detayi, buyuk resmi duzeltmez.",
    },
    clarification: {
      title: "Miti neden cekici geliyor?",
      description:
        "Cunku teknik gibi gorunen detaylar kontrol hissi verir. Oysa su hatalar devrede kalir:",
      points: [
        "Toplam enerji ve davranis surekliligini ikinci plana itmek",
        "Detay degiskene buyuk neden rolu yuklemek",
        "Yontemi gosterisli ama uygulanmasi zor hale getirmek",
      ],
    },
    explanation: {
      title: "Bilimsel taraf",
      paragraphs: [
        "Yag kaybi sonucunda belirleyici olan ana tablo toplam enerji dengesi ve surecin korunabilirligidir. Kardiyonun zamanlamasi bazi kisiler icin tolere edilebilir olabilir; ancak bu, sistemi tek basina tasiyan faktor degildir.",
        "Bu nedenle detay degiskenler ancak temel katmanlar saglamken anlam kazanir. Temel sorun ritim, kalori acigi ya da toparlanmayken miti merkez yapmak yanlis oncelik uretir.",
      ],
    },
    practical: {
      title: "Pratik yorum",
      description:
        "Burada ilk soru 'ac mi tok mu' degil, 'bu stratejiyi koruyabiliyor muyum' sorusudur.",
      actions: [
        "Kardiyo zamanlamasini toplam planin tasinabilirligine gore sec.",
        "Asil sonucu belirleyen ana katmanlari once sabitle.",
        "Detaylari ancak sistem calisiyorsa buyut.",
      ],
    },
    systemBridge: {
      title: "Dar detaylar sistemi ikame etmez.",
      description:
        "Bilim ve Fitness sistemi, mitleri tek tek curutmek icin degil; kullanicinin oncelik sirasini duzeltmek icin vardir. Bu soru da daha buyuk oncelik zincirinin icinde anlam kazanir.",
      primaryCommand: {
        href: "/sistem",
        label: "Oncelik Sirasini Oku",
      },
      secondaryCommand: {
        href: "/test",
        label: "Profilini Ayir",
      },
    },
    stateNextStep: {
      title: "Siradaki adim, nerede karistigina bagli.",
      description:
        "Mit temizlendiginde bile herkesin sonraki adimi ayni olmaz:",
      routes: [
        {
          label: "Cerceve",
          title: "Detaylari ana strateji yerine koyuyorsan once sistemi oku.",
          description:
            "Bazen ihtiyac duydugun sey daha fazla ipucu degil, daha dogru oncelik sirasidir.",
          href: "/sistem",
          commandLabel: "Onceligi Oku",
        },
        {
          label: "Tani",
          title: "Asil darbogazin nerede oldugunu ayirmak icin teste gec.",
          description:
            "Test, mitin altindaki gercek ihtiyaci daha net gosterir.",
          href: "/test",
          commandLabel: "Teste Gec",
        },
        {
          label: "Devam",
          title: "Sonucu sonra kullanacaksan yaziyi kendine gonder.",
          description:
            "Boylece detay ile temel arasindaki ayrimi kaybetmezsin.",
          href: "#article-continuation",
          commandLabel: "Notu Koru",
        },
      ],
    },
    continuation: {
      title: "Mit notunu kendine gonder.",
      description:
        "Bu yazinin ozetini, ilk bakman gereken temel katmani ve sonraki rotayi e-postana kaydet.",
      deliverables: ["Mit ozeti", "Ilk temel kontrol", "Sonraki rota"],
      buttonLabel: "Notu Gonder",
      successMessage:
        "Mit notu kaydedildi. Gercek gonderim entegrasyonu sonraki asamada baglanacak.",
    },
  },
];

export function getIntentLabel(intent: ArticleIntent) {
  switch (intent) {
    case "question":
      return "Soru";
    case "decision":
      return "Karar";
    case "clarification":
      return "Netlestirme";
  }
}

export function getClusterDefinition(cluster: ArticleClusterKey) {
  return articleClusters.find((item) => item.key === cluster);
}

export function getClusterHref(cluster: ArticleClusterKey) {
  return `/yazilar#${cluster}`;
}

export function getLeadArticleByCluster(cluster: ArticleClusterKey) {
  return authorityArticles.find((article) => article.cluster === cluster);
}

export const featuredAuthorityArticle =
  authorityArticles.find((article) => article.featured) ?? authorityArticles[0];

export function getArticleBySlug(slug: string) {
  return authorityArticles.find((article) => article.slug === slug);
}

export function buildArticleContinuationConfig(article: AuthorityArticle): ContinuationConfig {
  const cluster = getClusterDefinition(article.cluster);
  const intent = getIntentLabel(article.intent).toLowerCase();

  const targetMessage =
    article.continuationTarget === "sistem"
      ? "Kaydi actiginda seni once /sistem omurgasina geri getirecek net bir not da icinde olacak."
      : article.continuationTarget === "test"
        ? "Kaydi actiginda seni tani katmanina geri tasiyacak en net not da icinde olacak."
        : "Kaydi actiginda yazidan cikan ana rota ve uygulama notu ayni yerde seni bekleyecek.";

  return {
    title: article.continuation.title,
    description: `${article.continuation.description} ${cluster?.label ?? "Bu cluster"} icinde bu yazi ${intent} tipi bir karari kapatir. ${targetMessage}`,
    whyNow:
      article.continuationTarget === "test"
        ? "Cunku bu yazi sende bir sey acmissa sonraki en dogru hamle taniya hemen gecmek olur."
        : article.continuationTarget === "sistem"
          ? "Cunku dar soru buyuk omurgaya baglanmaya hazirken beklemek konuyu yeniden parcali hale getirir."
          : "Cunku karar nettlesirken notu simdi korumak daha sonra ayni netlige donmeyi kolaylastirir.",
    delayCost:
      article.continuationTarget === "test"
        ? "Beklersen konu sende yine teori olarak kalir ve kendi durumuna gecmez."
        : article.continuationTarget === "sistem"
          ? "Beklersen ayni soruyu yine dar bir problem gibi okuyup daha buyuk deseni kacirabilirsin."
          : "Beklersen bu yazidan cikan karar notu dagilir ve geri donuste sifirdan dusunursun.",
    deliverables: article.continuation.deliverables,
    buttonLabel: article.continuation.buttonLabel,
    successMessage: article.continuation.successMessage,
    helperText:
      article.continuationTarget === "test"
        ? "Bu alan bulten icin degil; sorudan taniya gecis enerjisini kaybetmemen icin hazirlandi."
        : article.continuationTarget === "sistem"
          ? "Bu alan bulten icin degil; dar sorudan buyuk omurgaya donerken notunu koruman icin hazirlandi."
          : "Bu alan bulten icin degil; yazidan cikan karar notunu sonra ayni netlikle acabilmen icin hazirlandi.",
    inputPlaceholder:
      article.continuationTarget === "test"
        ? "Teste donus yolunu gonderecegimiz e-posta"
        : article.continuationTarget === "sistem"
          ? "Sistem notunu gonderecegimiz e-posta"
          : "Karar notunu gonderecegimiz e-posta",
  };
}
