import { resolveAvatarUrl } from "@/utils/avatar";
import { Image, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  targetName?: string;
  targetAvatar?: string | null;
  currentUserName?: string | null;
  currentUserAvatar?: string | null;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onMessage?: () => void;
};

export function CallActionModal({
  visible,
  onClose,
  targetName = "Contacto",
  targetAvatar = null,
  currentUserName = null,
  currentUserAvatar = null,
  onVoiceCall,
  onVideoCall,
  onMessage,
}: Props) {
  const targetAvatarUrl =
    resolveAvatarUrl(targetAvatar) ||
    "https://cdn-icons-png.flaticon.com/512/149/149071.png";
  const currentAvatarUrl =
    resolveAvatarUrl(currentUserAvatar) ||
    "https://cdn-icons-png.flaticon.com/512/1077/1077012.png";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Acciones con {targetName}</Text>

          <View style={styles.participants}>
            <View style={styles.participant}>
              <Image source={{ uri: currentAvatarUrl }} style={styles.avatar} />
              <Text style={styles.participantText}>
                Tú{currentUserName ? ` • ${currentUserName}` : ""}
              </Text>
            </View>
            <View style={styles.participant}>
              <Image source={{ uri: targetAvatarUrl }} style={styles.avatar} />
              <Text style={styles.participantText}>{targetName}</Text>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.primary]}
              onPress={onVoiceCall}
            >
              <Text style={styles.buttonText}>Llamada</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.secondary]}
              onPress={onVideoCall}
            >
              <Text style={styles.buttonText}>Videollamada</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.ghost]}
              onPress={onMessage}
            >
              <Text style={[styles.buttonText, { color: "#111" }]}>
                Enviar mensaje
              </Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.close}>
            <Text style={styles.closeText}>Cerrar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#fff",
    padding: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    minHeight: 220,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 12,
    color: "#111",
  },
  participants: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  participant: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#eee" },
  participantText: { color: "#111", fontWeight: "600" },
  actions: {
    gap: 10,
  },
  button: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  primary: { backgroundColor: "#111" },
  secondary: { backgroundColor: "#007bff" },
  ghost: { backgroundColor: "#f4f4f5" },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  close: { marginTop: 10, alignItems: "center" },
  closeText: { color: "#007bff", fontWeight: "600" },
});
