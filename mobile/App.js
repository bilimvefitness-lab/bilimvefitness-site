import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import RootNavigator from "./src/navigation/RootNavigator";
import { AppProvider } from "./src/context/AppContext";
import { navigationRef } from "./src/navigation/NavigationService";
import { I18nProvider } from "./src/i18n";

// Restore critical side effects that were removed
import { configureStepNotifications, addStepNotificationReceivedListener, addStepNotificationResponseListener } from "./src/steps/notifications";
import { syncStepsToBackend, syncStepEngagementToBackend } from "./src/steps/service";

export default function App() {
  useEffect(() => {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nProvider>
        <AppProvider>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="auto" />
            <RootNavigator />
          </NavigationContainer>
        </AppProvider>
      </I18nProvider>
    </GestureHandlerRootView>
  );
}
