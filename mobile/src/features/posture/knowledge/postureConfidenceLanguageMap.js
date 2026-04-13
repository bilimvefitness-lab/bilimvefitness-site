/**
 * @file postureConfidenceLanguageMap.js
 * @description Modifies output templates based on system confidence.
 */

export const PostureConfidenceLanguageMap = {
  high: {
    hedgeLevel: "low",
    templates: {
      observation: "{text}",
      summary: "{text}"
    }
  },
  medium: {
    hedgeLevel: "medium",
    templates: {
      observation: "{text}",
      summary: "{text}"
    }
  },
  low: {
    hedgeLevel: "high",
    templates: {
      observation: "{text} (Sınırlı açı nedeniyle düşük güvenle değerlendirildi).",
      summary: "Bu bulgu sınırlı güvenle yorumlandı."
    }
  }
};
