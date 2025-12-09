// 📁 app/chat/[id].tsx — QuickChatX 2025 FINAL ULTRA-STABLE

import { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

import CryptoJS from "crypto-js";
import { useLocalSearchParams, useRouter } from "expo-router";

import QuickPlayVideo from "@/components/QuickPlayVideo";
import {
    getChatHistory,
    sendChatMedia,
    sendChatMessage,
    type ChatMessage,
} from "@/services/chatApi";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSocket } from "../../hooks/useSocket";

import { CallActionModal } from "@/components/CallActionModal";
import GlobalHeader, { GLOBAL_HEADER_HEIGHT } from "@/components/GlobalHeader";
import { useUser } from "@/contexts/AuthContext";
import { startCall } from "@/services/api";
import * as ImagePicker from "expo-image-picker";

const AES_KEY = "12345678901234567890123456789012"; // misma clave que usas en resto del app

// ======================================================
// 🔐 Decrypt seguro (soporta texto ya plano o cifrado)
// ======================================================
const safeDecrypt = (value?: string | null): string => {
  if (!value) return "";
  try {
    const bytes = CryptoJS.AES.decrypt(value, AES_KEY);
    const plain = bytes.toString(CryptoJS.enc.Utf8);
    // Si no se pudo descifrar, devolvemos el original
    return plain || value;
  } catch {
    return value;
  }
};

export default function ChatScreen() {
  const { id: otherIdParam } = useLocalSearchParams();
  const otherId = Array.isArray(otherIdParam)
    ? otherIdParam[0]
    : (otherIdParam as string | undefined);

  const { user } = useUser();
  const router = useRouter();

  const insets = useSafeAreaInsets();
  const headerOffset = insets.top + GLOBAL_HEADER_HEIGHT;

  const flatRef = useRef<FlatList<ChatMessage & { text?: string }>>(null);

  // ----------------------------
  // STATE
  // ----------------------------
  const [messages, setMessages] = useState<(ChatMessage & { text?: string })[]>(
    []
  );
  const [input, setInput] = useState("");
  const [page, setPage] = useState(1);

  const [typing, setTyping] = useState(false);
  const [callModalVisible, setCallModalVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ----------------------------
  // SOCKET
  // ----------------------------
  const { token } = useUser();

  const { emitTyping, markAsRead } = useSocket({
    token,
    userId: user?._id || user?.id || null,
    onMessage: (msg: any) => {
      // Solo mensajes relacionados con este chat
      if (!otherId) return;

      if (msg.from === otherId || msg.to === otherId) {
        const base: ChatMessage & { text?: string } = {
          ...msg,
          // texto: usamos decryptedText si viene del backend con chatKey, o desciframos text
          text:
            msg.type === "text"
              ? safeDecrypt(msg.decryptedText || msg.text || msg.message)
              : undefined,
        };

        setMessages((prev) => [base, ...prev]);
      }
    },

    onTyping: (payload: any) => {
      if (payload?.from === otherId || !payload?.from) {
        setTyping(true);
        // pequeño timeout para esconder "Escribiendo..."
        setTimeout(() => setTyping(false), 1500);
      }
    },

    onStatus: () => {
      // Podrías refrescar el chat aquí si quisieras
    },
  });

  // ----------------------------
  // LOAD HISTORY
  // ----------------------------
  const loadHistory = async (pg = 1) => {
    if (!otherId) return;
    if (!user?._id) return;

    try {
      setLoadError(null);
      if (pg === 1) setLoading(true);

      const res = await getChatHistory(otherId, pg);

      const mapped = (res as ChatMessage[]).map((m) => ({
        ...m,
        text:
          m.type === "text"
            ? safeDecrypt((m as any).decryptedText || m.text)
            : undefined,
      }));

      if (pg === 1) {
        setMessages(mapped);
        // marcar como leídos el historial inicial
        const room = [String(user._id), String(otherId)].sort().join("_");
        markAsRead(room);
      } else {
        setMessages((prev) => [...prev, ...mapped]);
      }
    } catch (e: any) {
      setLoadError("No se pudo cargar el chat. Verifica tu conexión.");
    } finally {
      setLoading(false);
    }
  };

  // ----------------------------
  // INIT
  // ----------------------------
  useEffect(() => {
    if (!otherId || !user?._id) return;
    loadHistory(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherId, user?._id]);

  // ----------------------------
  // SEND TEXT
  // ----------------------------
  const sendText = async () => {
    if (!input.trim() || !otherId || !user?._id) return;

    // ciframos en frontend (modelo actual)
    const cipher = CryptoJS.AES.encrypt(input, AES_KEY).toString();

    const local: ChatMessage & { text?: string } = {
      _id: Date.now().toString(),
      from: String(user._id),
      to: String(otherId),
      type: "text",
      text: input,
      room: [String(user._id), String(otherId)].sort().join("_"),
    };

    setMessages((prev) => [local, ...prev]);
    setInput("");

    try {
      await sendChatMessage(otherId, cipher);
    } catch {
      Alert.alert("Error", "No se pudo enviar el mensaje.");
    }
  };

  // ----------------------------
  // SEND MEDIA
  // ----------------------------
  const pickMedia = async () => {
    if (!otherId || !user?._id) return;

    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.85,
      });

      if (res.canceled) return;

      const f = res.assets[0];

      const file = {
        uri: f.uri,
        type: f.type === "video" ? "video/mp4" : "image/jpeg",
        name: (f as any).fileName || `media_${Date.now()}`,
      };

      const uploaded = await sendChatMedia(otherId, file);
      const mediaUrl =
        uploaded?.data?.data?.mediaUrl ||
        uploaded?.data?.data?.mediaURL ||
        uploaded?.data?.data?.url ||
        uploaded?.data?.mediaUrl ||
        uploaded?.data?.url ||
        null;

      const local: ChatMessage & { text?: string } = {
        _id: Date.now().toString(),
        from: String(user._id),
        to: String(otherId),
        type: f.type === "video" ? "video" : "image",
        mediaUrl,
        room: [String(user._id), String(otherId)].sort().join("_"),
      };

      setMessages((prev) => [local, ...prev]);
    } catch (err) {
      console.log("❌ pickMedia error:", err);
      Alert.alert("Error", "No se pudo enviar el archivo.");
    }
  };

  // ----------------------------
  // RENDER MESSAGE
  // ----------------------------
  const renderMsg = ({ item }: { item: ChatMessage & { text?: string } }) => {
    const isMe = String(item.from) === String(user?._id);

    return (
      <View style={[styles.msg, isMe ? styles.my : styles.other]}>
        {item.type === "text" && !!item.text && (
          <Text style={styles.txt}>{item.text}</Text>
        )}

        {item.type === "image" && item.mediaUrl && (
          <Image source={{ uri: item.mediaUrl }} style={styles.image} />
        )}

        {item.type === "video" && item.mediaUrl && (
          <QuickPlayVideo
            uri={item.mediaUrl}
            autoPlay={false}
            loop={false}
            isVisible={true}
            style={styles.videoBubble}
          />
        )}
      </View>
    );
  };

  // ----------------------------
  // LOAD MORE (pagination fake: backend ignora page)
  // ----------------------------
  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    // Por ahora vuelve a pedir (backend actual no pagina, pero no rompe)
    loadHistory(next);
  };

  // ----------------------------
  // UI GUARDS
  // ----------------------------
  if (!otherId) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>No se pudo abrir el chat (ID inválido).</Text>
      </View>
    );
  }

  if (!user) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  // ----------------------------
  // MAIN UI
  // ----------------------------
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <GlobalHeader />

      <View style={{ flex: 1, paddingTop: headerOffset }}>
        {/* HEADER SIMPLE */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>←</Text>
          </TouchableOpacity>

          <View>
            <Text style={styles.headerName}>Chat con {otherId}</Text>
            <Text style={styles.headerStatus}>
              {typing ? "Escribiendo…" : "En línea"}
            </Text>
          </View>
        </View>

        {/* ERRORES DE CARGA */}
        {loadError ? (
          <View
            style={{
              flex: 1,
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
            }}
          >
            <Text style={{ color: "#d00", marginBottom: 8 }}>{loadError}</Text>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => {
                setPage(1);
                loadHistory(1);
              }}
            >
              <Text style={styles.btnTxt}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* CHAT LIST */}
            <FlatList
              ref={flatRef}
              data={messages}
              keyExtractor={(i, idx) => String(i._id || i.id || idx)}
              renderItem={renderMsg}
              inverted
              onEndReached={loadMore}
              onEndReachedThreshold={0.2}
              contentContainerStyle={{ padding: 10, flexGrow: 1 }}
            />

            {/* INPUT */}
            <View className="border-t border-gray-200" style={styles.row}>
              <TouchableOpacity onPress={pickMedia}>
                <Text style={styles.attach}>📎</Text>
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Escribe..."
                value={input}
                onChangeText={(t) => {
                  setInput(t);
                  emitTyping(otherId);
                }}
              />

              <TouchableOpacity style={styles.btn} onPress={sendText}>
                <Text style={styles.btnTxt}>Enviar</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* MODAL DE LLAMADAS */}
      <CallActionModal
        visible={callModalVisible}
        onClose={() => setCallModalVisible(false)}
        targetName={String(otherId)}
        targetAvatar={null}
        currentUserName={user?.username || user?.firstName || null}
        currentUserAvatar={
          user?.avatarUrl ||
          (user as any)?.profilePhoto ||
          (user as any)?.image ||
          null
        }
        onVoiceCall={() => {
          setCallModalVisible(false);
          startCall(String(otherId), "audio").catch(() =>
            Alert.alert("Error", "No se pudo iniciar la llamada.")
          );
        }}
        onVideoCall={() => {
          setCallModalVisible(false);
          startCall(String(otherId), "video").catch(() =>
            Alert.alert("Error", "No se pudo iniciar la videollamada.")
          );
        }}
        onMessage={() => setCallModalVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

// ----------------------------
// STYLES
// ----------------------------
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    padding: 12,
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#eee",
    gap: 12,
  },
  back: { fontSize: 26 },
  headerName: { fontSize: 16, fontWeight: "600" },
  headerStatus: { fontSize: 12, color: "gray" },

  msg: {
    marginVertical: 6,
    padding: 10,
    borderRadius: 12,
    maxWidth: "78%",
  },
  my: { backgroundColor: "#DCF8C6", alignSelf: "flex-end" },
  other: { backgroundColor: "#EEE", alignSelf: "flex-start" },
  txt: { fontSize: 15 },

  image: {
    width: 220,
    height: 220,
    borderRadius: 12,
    backgroundColor: "#ddd",
  },
  videoBubble: {
    width: 260,
    height: 340,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#000",
  },

  row: {
    flexDirection: "row",
    padding: 10,
    borderTopWidth: 1,
    borderColor: "#ddd",
    alignItems: "center",
    gap: 6,
  },
  attach: { fontSize: 26 },
  input: {
    flex: 1,
    backgroundColor: "#f1f1f1",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
  },
  btn: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 20,
    borderRadius: 20,
    justifyContent: "center",
    minHeight: 36,
  },
  btnTxt: { color: "#fff", fontWeight: "700" },
});
