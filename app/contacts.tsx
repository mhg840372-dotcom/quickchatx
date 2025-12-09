import GlobalHeader, { GLOBAL_HEADER_HEIGHT } from "@/components/GlobalHeader";
import { Ionicons } from "@expo/vector-icons";
import * as Contacts from "expo-contacts";
import { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ContactsScreen() {
  const insets = useSafeAreaInsets();
  const [contacts, setContacts] = useState<Contacts.ExistingContact[]>([]);
  const headerOffset = insets.top + GLOBAL_HEADER_HEIGHT;

  useEffect(() => {
    (async () => {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permiso denegado", "No se puede acceder a los contactos");
        return;
      }

      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.PhoneNumbers],
      });
      if (data.length > 0) setContacts(data);
    })();
  }, []);

  const handleCall = async (contact: Contacts.ExistingContact) => {
    Alert.alert(
      "Llamando...",
      `${contact.name}\n(${contact.phoneNumbers?.[0]?.number ?? "sin número"})`
    );
  };

  const renderContact = ({ item }: { item: Contacts.ExistingContact }) => (
    <TouchableOpacity style={styles.contactItem} onPress={() => handleCall(item)}>
      <Ionicons name="call-outline" size={22} color="#007bff" style={{ marginRight: 10 }} />
      <Text style={styles.contactName}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: headerOffset }]}>
      <GlobalHeader />

      <Text style={styles.header}>Selecciona un contacto</Text>

      <FlatList
        data={contacts}
        keyExtractor={(item) => item.id}
        renderItem={renderContact}
        contentContainerStyle={{ paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    paddingHorizontal: 16,
  },
  header: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 16,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    paddingVertical: 12,
  },
  contactName: {
    fontSize: 16,
    color: "#111",
  },
});
