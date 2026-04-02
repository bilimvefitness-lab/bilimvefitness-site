/**
 * Development-only analytics event inspector.
 * Shows locally stored events in reverse chronological order.
 */

import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { getStoredEvents, clearStoredEvents } from "../utils/analytics";

export default function AnalyticsDebugScreen() {
  const [events, setEvents] = useState([]);

  useFocusEffect(
    useCallback(() => {
      getStoredEvents().then((all) => setEvents([...all].reverse()));
    }, [])
  );

  function handleClear() {
    Alert.alert("Temizle", "Tüm analytics verileri silinsin mi?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          await clearStoredEvents();
          setEvents([]);
        },
      },
    ]);
  }

  function renderEvent({ item, index }) {
    const time = item.timestamp
      ? new Date(item.timestamp).toLocaleTimeString("tr-TR", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "—";
    const props = item.properties && Object.keys(item.properties).length > 0
      ? JSON.stringify(item.properties, null, 0)
      : null;

    return (
      <View style={styles.eventCard}>
        <View style={styles.eventHeader}>
          <Text style={styles.eventName}>{item.name}</Text>
          <Text style={styles.eventTime}>{time}</Text>
        </View>
        {props ? <Text style={styles.eventProps}>{props}</Text> : null}
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.toolbar}>
        <Text style={styles.title}>Analytics ({events.length})</Text>
        <Pressable style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearBtnText}>Temizle</Text>
        </Pressable>
      </View>

      {events.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Henüz event yok.</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(_, i) => String(i)}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#eef4e8",
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#d8e9dc",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#14301f",
  },
  clearBtn: {
    backgroundColor: "#c94040",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  clearBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
  list: {
    padding: 16,
    gap: 8,
    paddingBottom: 40,
  },
  eventCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    gap: 6,
  },
  eventHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  eventName: {
    fontSize: 14,
    fontWeight: "800",
    color: "#295c41",
  },
  eventTime: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7fa88a",
  },
  eventProps: {
    fontSize: 12,
    fontWeight: "500",
    color: "#4a6654",
    fontFamily: "monospace",
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#9ab09e",
    fontSize: 15,
  },
});
