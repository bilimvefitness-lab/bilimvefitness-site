/**
 * tfjsMoveNetExtractor.ios.js
 *
 * iOS stub — heuristic fallback is the provider on iOS in Expo Go.
 * TFJS packages removed because @tensorflow/tfjs-react-native requires
 * native modules (react-native-fs) incompatible with Expo Go.
 */

export async function extractWithMoveNet() {
  return null;
}

export async function initTFJS() {
  return false;
}

export function isTFJSReady() {
  return false;
}

export async function disposeTFJS() {}
