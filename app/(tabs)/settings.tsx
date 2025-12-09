import { Ionicons } from "@expo/vector-icons";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function SettingsScreen() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Configuración</Text>
      <Text style={styles.subtitle}>Ajustes de tu cuenta y preferencias</Text>

      <View style={styles.section}>
        <TouchableOpacity style={styles.item}>
          <Ionicons name="person-circle-outline" size={22} color="#050505ff" />
          <Text style={styles.itemText}>Cuenta</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item}>
          <Ionicons name="notifications-outline" size={22} color="#050505ff" />
          <Text style={styles.itemText}>Notificaciones</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item}>
          <Ionicons name="color-palette-outline" size={22} color="#050505ff" />
          <Text style={styles.itemText}>Apariencia</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item}>
          <Ionicons name="language-outline" size={22} color="#050505ff" />
          <Text style={styles.itemText}>Idioma</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.item}>
          <Ionicons name="lock-closed-outline" size={22} color="#050505ff" />
          <Text style={styles.itemText}>Privacidad</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.logoutButton}>
        <Ionicons name="exit-outline" size={20} color="#fff" />
        <Text style={styles.logoutText}>Cerrar sesión</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 110,
    paddingHorizontal: 20,
    backgroundColor: "#fff",
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#666",
    marginBottom: 20,
  },
  section: {
    borderTopWidth: 1,
    borderColor: "#eee",
    paddingTop: 10,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
  },
  itemText: {
    fontSize: 16,
    color: "#333",
    marginLeft: 12,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#050505ff",
    borderRadius: 10,
    marginTop: 50,
    paddingVertical: 14,
  },
  logoutText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 6,
  },
});
