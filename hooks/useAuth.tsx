// ======================================================
// 🧠 useAuth.ts — QuickChatX v12.0 (2025)
// ======================================================

import { useContext, useEffect, useRef } from "react";
import { AuthContext } from "../contexts/AuthContext";
import { api, clearSession } from "../services/api";
import { clearFeedCache } from "../utils/feedCache";

export function useAuth() {
  const context = useContext(AuthContext);
  const isLoggingOut = useRef(false);

  if (!context) throw new Error("useAuth debe usarse dentro de AuthProvider");

  const { logout } = context;

  // 🔐 Interceptor de auto-logout
  useEffect(() => {
    const interceptor = api.interceptors.response.use(
      (res) => res,
      async (error) => {
        const status = error?.response?.status;
        const url: string = error?.config?.url || "";
        const hasAuthHeader = Boolean(
          error?.config?.headers?.Authorization ||
            error?.config?.headers?.authorization
        );

        // Evita auto-logout cuando la respuesta viene de login/register
        if (url.includes("login") || url.includes("register")) {
          return Promise.reject(error);
        }

        if (
          (status === 401 || status === 403) &&
          !isLoggingOut.current &&
          hasAuthHeader
        ) {
          console.warn("⚠️ Token inválido — Auto Logout");
          isLoggingOut.current = true;
          try {
            await clearSession();
            await clearFeedCache();
            await logout(true);
          } finally {
            setTimeout(() => (isLoggingOut.current = false), 2000);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => api.interceptors.response.eject(interceptor);
  }, [logout]);

  return context;
}
