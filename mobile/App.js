import { createNavigationContainerRef } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import { View } from "react-native";
import React, { useEffect } from "react";
import styles from "./src/styles/shared";
import RootNavigator from "./src/navigation/RootNavigator";

// Restore critical side effects that were removed
import { configureStepNotifications, addStepNotificationReceivedListener, addStepNotificationResponseListener } from "./src/steps/notifications";
import { syncStepsToBackend, syncStepEngagementToBackend } from "./src/steps/service";

const ROOT_NAVIGATION_REF = createNavigationContainerRef();

export default function App() {
  useEffect(() => {
    // Re-initialize lost startup behaviors minimally
    configureStepNotifications();
    const l1 = addStepNotificationReceivedListener();
    const l2 = addStepNotificationResponseListener();
    syncStepsToBackend().catch(() => {});
    syncStepEngagementToBackend().catch(() => {});

    return () => {
      l1?.remove();
      l2?.remove();
    };
  }, []);

  return (
    <View style={styles.appShell}>
      <StatusBar style="auto" />
      <RootNavigator navigationRef={ROOT_NAVIGATION_REF} />
    </View>
  );
}
