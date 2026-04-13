/**
 * @file postureCaptureGuidanceKnowledge.js
 * @description Maps capture errors and weak angles to actionable guidance.
 */

export const PostureCaptureGuidanceKnowledge = {
  captureIssues: {
    side_low_quality: {
      title: "Yan görünüşü güçlendir",
      hint: "Yan profilde kulak, omuz ve kalça hattının net görünmesi sonuçları iyileştirir."
    },
    front_low_quality: {
      title: "Ön görünüşü güçlendir",
      hint: "Kameranın tam karşıda ve bel hizasında olması asimetri ölçümünü güçlendirir."
    },
    back_missing: {
      title: "Arka görünüş ekle",
      hint: "Arka görünüş ekleyerek omurga ve omuz asimetrisi analizini çok daha güvenilir hale getirebilirsin."
    },
    ear_hidden: {
      title: "Kulak hattını aç",
      hint: "Kulak ve boyun hattı görünür olduğunda baş pozisyonu daha güvenilir değerlendirilir. Saçını toplamayı deneyebilirsin."
    },
    plain_background_unconfirmed: {
      title: "Arka planı sadeleştir",
      hint: "Karmaşık arka planlar vücut hatlarının karışmasına neden olabilir. Daha sade bir duvar önünde durmayı dene."
    }
  }
};
