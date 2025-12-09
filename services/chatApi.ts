// services/chatApi.ts — QuickChatX 2025 ULTRA FINAL FIXED
//-----------------------------------------------------

import { api } from "./api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const TOKEN_KEY = "qcxtoken";

/* ======================================================
   🔐 Verificar token
====================================================== */
const ensureToken = async () => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) {
    console.warn("⚠️ chatApi: No hay token");
    return false;
  }
  return true;
};

/* ======================================================
   📌 LISTA DE CHATS (UserActivity.chats)
====================================================== */
export const getChatsList = async () => {
  const ok = await ensureToken();
  if (!ok) return [];

  try {
    const res = await api.get("/user/activity/chats");
    return res.data?.data || [];
  } catch (err: any) {
    const status = err?.response?.status;
    if (status === 404) {
      // endpoint no disponible → devolvemos lista vacía sin log ruidoso
      return [];
    }
    console.log("❌ getChatsList:", err);
    return [];
  }
};

/* ======================================================
   📌 HISTORIAL PAGINADO
====================================================== */
export const getChatHistory = async (
  receiverId: string,
  page: number = 1,
  chatKey?: string
) => {
  const ok = await ensureToken();
  if (!ok) return [];

  try {
    const res = await api.get(`/chat/${receiverId}`, {
      params: { page, chatKey },
    });

    return res.data?.data || [];
  } catch (err) {
    console.log("❌ getChatHistory:", err);
    return [];
  }
};

/* ======================================================
   📌 ENVIAR MENSAJE (TEXTO)
====================================================== */
export const sendChatMessage = async (
  receiverId: string,
  encryptedText: string,
  chatKey?: string
) => {
  const ok = await ensureToken();
  if (!ok) return;

  try {
    return await api.post(`/chat/send/${receiverId}`, {
      text: encryptedText,
      chatKey: chatKey || undefined,
    });
  } catch (err) {
    console.log("❌ sendChatMessage:", err);
    throw err;
  }
};

/* ======================================================
   📌 ENVIAR MULTIMEDIA (800MB)
====================================================== */
export const sendChatMedia = async (
  receiverId: string,
  file: { uri: string; type: string; name?: string },
  chatKey?: string
) => {
  const ok = await ensureToken();
  if (!ok) return;

  const form = new FormData();

  let finalUri = file.uri;
  if (!finalUri.startsWith("file://") && !finalUri.startsWith("content://")) {
    finalUri = `file://${finalUri}`;
  }

  const extFromType =
    file.type?.includes("image")
      ? ".jpg"
      : file.type?.includes("video")
      ? ".mp4"
      : file.type?.includes("audio")
      ? ".mp3"
      : ".bin";

  const safeName = file.name || `media_${Date.now()}${extFromType}`;

  form.append("file", {
    uri: finalUri,
    type: file.type || "application/octet-stream",
    name: safeName,
  } as any);

  if (chatKey) form.append("chatKey", chatKey);

  try {
    return await api.post(`/chat/send/${receiverId}`, form, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      transformRequest: (data) => data,
      timeout: 240000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
  } catch (err) {
    console.log("❌ sendChatMedia:", err);
    throw err;
  }
};
