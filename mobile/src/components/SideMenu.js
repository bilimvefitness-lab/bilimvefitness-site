/**
 * SideMenu — left-side slide-over menu.
 *
 * Intentionally avoids @react-navigation/drawer and react-native-reanimated
 * to prevent the iOS NativeWorklets crash.
 *
 * Uses only React Native's built-in Animated API and Modal.
 */

import React, { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { navigate, getCurrentRouteName } from "../navigation/NavigationService";
import { useLanguage } from "../i18n";

const MENU_WIDTH = 280;

const MENU_ITEMS = [
  { name: "Home", icon: "\u25c9", labelKey: "sidemenu.items.home" },
  { name: "Nutrition", icon: "\u25ce", labelKey: "sidemenu.items.nutrition" },
  { name: "Steps", icon: "\u25a4", labelKey: "sidemenu.items.steps" },
  { name: "Hydration", icon: "\u25c8", labelKey: "sidemenu.items.hydration" },
  { name: "Sleep", icon: "\u25d1", labelKey: "sidemenu.items.sleep" },
  { name: "PostureScreen", icon: "\u25eb", labelKey: "sidemenu.items.posture" },
  { name: "Friends", icon: "\u25c8", labelKey: "sidemenu.items.friends" },
  { name: "Profile", icon: "\u25d0", labelKey: "sidemenu.items.profile" },
];

export default function SideMenu({ visible, onClose }) {
  const { t } = useLanguage();

  const menuItems = MENU_ITEMS.map((item) => ({
    ...item,
    label: item.label ?? t(item.labelKey),
  }));
  const slideAnim = useRef(new Animated.Value(-MENU_WIDTH)).current;
  const fadeAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 20,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0.5,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: -MENU_WIDTH,
          useNativeDriver: true,
          bounciness: 0,
          speed: 20,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  function handleNavigate(screenName) {
    onClose();
    // Small delay so the menu slides out before navigation repaints
    setTimeout(() => navigate(screenName), 50);
  }

  const currentRoute = getCurrentRouteName();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Dim backdrop */}
      <Animated.View
        style={[styles.backdrop, { opacity: fadeAnim }]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      {/* Slide panel */}
      <Animated.View
        style={[
          styles.panel,
          { transform: [{ translateX: slideAnim }] },
        ]}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Brand header */}
          <View style={styles.header}>
            <Text style={styles.brandTitle}>B&amp;F Fitness</Text>
            <Text style={styles.brandSub}>{t("sidemenu.brandSub")}</Text>
          </View>

          <View style={styles.divider} />

          {/* Menu items */}
          {menuItems.map((item) => {
            const active = currentRoute === item.name;
            return (
              <Pressable
                key={item.name}
                style={[styles.menuItem, active && styles.menuItemActive]}
                onPress={() => handleNavigate(item.name)}
              >
                <Text style={[styles.menuIcon, active && styles.menuIconActive]}>
                  {item.icon}
                </Text>
                <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: MENU_WIDTH,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
    elevation: 16,
  },
  content: {
    paddingTop: 10,
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 56,
    paddingBottom: 28,
    gap: 4,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#14301f",
    letterSpacing: -0.5,
  },
  brandSub: {
    fontSize: 14,
    fontWeight: "800",
    color: "#7fa88a",
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f7f1",
    marginHorizontal: 24,
    marginBottom: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 4,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuItemActive: {
    backgroundColor: "#f4faf5",
    borderLeftWidth: 4,
    borderLeftColor: "#295c41",
  },
  menuIcon: {
    fontSize: 20,
    color: "#9ab09e",
    width: 28,
    textAlign: "center",
  },
  menuIconActive: {
    color: "#295c41",
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#4a6654",
  },
  menuLabelActive: {
    color: "#14301f",
    fontWeight: "900",
  },
});
