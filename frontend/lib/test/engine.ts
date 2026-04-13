import { getSegmentConnection } from "@/content/personalization";
import type {
  TestResult,
  TestSegment,
  TestState,
} from "@/lib/test/types";

type CompleteTestState = Required<TestState>;

type NarrativeConfig = Pick<
  TestResult,
  "segmentLabel" | "title" | "insight" | "whyThisResult" | "identityStatement" | "plan"
>;

function assertCompleteState(state: TestState): asserts state is CompleteTestState {
  if (
    !state.primaryGoal ||
    !state.experienceLevel ||
    !state.consistencyState ||
    !state.mainBottleneck ||
    !state.readinessLevel
  ) {
    throw new Error("Test state is incomplete.");
  }
}

function isLowConsistency(input: CompleteTestState) {
  return input.consistencyState === "fragile" || input.consistencyState === "inconsistent";
}

function isEarlyStage(input: CompleteTestState) {
  return input.experienceLevel === "beginner" || input.experienceLevel === "restarting";
}

function isAdvancedStage(input: CompleteTestState) {
  return input.experienceLevel === "advanced";
}

function hasPlateauSignal(input: CompleteTestState) {
  return input.mainBottleneck === "plateau" || input.mainBottleneck === "recovery";
}

export function getTestSegment(input: TestState): TestSegment {
  assertCompleteState(input);

  if (isAdvancedStage(input) && input.readinessLevel === "optimizing") {
    return "advanced_optimization";
  }

  if (hasPlateauSignal(input) && (input.experienceLevel === "intermediate" || isAdvancedStage(input))) {
    return input.primaryGoal === "performance"
      ? "performance_precision"
      : "plateau_breakthrough";
  }

  if (isLowConsistency(input) || input.mainBottleneck === "consistency" || input.mainBottleneck === "time") {
    return "consistency_reset";
  }

  if (isEarlyStage(input) && (input.readinessLevel === "starting" || input.readinessLevel === "committing")) {
    return "foundation_action";
  }

  if (isAdvancedStage(input)) {
    return "advanced_optimization";
  }

  return "foundation_clarity";
}

function buildFoundationClarityResult(): NarrativeConfig {
  return {
    segmentLabel: getSegmentConnection("foundation_clarity").segmentLabel,
    title: "Sorunun agirlik degil, odak daginikligi.",
    insight:
      "Su an seni geride tutan sey daha az cabalamak degil; fazla yone bakarken ilk hamleyi geciktirmen.",
    whyThisResult: [
      "Yeni bilgiye hizli aciliyorsun ama ilk sirayi kapatmadan diger katmana geciyorsun.",
      "Ne yapman gerektigini biliyor gibi hissediyorsun; yine de baslangici sakin kuramiyorsun.",
      "Secenek arttikca karar gecikiyor ve ilk hareket agirlasiyor.",
    ],
    identityStatement:
      "Sen su an daha cok bilgiye degil, once sirayi kapatmasi gereken kullanicisin.",
    plan: [
      "Tek hedef sec ve ilk iki haftayi onun etrafinda tut.",
      "Fazla icerigi kapat; temel ritmi bozacak yeni denemeleri durdur.",
      "Sonuc kovalamadan once tekrar eden bir iskelet kur.",
    ],
  };
}

function buildFoundationActionResult(): NarrativeConfig {
  return {
    segmentLabel: getSegmentConnection("foundation_action").segmentLabel,
    title: "Baslamak degil, duzgun kurmak zorundasin.",
    insight:
      "Sende istek var. Risk, o istegi daginik bilgiyle zayif bir duzene cevirmen. Burada hizdan once kurulum gerekiyor.",
    whyThisResult: [
      "Harekete gecmeye hazirsin ama ayni anda cok sey kurmaya yatkinsin.",
      "Baslangic enerjin yuksek oldugu icin ilk haftada gereksiz yuk alma riski tasiyorsun.",
      "Sistem kurulmadan hizlanirsan devam eden duzen yerine kisa sureli cikislar yasarsin.",
    ],
    identityStatement:
      "Sen su an motive edilmeyi degil, duzgun kurulumu hak eden kullanicisin.",
    plan: [
      "Temeli tek kaynaktan kur ve ilk sistemi dagitma.",
      "Ilk haftalarda karmasayi degil tekrari buyut.",
      "Yeni taktik eklemek yerine mevcut duzeni oturt.",
    ],
  };
}

function buildConsistencyResetResult(): NarrativeConfig {
  return {
    segmentLabel: getSegmentConnection("consistency_reset").segmentLabel,
    title: "Sorun bilgi eksigi degil, ritim kaybi.",
    insight:
      "Ne yapman gerektigini az cok biliyorsun. Ancak duzen kirildigi icin her deneme tekrar basa donuyor.",
    whyThisResult: [
      "Planin var ama kopus aninda seni geri cagiran net bir kuralin yok.",
      "Iyi gunlerde hizlaniyor, zor gunlerde rotayi tamamen birakiyorsun.",
      "Sorun ne yapacagini bilmemek degil; tekrar baslatma hattinin zayif olmasi.",
    ],
    identityStatement:
      "Sen su an bilgi arayan degil, ritmini geri toplamak zorunda olan kullanicisin.",
    plan: [
      "Hedefi buyutme; tekrarlanabilir ritmi once sabitle.",
      "Zaman ve sureklilik darbogazini ilk duzeltilecek alan yap.",
      "Kontrol edemedigin seyleri degil, geri donus davranisini tasarla.",
    ],
  };
}

function buildPlateauBreakthroughResult(): NarrativeConfig {
  return {
    segmentLabel: getSegmentConnection("plateau_breakthrough").segmentLabel,
    title: "Emek var, ama sistem tikaniyor.",
    insight:
      "Burada sorun daha fazla denemek degil. Seni asagida tutan degiskeni ayirmadan yuk bindirmeye devam etmen.",
    whyThisResult: [
      "Tikandigini gordugunde once teshis yerine mudahaleye gidiyorsun.",
      "Daha cok yuk eklemek seni gecici olarak rahatlatiyor ama sorunu ayirmiyor.",
      "Sorun emek eksigi degil; hangi degiskenin bozuk oldugunu gec fark etmen.",
    ],
    identityStatement:
      "Sen su an daha cok calisacak degil, daha net ayiracak kullanicisin.",
    plan: [
      "Plato ureten ana degiskeni ayikla.",
      "Hacmi artirmadan once karar kalitesini keskinlestir.",
      "Toparlanma ve yuklenme dengesini yeniden kur.",
    ],
  };
}

function buildPerformancePrecisionResult(): NarrativeConfig {
  return {
    segmentLabel: getSegmentConnection("performance_precision").segmentLabel,
    title: "Sende kaba guc degil, hassas ayar eksik.",
    insight:
      "Performans hedefin var ama verimi asagida tutan ince dar noktalar temizlenmeden yuk bindirmek kazanci sinirliyor.",
    whyThisResult: [
      "Temelin var; sorun acik bir eksik degil, sinyal gurultusu.",
      "Ilerlemeyi artirmak isterken hangi degiskenin etkiledigini bulaniklastiriyorsun.",
      "Daha cok yapmak yerine daha temiz izlemek gereken bir noktadasin.",
    ],
    identityStatement:
      "Sen su an daha sert yuklenen degil, sinyali temizleyen kullanicisin.",
    plan: [
      "Toparlanma ve performans sinyallerini birlikte oku.",
      "Ana hedefi tasimayan yukleri gecici olarak azalt.",
      "Olculebilir tek bir iyilestirme alanina kapan.",
    ],
  };
}

function buildAdvancedOptimizationResult(): NarrativeConfig {
  return {
    segmentLabel: getSegmentConnection("advanced_optimization").segmentLabel,
    title: "Temel degil, sistem hassasiyeti ariyorsun.",
    insight:
      "Baslangic problemin yok. Burada asil mesele, calisan yapinin verimini daha ince ve daha surdurulebilir hale getirmek.",
    whyThisResult: [
      "Temel kararlarin oturmus; kayip daha cok ince dagilmalarda olusuyor.",
      "Yeni uyaran aramak kolay, calisan yapinin kalitesini korumak daha zor.",
      "Sorun baslamak degil; ayni kaliteyi tekrar tekrar surdurmek.",
    ],
    identityStatement:
      "Sen su an temel arayan degil, sistem hassasiyetini koruyan kullanicisin.",
    plan: [
      "Buyuk degisiklik yerine yuksek etkili tek alana odaklan.",
      "Takip ve tekrar ritmini ileri seviye hassasiyetle yeniden kur.",
      "Sonucu degil, karar kalitesini optimize et.",
    ],
  };
}

export function buildTestResult(input: TestState): TestResult {
  assertCompleteState(input);

  const segment = getTestSegment(input);
  const connection = getSegmentConnection(segment);
  let narrative: NarrativeConfig;

  switch (segment) {
    case "foundation_clarity":
      narrative = buildFoundationClarityResult();
      break;
    case "foundation_action":
      narrative = buildFoundationActionResult();
      break;
    case "consistency_reset":
      narrative = buildConsistencyResetResult();
      break;
    case "plateau_breakthrough":
      narrative = buildPlateauBreakthroughResult();
      break;
    case "performance_precision":
      narrative = buildPerformancePrecisionResult();
      break;
    case "advanced_optimization":
      narrative = buildAdvancedOptimizationResult();
      break;
  }

  return {
    segment,
    ...narrative,
    recommendation: connection.recommendation,
    nextStep: connection.nextStep,
    supportingRoute: connection.supportingRoute,
    continuation: connection.continuation,
  };
}

