/**
 * Custom drawer content for the app.
 */

import { DrawerContentScrollView, DrawerItem } from "@react-navigation/drawer";
import { StyleSheet, Text, View } from "react-native";
import { useLanguage } from "../i18n";

export default function DrawerContent(props) {
  const { t } = useLanguage();
  const currentRoute = props.state?.routes?.[props.state.index]?.name;

  const menuItems = [
    { name: "Home",      label: t("sidemenu.items.home"),      icon: "◉" },
    { name: "Profile",   label: t("sidemenu.items.profile"),   icon: "◐" },
    { name: "Nutrition", label: t("sidemenu.items.nutrition"), icon: "◎" },
    { name: "Hydration", label: t("sidemenu.items.hydration"), icon: "◈" },
    { name: "Steps",     label: t("sidemenu.items.steps"),     icon: "▤" },
    { name: "Sleep",     label: t("sidemenu.items.sleep"),     icon: "◑" },
  ];

  return (
    <DrawerContentScrollView {...props} style={styles.container} contentContainerStyle={styles.content}>
      {/* Brand header */}
      <View style={styles.header}>
        <Text style={styles.brandTitle}>B&F Fitness</Text>
        <Text style={styles.brandSub}>{t("sidemenu.brandSub")}</Text>
      </View>

      <View style={styles.divider} />

      {/* Menu items */}
      {menuItems.map((item) => {
        const active = currentRoute === item.name;
        return (
          <DrawerItem
            key={item.name}
            label={() => (
              <View style={styles.menuRow}>
                <Text style={[styles.menuIcon, active && styles.menuIconActive]}>{item.icon}</Text>
                <Text style={[styles.menuLabel, active && styles.menuLabelActive]}>{item.label}</Text>
              </View>
            )}
            onPress={() => props.navigation.navigate(item.name)}
            style={[styles.menuItem, active && styles.menuItemActive]}
          />
        );
      })}
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    paddingTop: 10,
  },
  header: {
    paddingHorizontal: 28,
    paddingTop: 40,
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
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
  },
  menuIcon: {
    fontSize: 22,
    color: "#9ab09e",
    width: 32,
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
  menuItem: {
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  menuItemActive: {
    backgroundColor: "#f4faf5",
    borderLeftWidth: 5,
    borderLeftColor: "#295c41",
  },
});
