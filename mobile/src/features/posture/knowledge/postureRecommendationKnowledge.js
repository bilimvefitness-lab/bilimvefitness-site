/**
 * @file postureRecommendationKnowledge.js
 * @description Matches posture signals to coaching logic, focus areas, and exercise groups.
 */

export const PostureRecommendationKnowledge = {
  forward_head: {
    focusArea: "Boyun ve üst sırt hizalaması",
    dailyAction: "Ekran yüksekliğini göz hizasına yaklaştır.",
    exerciseGroups: ["neck_alignment", "upper_back_activation"],
    coachingHint: "Kısa süreli farkındalık tekrarları daha etkili olabilir."
  },
  thoracic_rounding_tendency: {
    focusArea: "Göğüs açıklığı ve sırt kuvveti",
    dailyAction: "Her saat başı omuzlarını geriye al ve göğsünü aç.",
    exerciseGroups: ["chest_opening", "thoracic_extension"],
    coachingHint: "Esnetme ve kuvvetlendirmeyi birlikte uygulamalısın."
  },
  shoulder_asymmetry: {
    focusArea: "Omuz ve kürek kemiği dengesi",
    dailyAction: "Çanta taşırken veya otururken ağırlığını iki tarafa eşit dağıt.",
    exerciseGroups: ["shoulder_mobility", "scapular_stability"],
    coachingHint: "Tek taraflı alışkanlıklarını gözden geçirmek faydalı olabilir."
  },
  spinal_alignment_variance: {
    focusArea: "Omurga ve merkez (core) stabilitesi",
    dailyAction: "Ayakta dururken ağırlığını iki bacağına da eşit ver.",
    exerciseGroups: ["core_stability", "spinal_mobility"],
    coachingHint: "Ağrı varsa uzmana danış, yoksa hafif mobilizasyonla başla."
  },
  pelvic_asymmetry_tendency: {
    focusArea: "Kalça dengesi ve pelvik stabilite",
    dailyAction: "Bacak bacak üstüne atma alışkanlığını sınırlandır.",
    exerciseGroups: ["hip_mobility", "glute_activation"],
    coachingHint: "Kalça esnekliği bel sağlığını doğrudan destekler."
  }
};
