const BACKEND_VALUE_LABELS = {
  behaviorStatus: {
    strong: "Güçlü",
    fair: "Orta",
    fragile: "Kırılgan",
  },
  confidenceLevel: {
    high: "yüksek",
    medium: "orta",
    low: "düşük",
  },
  confidenceTone: {
    high: "Yüksek",
    medium: "Orta",
    low: "Düşük",
  },
  behaviorComponent: {
    protein: "Protein",
    calories: "Kalori",
    logging: "Kayıt",
  },
  proteinStatus: {
    low: "protein düşük",
    close: "protein yakın",
    on_target: "protein hedefte",
    above_target: "protein yüksek",
  },
  calorieBalance: {
    deficit: "kalori açıkta",
    surplus: "kalori fazla",
    near_target: "kalori dengede",
  },
};

const ENGLISH_BACKEND_TOKENS = [
  "next meal",
  "risk control",
  "daily coach",
  "daily summary",
  "behavior score",
  "not found",
  "network request failed",
  "request failed",
  "meal",
  "target",
  "action",
  "trend",
  "summary",
  "coach",
  "invalid",
  "required",
  "priority",
  "confidence",
  "fragile",
  "stable",
  "strong",
  "fair",
  "high",
  "medium",
  "low",
  "small",
  "large",
  "portion",
  "bowl",
  "surplus",
  "deficit",
  "near_target",
  "on_target",
  "logging",
  "error",
  "failed",
];

export function mapBackendValue(group, value, fallback = "") {
  const normalized = String(value || "").toLowerCase();
  return BACKEND_VALUE_LABELS[group]?.[normalized] || fallback;
}

export function hasEnglishBackendLeak(text) {
  const normalized = String(text || "").trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return ENGLISH_BACKEND_TOKENS.some((token) => normalized.includes(token));
}

export function safeBackendText(text, fallback) {
  const normalized = String(text || "").trim();
  if (!normalized) {
    return fallback;
  }
  if (hasEnglishBackendLeak(normalized)) {
    return fallback;
  }
  return normalized;
}

export function streakCountLabel(count) {
  return `${Number(count || 0)} gün`;
}

export function behaviorStatusLabel(status) {
  return mapBackendValue("behaviorStatus", status, "Orta");
}

export function behaviorComponentLabel(key) {
  return mapBackendValue("behaviorComponent", key, "Kayıt");
}

export function confidencePlainLabel(level) {
  return mapBackendValue("confidenceTone", level, "Orta");
}

export function confidencePlainHint(confidence) {
  if (!confidence) {
    return "";
  }
  if (confidence.level === "high") {
    return "Porsiyonlar net, makrolar daha güvenilir.";
  }
  if (confidence.level === "medium") {
    return "Bir iki satır tahmini, yine de yeterince kullanışlı.";
  }
  return "Bir sonraki öğünde gram ya da net porsiyon seç.";
}

export function behaviorScoreSupportText(score) {
  if (!score) {
    return "";
  }
  const weakest = behaviorComponentLabel(score.priority_component).toLowerCase("tr");
  if (score.status === "strong") {
    return "Bugün ritim güçlü. Çizgiyi bozma.";
  }
  if (score.status === "fair") {
    return `Şimdi ${weakest} tarafını toparla.`;
  }
  return `Şimdi ${weakest} tarafını düzelt.`;
}

export function proteinStatusLabel(status) {
  return mapBackendValue("proteinStatus", status, "protein dengede");
}

export function calorieBalanceLabel(status) {
  return mapBackendValue("calorieBalance", status, "kalori dengede");
}

export function decisionPriorityFallback(coach) {
  if (!coach) {
    return "Bugünü temiz kapat.";
  }
  if (coach.protein_status === "low") {
    return "Şimdi protein açığını kapat.";
  }
  if (coach.calorie_balance === "surplus") {
    return "Şimdi fazla kaloriyi durdur.";
  }
  if (coach.behavior_score?.priority_component === "logging") {
    return "Şimdi sonraki öğünü kaydet.";
  }
  return "Planı temiz sürdür.";
}

export function nextMealFallback(coach) {
  if (!coach) {
    return "Sonraki öğünü sade kur.";
  }
  if (coach.protein_status === "low") {
    return "Sonraki öğüne güçlü protein ekle.";
  }
  if (coach.calorie_balance === "surplus") {
    return "Sonraki öğünde ek karbonhidrat ekleme.";
  }
  return "Sonraki öğünü planlı kapat.";
}

export function riskControlFallback(coach) {
  if (!coach) {
    return "Bugün plansız atıştırma açma.";
  }
  if (coach.calorie_balance === "surplus") {
    return "Bugün ekstra karbonhidratı ve tatlıyı kes.";
  }
  if (coach.confidence_overview?.level === "low") {
    return "Bugün göz kararı porsiyon yazma.";
  }
  return "Bugün plansız atıştırma açma.";
}

export function todayDecisionFallback(coach) {
  if (!coach) {
    return "Bugün planı sade tut.";
  }
  if (coach.protein_status === "low") {
    return "Şimdi protein hedefini kapat.";
  }
  if (coach.calorie_balance === "surplus") {
    return "Bugün kalan öğünlerde daha sade kal.";
  }
  return "Bugün akışı bozma.";
}

export function streakMoodCopy(streak) {
  if (!streak?.active || !streak?.count) {
    return "Bugün yeniden başlat";
  }
  if (streak.count >= 7) {
    return "Çok güçlü seri";
  }
  if (streak.count >= 3) {
    return "Ritim oturuyor";
  }
  return "Seri başladı";
}

export function formatStepNumber(value) {
  return Math.max(Number(value || 0), 0).toLocaleString("tr-TR");
}

export function checkpointStatusLabel(status) {
  if (status === "ahead") {
    return "Onde";
  }
  if (status === "behind") {
    return "Geride";
  }
  if (status === "upcoming") {
    return "Yaklasiyor";
  }
  return "Dengede";
}
