import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated";

export default function AppHeader() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      {/* ✅ Barra de estado visible (hora, red, batería, etc.) */}
      <StatusBar style="dark" translucent backgroundColor="transparent" />

      {/* 🔝 Header principal */}
      <View style={styles.headerContainer}>
        <Text style={styles.appTitle}>QuickChatX</Text>

        <TouchableOpacity
          onPress={() => setShowModal(true)}
          style={styles.settingsButton}
        >
          <Ionicons name="settings-outline" size={24} color="#007bff" />
        </TouchableOpacity>
      </View>

      {/* ⚙️ Modal de configuración */}
      <Modal
        visible={showModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable
          style={styles.overlay}
          onPress={() => setShowModal(false)}
        />
        <Animated.View
          entering={FadeInDown.springify().damping(12)}
          exiting={FadeOutUp}
          style={styles.modalContainer}
        >
          <Text style={styles.modalTitle}>Configuración</Text>

          <View style={styles.optionRow}>
            <Ionicons name="moon-outline" size={22} color="#007bff" />
            <Text style={styles.optionText}>Modo oscuro</Text>
          </View>

          <View style={styles.optionRow}>
            <Ionicons name="notifications-outline" size={22} color="#007bff" />
            <Text style={styles.optionText}>Notificaciones</Text>
          </View>

          <View style={styles.optionRow}>
            <Ionicons name="information-circle-outline" size={22} color="#007bff" />
            <Text style={styles.optionText}>Acerca de</Text>
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingTop: 50, // margen para la barra de estado
    paddingHorizontal: 20,
    paddingBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    borderBottomWidth: 0.3,
    borderBottomColor: "#ccc",
  },
  appTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#007bff",
  },
  settingsButton: {
    padding: 6,
    borderRadius: 10,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalContainer: {
    position: "absolute",
    right: 20,
    top: 100,
    width: 220,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#333",
    marginBottom: 12,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
  },
  optionText: {
    marginLeft: 10,
    fontSize: 15,
    color: "#333",
  },
});
