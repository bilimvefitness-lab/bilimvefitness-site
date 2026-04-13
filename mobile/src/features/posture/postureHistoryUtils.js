function getTrend(scoreDiff) {
  if (scoreDiff >= 2) return "up";
  if (scoreDiff <= -2) return "down";
  return "same";
}

export function comparePostureResults(current, previous, t) {
  if (
    !current ||
    !previous ||
    !Number.isFinite(Number(current?.score)) ||
    !Number.isFinite(Number(previous?.score))
  ) {
    return {
      scoreDiff: 0,
      trend: "same",
      summaryText: t("posture.progress.firstEntry"),
    };
  }

  const scoreDiff = Number(current.score ?? 0) - Number(previous.score ?? 0);
  const trend = getTrend(scoreDiff);

  let summaryText = t("posture.progress.trend.same");
  if (trend === "up") {
    summaryText = t("posture.progress.trend.up");
  } else if (trend === "down") {
    summaryText = t("posture.progress.trend.down");
  }

  return {
    scoreDiff,
    trend,
    summaryText,
  };
}

export function formatPostureHistoryDate(timestamp, language) {
  try {
    return new Intl.DateTimeFormat(language === "tr" ? "tr-TR" : "en-US", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(timestamp));
  } catch (_) {
    return new Date(timestamp).toLocaleString();
  }
}
