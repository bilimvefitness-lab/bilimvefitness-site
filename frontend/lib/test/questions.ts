import type {
  ConsistencyState,
  ExperienceLevel,
  MainBottleneck,
  PrimaryGoal,
  ReadinessLevel,
  TestQuestion,
} from "@/lib/test/types";

export const testQuestions = [
  {
    key: "primaryGoal",
    eyebrow: "Adim 1",
    title: "Su an en cok hangi sonucu istiyorsun?",
    description: "Once hedefi kapat. Sistem ilk yorumu bunun uzerinden kuracak.",
    options: [
      {
        value: "fat_loss",
        label: "Yag kaybi",
        description: "Daha net ve daha hafif bir fizik istiyorum.",
      },
      {
        value: "muscle_gain",
        label: "Kas kazanimi",
        description: "Guclu ve dolu gorunen bir gelisim istiyorum.",
      },
      {
        value: "performance",
        label: "Performans",
        description: "Daha guclu, daha hizli ve daha verimli olmak istiyorum.",
      },
      {
        value: "health_routine",
        label: "Duzen kurmak",
        description: "Ilk hedefim saglam ve tekrar eden bir rutin kurmak.",
      },
    ],
  } satisfies TestQuestion<PrimaryGoal>,
  {
    key: "experienceLevel",
    eyebrow: "Adim 2",
    title: "Kendini hangi antrenman asamasinda goruyorsun?",
    description: "Seviyeni ideal haline gore degil, gercek durumuna gore sec.",
    options: [
      {
        value: "beginner",
        label: "Baslangic",
        description: "Temel duzenim ve yerlesmis bir sistemim yok.",
      },
      {
        value: "restarting",
        label: "Yeniden basliyorum",
        description: "Daha once denedim ama ritmi kaybettim.",
      },
      {
        value: "intermediate",
        label: "Orta seviye",
        description: "Temelim var ama ilerleme duzensiz ya da yavas.",
      },
      {
        value: "advanced",
        label: "Ileri seviye",
        description: "Temelim var; daha cok ince ayar ariyorum.",
      },
    ],
  } satisfies TestQuestion<ExperienceLevel>,
  {
    key: "consistencyState",
    eyebrow: "Adim 3",
    title: "Gercek hayatta ne kadar duzenli kalabiliyorsun?",
    description: "Ideal ritmini degil, son haftalardaki gercek ritmini sec.",
    options: [
      {
        value: "fragile",
        label: "Cok kirilgan",
        description: "Basliyorum ama hizla kopuyorum.",
      },
      {
        value: "inconsistent",
        label: "Duzensiz",
        description: "Iyi haftalar da var, tamamen dagilan haftalar da.",
      },
      {
        value: "mostly_consistent",
        label: "Cogu zaman duzenli",
        description: "Temel ritim var ama zayif halkalarim duruyor.",
      },
      {
        value: "disciplined",
        label: "Saglam",
        description: "Temel duzenim var ve buyuk kopuslar yasamiyorum.",
      },
    ],
  } satisfies TestQuestion<ConsistencyState>,
  {
    key: "mainBottleneck",
    eyebrow: "Adim 4",
    title: "Su an seni en cok durduran sey ne?",
    description: "Tek darbogaz sec. Ilk rota bunun uzerinden acilacak.",
    options: [
      {
        value: "confusion",
        label: "Karmasa",
        description: "Neye once odaklanmam gerektigini netlestiremiyorum.",
      },
      {
        value: "time",
        label: "Zaman",
        description: "Programi hayata yerlestirmekte zorlaniyorum.",
      },
      {
        value: "consistency",
        label: "Sureklilik",
        description: "Ne yapacagimi biliyorum ama ritmi koruyamiyorum.",
      },
      {
        value: "recovery",
        label: "Toparlanma",
        description: "Uyku, enerji ya da yorgunluk ilerlemeyi bozuyor.",
      },
      {
        value: "plateau",
        label: "Plato",
        description: "Emek var ama sonuc ilerlemiyor.",
      },
    ],
  } satisfies TestQuestion<MainBottleneck>,
  {
    key: "readinessLevel",
    eyebrow: "Adim 5",
    title: "Su an ne kadar ileri gitmeye hazirsin?",
    description: "Bu cevap, sonuc ekranindaki ana yonlendirmeyi belirleyecek.",
    options: [
      {
        value: "exploring",
        label: "Netlesmek istiyorum",
        description: "Henuz dogru yolu gormek ve sakinlesmek asamasindayim.",
      },
      {
        value: "starting",
        label: "Hemen baslarim",
        description: "Dogru ilk adim verilsin, uygulamaya geceyim.",
      },
      {
        value: "committing",
        label: "Daha ciddi baglanirim",
        description: "Dogru cozum cikarsa yatirim yapmaya acigim.",
      },
      {
        value: "optimizing",
        label: "Keskinlestirmek istiyorum",
        description: "Temelim var; daha hassas ve daha verimli bir sistem ariyorum.",
      },
    ],
  } satisfies TestQuestion<ReadinessLevel>,
] as const;
