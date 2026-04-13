/**
 * NavigationService — shared navigation ref accessible from outside
 * the React component tree (e.g. SideMenu, background tasks).
 *
 * Usage:
 *   import { navigationRef, navigate } from "./NavigationService";
 *   navigate("Nutrition");
 */

import { createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();

export function navigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

export function getCurrentRouteName() {
  if (navigationRef.isReady()) {
    return navigationRef.getCurrentRoute()?.name ?? null;
  }
  return null;
}
