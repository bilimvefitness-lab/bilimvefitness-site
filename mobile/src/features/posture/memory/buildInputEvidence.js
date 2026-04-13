import { DETECTION_VIEWS } from "./postureDetectionSchema";
import {
  buildPrecheckConfirmations,
  getUriScheme,
  logDetectionMemory,
  round,
} from "./postureDetectionMemoryUtils";

function buildViewInputEvidence(view, imageAsset, validationItems) {
  if (!imageAsset?.uri) {
    return null;
  }

  const width = Number(imageAsset?.width ?? 0);
  const height = Number(imageAsset?.height ?? 0);
  const aspectRatio = (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  )
    ? round(width / height, 4)
    : null;

  const evidence = {
    view,
    uri: imageAsset.uri,
    uriScheme: getUriScheme(imageAsset.uri),
    source: imageAsset.source ?? "unknown",
    width: Number.isFinite(width) && width > 0 ? width : null,
    height: Number.isFinite(height) && height > 0 ? height : null,
    aspectRatio,
    fileSize: Number.isFinite(Number(imageAsset?.fileSize))
      ? Number(imageAsset.fileSize)
      : null,
    capturedAt: imageAsset?.capturedAt ?? null,
    precheck: buildPrecheckConfirmations(validationItems),
  };

  logDetectionMemory("input evidence", evidence);
  return evidence;
}

export function buildInputEvidence({ frontImage, sideImage, backImage, validationItems }) {
  const imageMap = {
    front: frontImage,
    side: sideImage,
    back: backImage,
  };

  return DETECTION_VIEWS.reduce((accumulator, view) => {
    accumulator[view] = buildViewInputEvidence(view, imageMap[view], validationItems);
    return accumulator;
  }, {});
}
