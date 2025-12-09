// 📁 hooks/useWebSocket.tsx — QuickChatX 2025 (TypeScript)

import { useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const WS_URL = "wss://api.quickchatx.com/ws"; // ajusta según tu backend

// Tipos básicos (ajustables si luego tienes tipos reales)
type WebSocketStatus = "connected" | "disconnected";

type UseWebSocketParams = {
  onMessage?: (msg: any) => void;
  onTyping?: (msg: any) => void;
  onNotification?: (msg: any) => void;
  onStatusChange?: (status: WebSocketStatus) => void;
};

type UseWebSocketReturn = {
  socket: WebSocket | null;
  sendMessage: (data: any) => void;
  isConnected: boolean;
};

export function useWebSocket({
  onMessage,
  onTyping,
  onNotification,
  onStatusChange,
}: UseWebSocketParams): UseWebSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttempts = useRef(0);

  const [isConnected, setIsConnected] = useState(false);

  // Enviar mensajes de forma segura
  const sendMessage = (data: any) => {
    try {
      if (
        wsRef.current &&
        wsRef.current.readyState === WebSocket.OPEN
      ) {
        wsRef.current.send(JSON.stringify(data));
      } else {
        console.warn("⚠️ No se puede enviar, WS no conectado");
      }
    } catch (error) {
      console.error("❌ Error enviando mensaje:", error);
    }
  };

  const startWebSocket = async () => {
    const token = await AsyncStorage.getItem("qcxtoken");
    if (!token) {
      console.warn("⚠️ No hay token almacenado para WS");
      return;
    }

    console.log("🔌 Conectando a WebSocket:", WS_URL);
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("✅ WebSocket conectado");
      setIsConnected(true);
      onStatusChange?.("connected");

      reconnectAttempts.current = 0; // restart counter

      // 🔐 Enviar autenticación
      sendMessage({ type: "auth", token });

      // 🔄 Ping cada 25 segundos para evitar desconexión
      (ws as any).pingInterval = setInterval(() => {
        sendMessage({ type: "ping" });
      }, 25000);
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data as string);

        switch (msg.type) {
          case "auth_success":
            console.log("🔐 WS autenticado correctamente");
            break;

          case "chat_message":
            onMessage?.(msg);
            break;

          case "typing":
            onTyping?.(msg);
            break;

          case "notification":
            onNotification?.(msg);
            break;

          case "pong":
            // conexión viva
            break;

          case "error":
            console.warn("⚠️ WS Error:", msg.message);
            break;

          default:
            console.log("📩 WS Evento sin manejar:", msg);
            break;
        }
      } catch (err: any) {
        console.error("❌ Error procesando WS:", err?.message || err);
      }
    };

    ws.onerror = (error: Event) => {
      console.error(
        "💥 Error WebSocket:",
        (error as any)?.message || error
      );
    };

    ws.onclose = () => {
      console.log("❌ WebSocket cerrado");
      setIsConnected(false);
      onStatusChange?.("disconnected");

      const pingInterval = (ws as any).pingInterval;
      if (pingInterval) clearInterval(pingInterval);

      // Intento de reconexión exponencial
      const delay = Math.min(10000, 1000 * 2 ** reconnectAttempts.current);
      reconnectAttempts.current++;

      console.log(`♻️ Reintentando en ${delay / 1000}s...`);

      reconnectTimeout.current = setTimeout(() => {
        startWebSocket();
      }, delay);
    };
  };

  useEffect(() => {
    startWebSocket();

    return () => {
      console.log("🔻 Cerrando WebSocket por cleanup");
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) wsRef.current.close();
    };
    // Queremos el mismo comportamiento que en la versión JS: solo una vez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    socket: wsRef.current,
    sendMessage,
    isConnected,
  };
}
