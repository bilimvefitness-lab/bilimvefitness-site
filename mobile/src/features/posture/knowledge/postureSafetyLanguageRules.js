/**
 * @file postureSafetyLanguageRules.js
 * @description Safety rules to prevent diagnostic or absolute claims.
 */

export const PostureSafetyLanguageRules = {
  forbiddenPhrases: [
    "kesin olarak",
    "kesin tanı",
    "teşhis edildi",
    "bozukluk var",
    "sende hastalık var",
    "durumun kötü",
    "tıbbi bir sorun",
    "hastasın"
  ],
  preferredPhrases: [
    "eğilim olabilir",
    "görünüm bu yönde olabilir",
    "sınırlı güvenle yorumlandı",
    "daha net değerlendirme için tekrar ölçüm faydalı olabilir",
    "pozisyonel bir alışkanlık olabilir"
  ],
  painEscalationRule: "Ağrı veya fonksiyon kaybı varsa mutlaka bir sağlık uzmanına başvurunuz."
};
