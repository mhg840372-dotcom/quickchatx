// 📁 hooks/useSocketChat.tsx — QuickChatX 2025 (TypeScript)

import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, type Socket } from "socket.io-client";

type SocketPayload = any; // luego lo afinamos si me pasas el shape real

type UseSocketChatParams = {
  onNewMessage?: (payload: SocketPayload) => void;
  onTyping?: (payload: SocketPayload) => void;
  onReadUpdate?: (payload: SocketPayload) => void;
  onStatusChange?: (payload: SocketPayload) => void;
};

type UseSocketChatReturn = {
  socket: Socket | null;
};

export function useSocketChat({
  onNewMessage,
  onTyping,
  onReadUpdate,
  onStatusChange,
}: UseSocketChatParams): UseSocketChatReturn {
  const ref = useRef<Socket | null>(null);

  useEffect(() => {
    let mounted = true;

    const connect = async () => {
      try {
        const token = await AsyncStorage.getItem("qcxtoken");
        if (!token) return;

        const socket: Socket = io("https://api.quickchatx.com/chats", {
          transports: ["websocket"],
          auth: { token },
          reconnection: true,
        });

        if (!mounted) {
          socket.disconnect();
          return;
        }

        ref.current = socket;

        // 📩 nuevo mensaje
        socket.on("NEW_MESSAGE", (payload: SocketPayload) => {
          onNewMessage?.(payload);
        });

        // ✏️ typing
        socket.on("typing", (payload: SocketPayload) => {
          onTyping?.(payload);
        });

        // 👁 mensaje leído
        socket.on("message_read", (payload: SocketPayload) => {
          onReadUpdate?.(payload);
        });

        // 🔁 cambio de estado
        socket.on("status_change", (payload: SocketPayload) => {
          onStatusChange?.(payload);
        });
      } catch (err) {
        console.warn("useSocketChat error:", err);
      }
    };

    connect();

    return () => {
      mounted = false;
      if (ref.current) {
        ref.current.disconnect();
        ref.current = null;
      }
    };
    // Queremos el mismo comportamiento que en JS: solo conectar una vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { socket: ref.current };
}
