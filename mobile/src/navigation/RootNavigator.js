import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Text } from "react-native";
import { AppProvider } from "../context/AppContext";
import HomeScreen from "../screens/HomeScreen";
import DailyScreen from "../screens/DailyScreen";
import ProfileScreen from "../screens/ProfileScreen";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Lazy-load debug screen only in dev
const AnalyticsDebugScreen = __DEV__
  ? require("../screens/AnalyticsDebugScreen").default
  : null;

const TAB_ICONS = { Home: "◉", Daily: "▤", Profile: "◎" };

function TabIcon({ name, focused }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.35, color: "#295c41" }}>
      {TAB_ICONS[name]}
    </Text>
  );
}

function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarActiveTintColor: "#295c41",
        tabBarInactiveTintColor: "#9ab09e",
        tabBarStyle: {
          backgroundColor: "#f4faf5",
          borderTopColor: "#d8e9dc",
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 10,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "700",
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "Ana Sayfa" }} />
      <Tab.Screen name="Daily" component={DailyScreen} options={{ title: "Günlük" }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: "Profil" }} />
    </Tab.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={AppTabs} />
      {__DEV__ && AnalyticsDebugScreen ? (
        <Stack.Screen
          name="AnalyticsDebug"
          component={AnalyticsDebugScreen}
          options={{
            headerShown: true,
            title: "Analytics Debug",
            presentation: "modal",
            headerStyle: { backgroundColor: "#eef4e8" },
            headerTintColor: "#295c41",
          }}
        />
      ) : null}
    </Stack.Navigator>
  );
}

// Accepts (and ignores) old prop-drilling props from App.js — those are no-ops
// until App.js is fully cleaned up.
export default function RootNavigator({ navigationRef }) {
  return (
    <AppProvider>
      <NavigationContainer ref={navigationRef}>
        <AppStack />
      </NavigationContainer>
    </AppProvider>
  );
}
