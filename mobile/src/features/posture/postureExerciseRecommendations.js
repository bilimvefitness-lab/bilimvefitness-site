function hasShoulderImbalance(findings) {
  return (
    findings?.shoulderAsymmetry === "left_low" ||
    findings?.shoulderAsymmetry === "right_low"
  );
}

function hasKyphosisTendency(findings) {
  return findings?.kyphosis === "medium" || findings?.kyphosis === "high";
}

function getRecommendationDefinitions() {
  return {
    retake_guidance: {
      id: "retake_guidance",
      titleKey: "posture.recommendations.groups.retake_guidance.title",
      purposeKey: "posture.recommendations.groups.retake_guidance.purpose",
      items: [
        {
          nameKey: "posture.recommendations.groups.retake_guidance.items.fullBody.name",
          doseKey: "posture.recommendations.groups.retake_guidance.items.fullBody.dose",
        },
        {
          nameKey: "posture.recommendations.groups.retake_guidance.items.stance.name",
          doseKey: "posture.recommendations.groups.retake_guidance.items.stance.dose",
        },
        {
          nameKey: "posture.recommendations.groups.retake_guidance.items.stability.name",
          doseKey: "posture.recommendations.groups.retake_guidance.items.stability.dose",
        },
      ],
    },
    upper_back_activation: {
      id: "upper_back_activation",
      titleKey: "posture.recommendations.groups.upper_back_activation.title",
      purposeKey: "posture.recommendations.groups.upper_back_activation.purpose",
      items: [
        {
          nameKey: "posture.recommendations.groups.upper_back_activation.items.pullApart.name",
          doseKey: "posture.recommendations.groups.upper_back_activation.items.pullApart.dose",
        },
        {
          nameKey: "posture.recommendations.groups.upper_back_activation.items.wallSlide.name",
          doseKey: "posture.recommendations.groups.upper_back_activation.items.wallSlide.dose",
        },
        {
          nameKey: "posture.recommendations.groups.upper_back_activation.items.scapHold.name",
          doseKey: "posture.recommendations.groups.upper_back_activation.items.scapHold.dose",
        },
      ],
    },
    chest_mobility: {
      id: "chest_mobility",
      titleKey: "posture.recommendations.groups.chest_mobility.title",
      purposeKey: "posture.recommendations.groups.chest_mobility.purpose",
      items: [
        {
          nameKey: "posture.recommendations.groups.chest_mobility.items.doorStretch.name",
          doseKey: "posture.recommendations.groups.chest_mobility.items.doorStretch.dose",
        },
        {
          nameKey: "posture.recommendations.groups.chest_mobility.items.breathOpener.name",
          doseKey: "posture.recommendations.groups.chest_mobility.items.breathOpener.dose",
        },
        {
          nameKey: "posture.recommendations.groups.chest_mobility.items.shoulderSweep.name",
          doseKey: "posture.recommendations.groups.chest_mobility.items.shoulderSweep.dose",
        },
      ],
    },
    neck_alignment: {
      id: "neck_alignment",
      titleKey: "posture.recommendations.groups.neck_alignment.title",
      purposeKey: "posture.recommendations.groups.neck_alignment.purpose",
      items: [
        {
          nameKey: "posture.recommendations.groups.neck_alignment.items.chinTuck.name",
          doseKey: "posture.recommendations.groups.neck_alignment.items.chinTuck.dose",
        },
        {
          nameKey: "posture.recommendations.groups.neck_alignment.items.wallReset.name",
          doseKey: "posture.recommendations.groups.neck_alignment.items.wallReset.dose",
        },
        {
          nameKey: "posture.recommendations.groups.neck_alignment.items.screenBreak.name",
          doseKey: "posture.recommendations.groups.neck_alignment.items.screenBreak.dose",
        },
      ],
    },
    shoulder_balance: {
      id: "shoulder_balance",
      titleKey: "posture.recommendations.groups.shoulder_balance.title",
      purposeKey: "posture.recommendations.groups.shoulder_balance.purpose",
      items: [
        {
          nameKey: "posture.recommendations.groups.shoulder_balance.items.singleArmRow.name",
          doseKey: "posture.recommendations.groups.shoulder_balance.items.singleArmRow.dose",
        },
        {
          nameKey: "posture.recommendations.groups.shoulder_balance.items.farmerHold.name",
          doseKey: "posture.recommendations.groups.shoulder_balance.items.farmerHold.dose",
        },
        {
          nameKey: "posture.recommendations.groups.shoulder_balance.items.scapSet.name",
          doseKey: "posture.recommendations.groups.shoulder_balance.items.scapSet.dose",
        },
      ],
    },
    maintain_alignment: {
      id: "maintain_alignment",
      titleKey: "posture.recommendations.groups.maintain_alignment.title",
      purposeKey: "posture.recommendations.groups.maintain_alignment.purpose",
      items: [
        {
          nameKey: "posture.recommendations.groups.maintain_alignment.items.wallAngel.name",
          doseKey: "posture.recommendations.groups.maintain_alignment.items.wallAngel.dose",
        },
        {
          nameKey: "posture.recommendations.groups.maintain_alignment.items.chestOpen.name",
          doseKey: "posture.recommendations.groups.maintain_alignment.items.chestOpen.dose",
        },
        {
          nameKey: "posture.recommendations.groups.maintain_alignment.items.postureBreak.name",
          doseKey: "posture.recommendations.groups.maintain_alignment.items.postureBreak.dose",
        },
      ],
    },
  };
}

function uniqueIds(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

export function selectPostureRecommendations(analysisResult) {
  if (!analysisResult) {
    return [];
  }

  const findings = analysisResult?.findings ?? {};
  const confidence = analysisResult?.confidence ?? "low";
  const summary = Array.isArray(analysisResult?.summary) ? analysisResult.summary : [];
  const selected = [];

  if (
    confidence === "low" ||
    summary.includes("no_person_detected") ||
    summary.includes("wrong_angle") ||
    summary.includes("insufficient_visibility") ||
    summary.includes("platform_limited")
  ) {
    selected.push("retake_guidance");
  }

  if (hasKyphosisTendency(findings)) {
    selected.push("upper_back_activation", "chest_mobility");
  }

  if (findings.forwardHead === true) {
    selected.push("neck_alignment");
  }

  if (hasShoulderImbalance(findings)) {
    selected.push("shoulder_balance");
  }

  if (!selected.length) {
    selected.push("maintain_alignment");
  }

  return uniqueIds(selected);
}

export function buildPostureRecommendationCards(t, analysisResult, options = {}) {
  const definitions = getRecommendationDefinitions();
  const limit = Number.isFinite(options.limit) ? Number(options.limit) : null;
  const selectedIds = selectPostureRecommendations(analysisResult);
  const cards = selectedIds
    .map((id) => definitions[id])
    .filter(Boolean)
    .map((definition) => ({
      id: definition.id,
      title: t(definition.titleKey),
      purpose: t(definition.purposeKey),
      items: definition.items.map((item) => ({
        name: t(item.nameKey),
        dose: t(item.doseKey),
      })),
    }));

  if (limit === null) {
    return cards;
  }

  return cards.slice(0, limit);
}
