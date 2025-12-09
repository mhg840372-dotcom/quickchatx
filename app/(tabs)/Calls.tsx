import { CallActionModal } from "@/components/CallActionModal";
import { useUser } from "@/contexts/AuthContext";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import { useState } from "react";
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    useColorScheme,
    View,
} from "react-native";

interface Call {
  id: string;
  name: string;
  time: string;
  type: "incoming" | "outgoing" | "missed";
}

export default function CallsScreen() {
  const { user } = useUser();
  const theme = useColorScheme();
  const isDark = theme === "dark";

  const colors = {
    background: isDark ? "#121212" : "#f9f9f9",
    text: isDark ? "#ffffff" : "#111111",
    card: isDark ? "#1e1e1e" : "#ffffff",
    border: isDark ? "#333" : "#ddd",
  };

  const [contacts, setContacts] = useState<Contacts.Contact[]>([]);
  const [calls] = useState<Call[]>([
    {
      id: "1",
      name: "Carlos López",
      time: "10:42 AM",
      type: "incoming",
    },
    {
      id: "2",
      name: "María Pérez",
      time: "09:18 AM",
      type: "missed",
    },
    {
      id: "3",
      name: "Juan Torres",
      time: "Ayer, 7:55 PM",
      type: "outgoing",
    },
  ]);
  const [actionVisible, setActionVisible] = useState(false);
  const [targetName, setTargetName] = useState<string>("Contacto");

  // Abrir contactos del teléfono
  const openContacts = async () => {
    const { status } = await Contacts.requestPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permiso denegado", "No se puede acceder a los contactos");
      return;
    }

    const { data } = await Contacts.getContactsAsync({
      fields: [Contacts.Fields.PhoneNumbers],
    });

    if (data.length > 0) {
      setContacts(data);
      Alert.alert(
        "Contactos cargados",
        `Se han encontrado ${data.length} contactos`
      );
    } else {
      Alert.alert("Sin contactos", "No se encontraron contactos en el dispositivo");
    }
  };

  const openActions = (name: string) => {
    setTargetName(name || "Contacto");
    setActionVisible(true);
  };

  const renderCallItem = ({ item }: { item: Call }) => {
    const icon =
      item.type === "incoming"
        ? "call"
        : item.type === "outgoing"
        ? "call-outline"
        : "call-sharp";
    const color =
      item.type === "missed" ? "#e63946" : isDark ? "#00ff99" : "#007bff";

    return (
      <TouchableOpacity
        onPress={() => openActions(item.name)}
        style={[styles.callItem, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Ionicons name={icon as any} size={24} color={color} style={{ marginRight: 10 }} />
          <View>
            <Text style={[styles.callName, { color: colors.text }]}>{item.name}</Text>
            <Text style={[styles.callTime, { color: "#888" }]}>{item.time}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Botón de contactos */}
      <TouchableOpacity
        style={[styles.contactsButton, { backgroundColor: "#007bff" }]}
        onPress={openContacts}
      >
        <Ionicons name="people-outline" size={22} color="#fff" />
        <Text style={styles.contactsButtonText}>Contactos</Text>
      </TouchableOpacity>

      {/* Lista de llamadas */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Llamadas recientes</Text>

      <FlatList
        data={calls}
        keyExtractor={(item) => item.id}
        renderItem={renderCallItem}
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      />

      <CallActionModal
        visible={actionVisible}
        onClose={() => setActionVisible(false)}
        targetName={targetName}
        targetAvatar={null}
        currentUserName={user?.username || user?.firstName || null}
        currentUserAvatar={user?.avatarUrl || (user as any)?.profilePhoto || (user as any)?.image}
        onVoiceCall={() => {
          setActionVisible(false);
          Alert.alert("Llamada", `Iniciando llamada con ${targetName}`);
        }}
        onVideoCall={() => {
          setActionVisible(false);
          Alert.alert("Videollamada", `Iniciando videollamada con ${targetName}`);
        }}
        onMessage={() => {
          setActionVisible(false);
          Alert.alert("Mensaje", `Abrir chat con ${targetName}`);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 100,
    paddingHorizontal: 16,
  },
  contactsButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  contactsButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginLeft: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  callItem: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  callName: {
    fontSize: 16,
    fontWeight: "600",
  },
  callTime: {
    fontSize: 13,
    marginTop: 2,
  },
});
