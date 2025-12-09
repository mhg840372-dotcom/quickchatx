// 📁 app/(tabs)/chat.tsx — ChatsList (QuickChatX 2025 FINAL)
import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";

import { useUser } from "@/contexts/AuthContext";
import { getChatsList } from "@/services/chatApi";
import { useSocket } from "../../hooks/useSocket";

import CryptoJS from "crypto-js";

const AES_KEY = "12345678901234567890123456789012";

export default function ChatsList() {
  const router = useRouter();
  const { user } = useUser();

  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const refreshChats = useCallback(async () => {
    if (!user) return;

    const decrypt = (cipher?: string) => {
      if (!cipher) return "";
      try {
        const bytes = CryptoJS.AES.decrypt(cipher, AES_KEY);
        return bytes.toString(CryptoJS.enc.Utf8) || "";
      } catch {
        return "";
      }
    };

    try {
      const res = await getChatsList();
      const rawList = Array.isArray(res) ? res : res?.data || [];

      const formatted = rawList.map((chat: any) => {
        const last = chat.lastMessage || {};
        let preview = "";

        if (last.type === "text" && last.text) {
          preview = decrypt(last.text);
        } else if (last.type === "image") preview = "📷 Imagen";
        else if (last.type === "video") preview = "🎥 Video";
        else if (last.type === "audio") preview = "🎤 Audio";

        return { ...chat, preview };
      });

      setChats(formatted);
    } catch (err) {
      console.log("❌ Error refreshChats:", err);
    }
  }, [user]);

  const { token } = useUser();

  useSocket({
    token,
    userId: user?._id || user?.id || null,
    onMessage: () => refreshChats(),
    onDeleted: () => refreshChats(),
    onRestored: () => refreshChats(),
    onRead: () => refreshChats(),
    onStatus: () => refreshChats(),
  });

  useEffect(() => {
    refreshChats().finally(() => setLoading(false));
  }, [refreshChats]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshChats();
    setRefreshing(false);
  };

  if (!user || loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <FlatList
      data={chats}
      keyExtractor={(item) => item.chatId}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      contentContainerStyle={{ paddingVertical: 10 }}
      renderItem={({ item }) => {
        const other = item.otherUser || {};
        const unread = item.unreadCount || 0;

        const name =
          other.firstName || other.lastName
            ? `${other.firstName || ""} ${other.lastName || ""}`.trim()
            : other.username || "Usuario";

        return (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/chat/${other._id}`)}
          >
            <Image
              source={{
                uri:
                  other.avatarUrl ||
                  "https://cdn-icons-png.flaticon.com/512/1077/1077012.png",
              }}
              style={styles.avatar}
            />

            <View style={styles.info}>
              <Text style={styles.name}>{name}</Text>
              <Text numberOfLines={1} style={styles.lastMsg}>
                {item.preview || "…"}
              </Text>
            </View>

            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unread > 99 ? "99+" : unread}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: {
    paddingHorizontal: 15,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  avatar: { width: 55, height: 55, borderRadius: 27.5, marginRight: 12 },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: "600", color: "#111" },
  lastMsg: { fontSize: 14, color: "#666", marginTop: 2 },
  badge: {
    backgroundColor: "#007AFF",
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  badgeText: { color: "#fff", fontWeight: "700" },
});
