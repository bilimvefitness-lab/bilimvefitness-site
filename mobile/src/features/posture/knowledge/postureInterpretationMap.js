/**
 * @file postureInterpretationMap.js
 * @description Signal descriptions mapping with varying verbosity for posture analysis.
 */

export const PostureInterpretationMap = {
  forward_head: {
    label: "Baş Pozisyonu",
    shortLabel: "Baş",
    descriptions: {
      low: {
        short: "Baş bölgesi hafif önde {severity_suffix}.",
        standard: "Yan görünüşte baş pozisyonu omuz hattının biraz önünde {severity_suffix}.",
        expanded: "Yan görünüş incelendiğinde, baş pozisyonunun bedenin geri kalanına ve omuz hizasına göre hafifçe önde olduğu {severity_suffix}."
      },
      medium: {
        short: "Baş bölgesi önde {severity_suffix}.",
        standard: "Yan görünüşte baş pozisyonu omuz hattının önünde {severity_suffix}.",
        expanded: "Yan görünüş analizi, baş pozisyonunun omuz ağırlık merkezinin genel hizasından belirgin şekilde önde olabileceğini gösteriyor."
      },
      high: {
        short: "Baş bölgesi belirgin önde {severity_suffix}.",
        standard: "Yan görünüşte baş pozisyonu belirgin şekilde öne eğilimli {severity_suffix}.",
        expanded: "Yan görünüşte baş ve boyun bölgesinde belirgin bir öne eğilim eğilimi saptanmıştır, bu durum boyun kaslarına ekstra yük bindiriyor {severity_suffix}."
      }
    },
    sourceViewHint: "Yan",
    neutralFallback: "Baş pozisyonu analiz edilemedi."
  },
  thoracic_rounding_tendency: {
    label: "Sırt Eğriliği (Kifoz Eğilimi)",
    shortLabel: "Üst Sırt",
    descriptions: {
      low: {
        short: "Sırtta hafif yuvarlanma {severity_suffix}.",
        standard: "Sırt bölgesinde hafif bir yuvarlanma eğilimi {severity_suffix}.",
        expanded: "Üst sırt (torasik) bölgede çok hafif bir kavislenme veya duruş kaynaklı yuvarlanma eğilimi {severity_suffix}."
      },
      medium: {
        short: "Sırtta yuvarlanma {severity_suffix}.",
        standard: "Sırt bölgesinde yuvarlanma eğilimi {severity_suffix}.",
        expanded: "Kürek kemikleri ve üst sırt çevresinde belirgin bir yuvarlanma veya kavis eğilimi tespit edilmiştir."
      },
      high: {
        short: "Sırtta belirgin yuvarlanma {severity_suffix}.",
        standard: "Sırt bölgesinde belirgin bir kavis ve yuvarlanma {severity_suffix}.",
        expanded: "Üst sırt bölgesinde duruş profilini yoğun olarak etkileyebilecek düzeyde belirgin bir kavislenme eğilimi {severity_suffix}."
      }
    },
    sourceViewHint: "Yan",
    neutralFallback: "Sırt bölgesi analiz edilemedi."
  },
  shoulder_asymmetry: {
    label: "Omuz Asimetrisi",
    shortLabel: "Omuzlar",
    descriptions: {
      low: {
        short: "Hafif omuz seviye farkı {severity_suffix}.",
        standard: "Omuz hizasında hafif bir seviye farkı {severity_suffix}.",
        expanded: "Sağ ve sol omuz seviyeleri arasında günlük asimetrilere bağlı olabilecek hafif bir yükseklik farkı {severity_suffix}."
      },
      medium: {
        short: "Omuz seviye farkı {severity_suffix}.",
        standard: "Omuz hizasında seviye farkı {severity_suffix}.",
        expanded: "Omuzlardan birinin diğerine kıyasla daha aşağıda veya yukarıda konumlandığını gösteren hizalama farkı {severity_suffix}."
      },
      high: {
        short: "Belirgin omuz seviye farkı {severity_suffix}.",
        standard: "Omuz hizasında belirgin bir asimetri {severity_suffix}.",
        expanded: "Omuz hattında bedenin ağırlık merkezini de etkileyebilecek düzeyde, oldukça belirgin bir yükseklik asimetrisi {severity_suffix}."
      }
    },
    sourceViewHint: "Ön/Arka",
    neutralFallback: "Omuz hizası analiz edilemedi."
  },
  spinal_alignment_variance: {
    label: "Omurga Hizalaması",
    shortLabel: "Omurga",
    descriptions: {
      low: {
        short: "Omurga hattında hafif sapma {severity_suffix}.",
        standard: "Omurga orta hattında çok hafif bir sapma {severity_suffix}.",
        expanded: "Sırtın arka görünüşünde orta hattan hafif bir uzaklaşma veya duruş alışkanlığı kaynaklı küçük bir sapma eğilimi {severity_suffix}."
      },
      medium: {
        short: "Omurga hattında sapma {severity_suffix}.",
        standard: "Omurga orta hattında sapma {severity_suffix}.",
        expanded: "Arka görünüşte omurga çizgisinin dikey eksenden belirgin bir şekilde saptığını gösteren yapısal hizalama farkı {severity_suffix}."
      },
      high: {
        short: "Omurga hattında belirgin sapma {severity_suffix}.",
        standard: "Omurga orta hattında belirgin bir sapma {severity_suffix}.",
        expanded: "Orta hat boyunca genel postürü önemli ölçüde destekleyen güçlü bir deviasyon (sapma) eğilimi {severity_suffix}."
      }
    },
    sourceViewHint: "Arka",
    neutralFallback: "Omurga hizalaması analiz edilemedi."
  },
  pelvic_asymmetry_tendency: {
    label: "Kalça (Pelvis) Asimetrisi",
    shortLabel: "Kalça",
    descriptions: {
      low: {
        short: "Hafif kalça seviye farkı {severity_suffix}.",
        standard: "Kalça hizasında çok hafif bir asimetri eğilimi {severity_suffix}.",
        expanded: "Kalça seviyesinde (pelvis) tek bacağa yüklenme alışkanlığına bağlı olabilecek basit bir hizalama asimetrisi {severity_suffix}."
      },
      medium: {
        short: "Kalça seviye farkı {severity_suffix}.",
        standard: "Kalça hizasında asimetri eğilimi {severity_suffix}.",
        expanded: "Ön veya arka görünüşte sağ ve sol kalça seviyesinde ağırlık transferini etkileyebilecek belirgin bir fark {severity_suffix}."
      },
      high: {
        short: "Belirgin kalça seviye farkı {severity_suffix}.",
        standard: "Kalça hizasında belirgin bir seviye farkı {severity_suffix}.",
        expanded: "Pelvisin genel yönelimini değiştirebilecek seviyede kuvvetli bir yükseklik veya duruş asimetrisi {severity_suffix}."
      }
    },
    sourceViewHint: "Ön/Arka",
    neutralFallback: "Kalça hizalaması analiz edilemedi."
  }
};
