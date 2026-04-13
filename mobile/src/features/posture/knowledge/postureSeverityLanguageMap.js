/**
 * @file postureSeverityLanguageMap.js
 * @description Centralized severity language mapping to standardise tone.
 */

export const PostureSeverityLanguageMap = {
  low: {
    prefix: "hafif",
    tone: "soft",
    suffix: "olabilir"
  },
  medium: {
    prefix: "belirgin",
    tone: "neutral",
    suffix: "görülebilir"
  },
  high: {
    prefix: "daha belirgin",
    tone: "cautious_strong",
    suffix: "olabilir"
  }
};
