// 📁 app/hooks/useSocket.tsx — QuickChatX v2025.11
// ------------------------------------------------------
// ✔ Totalmente compatible con SocketService v10.8
// ✔ Tipos refinados
// ✔ Handlers de chat + llamadas
// ✔ Limpieza automática de listeners
// ✔ No rompe nada de tu frontend actual
// ------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { io, type Socket } from "socket.io-client";

const SERVER_URL = "https://api.quickchatx.com";
const CHAT_NS = "/chats";
const CALL_NS = "/calls";

// ======================================================
// 🔥 Tipos
// ======================================================
export interface ChatMessagePayload {
  _id: string;
  from: string;
  to: string;
  text: string;
  decryptedText?: string;
  type: "text" | "image" | "video" | "audio" | "file";
  mediaUrl?: string | null;
  timestamp: string;
  deleted?: boolean;
  read?: boolean;
}

export interface TypingPayload {
  from: string;
}

export interface DeletePayload {
  messageId: string;
  room: string;
  deletedBy: string;
  deletedAt: string;
}

export interface RestorePayload {
  messageId: string;
  room: string;
  restoredBy: string;
}

export interface ReadPayload {
  room: string;
}

export type SocketStatus = "connected" | "disconnected";

export interface IncomingCallPayload {
  callId: string;
  from: string;
  type: "audio" | "video";
  participants: string[];
  startedAt: string;
}

export interface CallEventPayload {
  callId: string;
  acceptedBy?: string;
  rejectedBy?: string;
  endedBy?: string;
  duration?: number;
}

// ======================================================
// 🧠 Parametros del hook
// ======================================================
type UseSocketParams = {
  token?: string | null;
  userId?: string | null;
  onMessage?: (msg: ChatMessagePayload) => void;
  onTyping?: (payload: TypingPayload) => void;
  onStatus?: (status: SocketStatus) => void;
  onDeleted?: (payload: DeletePayload) => void;
  onRestored?: (payload: RestorePayload) => void;
  onRead?: (payload: ReadPayload) => void;

  // 📞 Llamadas (opcional)
  onIncomingCall?: (payload: IncomingCallPayload) => void;
  onCallAccepted?: (payload: CallEventPayload) => void;
  onCallRejected?: (payload: CallEventPayload) => void;
  onCallEnded?: (payload: CallEventPayload) => void;
};

// ======================================================
// 🔥 Valor de retorno
// ======================================================
type UseSocketReturn = {
  chat: Socket | null;
  calls: Socket | null;
  connected: boolean;

  emitTyping: (to: string) => void;
  markAsRead: (room: string) => void;

  // Llamadas
  startCall: (to: string, type?: "audio" | "video") => void;
  acceptCall: (callId: string) => void;
  rejectCall: (callId: string) => void;
  endCall: (callId: string) => void;
};

// ======================================================
// 🚀 Hook principal
// ======================================================
export function useSocket({
  token: tokenProp,
  userId: userIdProp,
  onMessage,
  onTyping,
  onStatus,
  onDeleted,
  onRestored,
  onRead,
  onIncomingCall,
  onCallAccepted,
  onCallRejected,
  onCallEnded,
}: UseSocketParams): UseSocketReturn {
  const chatRef = useRef<Socket | null>(null);
  const callRef = useRef<Socket | null>(null);
  const warnedRef = useRef(false);

  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let mounted = true;

    const connectSockets = async () => {
      const token =
        tokenProp ?? (await AsyncStorage.getItem("qcxtoken"));

      let userId =
        userIdProp ?? (await AsyncStorage.getItem("qcx_user_id"));

      // Fallback: obtener userId del objeto completo guardado en qcxuser
      if (!userId) {
        const rawUser = await AsyncStorage.getItem("qcxuser");
        if (rawUser) {
          try {
            const parsed = JSON.parse(rawUser);
            userId = parsed?._id || parsed?.id || null;
          } catch {
            userId = null;
          }
        }
      }

      if (!token || !userId) {
        if (__DEV__ && !warnedRef.current) {
          console.warn("⚠️ useSocket: Falta token o userId");
          warnedRef.current = true;
        }
        // Asegura desconexión si perdemos credenciales
        chatRef.current?.disconnect();
        chatRef.current = null;
        callRef.current?.disconnect();
        callRef.current = null;
        setConnected(false);
        return;
      }
      warnedRef.current = false;

      // ======================================================
      // 💬 CHAT SOCKET
      // ======================================================
      const chat = io(`${SERVER_URL}${CHAT_NS}`, {
        transports: ["websocket"],
        reconnection: true,
        forceNew: true,
        timeout: 20000,
        auth: { token },
        query: { userId },
      });

      chatRef.current = chat;

      chat.on("connect", () => {
        if (!mounted) return;
        console.log("🟢 Chat conectado:", chat.id);
        setConnected(true);
        onStatus?.("connected");
      });

      chat.on("disconnect", (reason) => {
        if (!mounted) return;
        console.log("🔴 Chat desconectado:", reason);
        setConnected(false);
        onStatus?.("disconnected");
      });

      // Mensaje nuevo
      chat.on("NEW_MESSAGE", (msg: ChatMessagePayload) => {
        onMessage?.(msg);
      });

      // typing
      chat.on("typing", (data: TypingPayload) => {
        onTyping?.(data);
      });

      // delete
      chat.on("message_deleted", (p: DeletePayload) => {
        onDeleted?.(p);
      });

      // restore
      chat.on("message_restored", (p: RestorePayload) => {
        onRestored?.(p);
      });

      // read receipts
      chat.on("messages_read", (p: ReadPayload) => {
        onRead?.(p);
      });

      // ======================================================
      // 📞 CALL SOCKET
      // ======================================================
      const calls = io(`${SERVER_URL}${CALL_NS}`, {
        transports: ["websocket"],
        reconnection: true,
        forceNew: true,
        timeout: 20000,
        auth: { token },
        query: { userId },
      });

      callRef.current = calls;

      calls.on("INCOMING_CALL", (payload: IncomingCallPayload) => {
        onIncomingCall?.(payload);
      });

      calls.on("CALL_ACCEPTED", (payload: CallEventPayload) => {
        onCallAccepted?.(payload);
      });

      calls.on("CALL_REJECTED", (payload: CallEventPayload) => {
        onCallRejected?.(payload);
      });

      calls.on("CALL_ENDED", (payload: CallEventPayload) => {
        onCallEnded?.(payload);
      });
    };

    connectSockets();

    return () => {
      mounted = false;

      chatRef.current?.disconnect();
      chatRef.current = null;

      callRef.current?.disconnect();
      callRef.current = null;
    };
  }, [tokenProp, userIdProp]);

  // ======================================================
  // ✏️ typing
  // ======================================================
  const emitTyping = (to: string) => {
    chatRef.current?.emit("typing", { to });
  };

  // ======================================================
  // 👁 mensajes leídos
  // ======================================================
  const markAsRead = (room: string) => {
    chatRef.current?.emit("mark_read", { room });
  };

  // ======================================================
  // 📞 Llamadas
  // ======================================================
  const startCall = (to: string, type: "audio" | "video" = "audio") => {
    callRef.current?.emit("start_call", { receiverId: to, type });
  };

  const acceptCall = (callId: string) => {
    callRef.current?.emit("accept_call", { callId });
  };

  const rejectCall = (callId: string) => {
    callRef.current?.emit("reject_call", { callId });
  };

  const endCall = (callId: string) => {
    callRef.current?.emit("end_call", { callId });
  };

  return {
    chat: chatRef.current,
    calls: callRef.current,
    connected,
    emitTyping,
    markAsRead,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
  };
}
