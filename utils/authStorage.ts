// ======================================================
// 💾 authStorage — QuickChatX v12.0 Final (2025)
// ======================================================

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

export const TOKEN_KEY = "qcxtoken";
export const USER_KEY = "qcxuser";
const DEVICE_KEY = "DEVICE_AES_KEY";

export type User = Record<string, any>;

const hexToBytes = (hex: string) => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2)
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
};

// 🔐 Clave del dispositivo
export const getDeviceKey = async () => {
  let key = await AsyncStorage.getItem(DEVICE_KEY);
  if (!key) {
    const bytes = await Crypto.getRandomBytesAsync(32);
    key = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    await AsyncStorage.setItem(DEVICE_KEY, key);
  }
  return key;
};

// 🔒 Guardar sesión
export const saveSession = async (token: string, user: User) => {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
};

// 🔁 Obtener sesión
export const getSession = async () => {
  const [token, userStr] = await Promise.all([
    AsyncStorage.getItem(TOKEN_KEY),
    AsyncStorage.getItem(USER_KEY),
  ]);

  let user = null;
  if (userStr) {
    try {
      user = JSON.parse(userStr);
    } catch {
      await AsyncStorage.removeItem(USER_KEY);
    }
  }

  return { token, user };
};

// 🧹 Clear
export const clearSession = async () => {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
};
