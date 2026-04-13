/**
 * RootNavigator — Stable Tab-based navigation with restored left-side menu.
 *
 * Left-side menu uses SideMenu (Modal + Animated) instead of
 * @react-navigation/drawer to avoid the iOS NativeWorklets crash.
 */

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../i18n";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "../screens/HomeScreen";
import NutritionScreen from "../screens/NutritionScreen";
import HydrationScreen from "../screens/HydrationScreen";
import StepsScreen from "../screens/StepsScreen";
import SleepScreen from "../screens/SleepScreen";
import PostureScreen from "../screens/PostureScreen";
import PostureHistoryScreen from "../screens/PostureHistoryScreen";
import PostureHistoryDetailScreen from "../screens/PostureHistoryDetailScreen";
import PostureRecommendationsScreen from "../screens/PostureRecommendationsScreen";
import ProfileScreen from "../screens/ProfileScreen";
import FriendsScreen from "../screens/FriendsScreen";
import SideMenu from "../components/SideMenu";

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// ── Tab icon symbols — matches the left-side menu ────────────────────────────
const TAB_ICONS = {
  Home:      "◉",
  Nutrition: "◎",
  Steps:     "▤",
  Hydration: "◈",
  Sleep:     "◑",
  Profile:   "◐",
};

function TabIcon({ name, color }) {
  return (
    <Text style={[tabIconStyles.icon, { color }]}>{TAB_ICONS[name]}</Text>
  );
}

const tabIconStyles = StyleSheet.create({
  icon: { fontSize: 20, lineHeight: 24 },
});

function HamburgerButton({ onPress }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={12}
      style={{ marginLeft: 18, paddingVertical: 4, paddingHorizontal: 4 }}
    >
      <Text style={{ fontSize: 22, color: "#295c41", lineHeight: 26 }}>☰</Text>
    </Pressable>
  );
}

const LANG_PILLS = [
  { code: "tr", flag: "🇹🇷", label: "TR" },
  { code: "en", flag: "🇬🇧", label: "EN" },
];

function HeaderLeft({ onMenuPress, language, setLanguage }) {
  return (
    <View style={hlStyles.row}>
      <HamburgerButton onPress={onMenuPress} />
      <View style={hlStyles.pills}>
        {LANG_PILLS.map(({ code, flag, label }) => {
          const active = language === code;
          return (
            <Pressable
              key={code}
              onPress={() => setLanguage(code)}
              hitSlop={6}
              style={[hlStyles.pill, active && hlStyles.pillActive]}
            >
              <Text style={hlStyles.pillFlag}>{flag}</Text>
              <Text style={[hlStyles.pillLabel, active && hlStyles.pillLabelActive]}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const hlStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 4,
    gap: 8,
  },
  pills: {
    flexDirection: "row",
    gap: 4,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#c5d9c8",
    backgroundColor: "transparent",
  },
  pillActive: {
    backgroundColor: "#295c41",
    borderColor: "#295c41",
  },
  pillFlag: {
    fontSize: 13,
  },
  pillLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#7fa88a",
    letterSpacing: 0.5,
  },
  pillLabelActive: {
    color: "#ffffff",
  },
});

// ── Tab navigator (main app) ──────────────────────────────────────────────────
function MainTabs({ menuOpen, setMenuOpen }) {
  const { t, language, setLanguage } = useLanguage();
  const screenOptions = {
    headerStyle: { backgroundColor: "#eef4e8", elevation: 0, shadowOpacity: 0 },
    headerTintColor: "#295c41",
    headerTitleStyle: { fontWeight: "800", color: "#14301f" },
    tabBarStyle: {
      backgroundColor: "#eef4e8",
      borderTopWidth: 1,
      borderTopColor: "#dfe9de",
      paddingBottom: 4,
      height: 58,
    },
    tabBarActiveTintColor: "#295c41",
    tabBarInactiveTintColor: "#8ba691",
    tabBarLabelStyle: { fontSize: 11, fontWeight: "800", marginTop: 2 },
    headerLeft: () => (
      <HeaderLeft
        onMenuPress={() => setMenuOpen(true)}
        language={language}
        setLanguage={setLanguage}
      />
    ),
  };

  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Home"      component={HomeScreen}      options={{ title: t("nav.home"),      tabBarIcon: ({ color }) => <TabIcon name="Home"      color={color} /> }} />
      <Tab.Screen name="Nutrition" component={NutritionScreen} options={{ title: t("nav.nutrition"), tabBarIcon: ({ color }) => <TabIcon name="Nutrition" color={color} /> }} />
      <Tab.Screen name="Steps"     component={StepsScreen}     options={{ title: t("nav.steps"),     tabBarIcon: ({ color }) => <TabIcon name="Steps"     color={color} /> }} />
      <Tab.Screen name="Hydration" component={HydrationScreen} options={{ title: t("nav.hydration"), tabBarIcon: ({ color }) => <TabIcon name="Hydration" color={color} /> }} />
      <Tab.Screen name="Sleep"     component={SleepScreen}     options={{ title: t("nav.sleep"),     tabBarIcon: ({ color }) => <TabIcon name="Sleep"     color={color} /> }} />
      <Tab.Screen
        name="PostureScreen"
        component={PostureScreen}
        options={{
          title: t("nav.posture"),
          tabBarButton: () => null,
        }}
      />
      <Tab.Screen name="Profile"   component={ProfileScreen}   options={{ title: t("nav.profile"),   tabBarIcon: ({ color }) => <TabIcon name="Profile"   color={color} /> }} />
    </Tab.Navigator>
  );
}

// ── Root stack (tabs + overlay screens like Friends) ─────────────────────────
export default function RootNavigator() {
  const { t } = useLanguage();
  const [menuOpen, setMenuOpen] = useState(false);

  const stackScreenOptions = {
    headerStyle: { backgroundColor: "#eef4e8" },
    headerTintColor: "#295c41",
    headerTitleStyle: { fontWeight: "800", color: "#14301f" },
    headerShadowVisible: false,
  };

  return (
    <>
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="MainTabs" options={{ headerShown: false }}>
          {() => <MainTabs menuOpen={menuOpen} setMenuOpen={setMenuOpen} />}
        </Stack.Screen>
        <Stack.Screen
          name="Friends"
          component={FriendsScreen}
          options={{ title: t("nav.friends"), headerShown: true }}
        />
        <Stack.Screen
          name="PostureHistory"
          component={PostureHistoryScreen}
          options={{ title: t("nav.postureHistory"), headerShown: true }}
        />
        <Stack.Screen
          name="PostureHistoryDetail"
          component={PostureHistoryDetailScreen}
          options={{ title: t("posture.history.detailTitle"), headerShown: true }}
        />
        <Stack.Screen
          name="PostureRecommendations"
          component={PostureRecommendationsScreen}
          options={{ title: t("posture.recommendations.title"), headerShown: true }}
        />
      </Stack.Navigator>
    </>
  );
}
