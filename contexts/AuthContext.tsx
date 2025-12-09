// ======================================================
// 🧠 AuthContext.tsx — QuickChatX v12.1 ULTRA-STABLE (2025)
// ======================================================

import { User } from "@/types";
import { useRouter } from "expo-router";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";
import { AppState } from "react-native";
import {
    clearSession,
    getUserProfile,
    setAuthToken,
    setGlobalLogoutHandler,
} from "../services/api";
import { getSession, saveSession } from "../utils/authStorage";

type AuthContextType = {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (token: string, user: User) => Promise<void>;
  logout: (silent?: boolean) => Promise<void>;
  restoreSession: () => Promise<void>;
  setUserData: (user: User | null) => void;
  updateUser: (data: Partial<User>) => void;
  syncUserProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  // ======================================================
  // 🔁 Restaurar sesión — solo corre 1 vez
  // ======================================================
  const restoreSession = useCallback(async () => {
    try {
      const session = await getSession();

      if (session?.token && session?.user) {
        setToken(session.token);
        setUser(session.user);
        setAuthToken(session.token);

        if (__DEV__)
          console.log("🔑 Sesión restaurada:", session.user.username);
      } else {
        await clearSession();
        setToken(null);
        setUser(null);
        setAuthToken(null);
      }
    } catch (err) {
      console.warn("⚠️ Error restaurando sesión:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // 🔥 Solo se ejecuta UNA VEZ aquí
  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  // 🔥 Al volver a foreground solo valida que siga existiendo sesión
  useEffect(() => {
    const sub = AppState.addEventListener("change", async (state) => {
      if (state !== "active") return;

      try {
        const session = await getSession();
        if (!session?.token) {
          console.log("⚠️ Sesión inválida al volver — logout");
          logout(true);
        }
      } catch (err) {
        console.warn("⚠️ Error leyendo sesión al volver:", err);
        // En caso de duda, forzamos logout silencioso
        logout(true);
      }
    });

    return () => sub.remove();
  }, [logout]);

  // ======================================================
  // 🔓 Iniciar sesión
  // ======================================================
  const signIn = useCallback(
    async (newToken: string, newUser: User) => {
      try {
        setToken(newToken);
        setUser(newUser);
        setAuthToken(newToken);

        // Importante: persistir todo el objeto user (incluyendo safeAvatar)
        await saveSession(newToken, newUser);
        console.log("✅ Sesión iniciada:", newUser.username);

        setTimeout(() => {
          router.replace("/(tabs)");
        }, 200);
      } catch (err) {
        console.error("❌ Error en signIn:", err);
      }
    },
    [router]
  );

  // ======================================================
  // 🧩 Actualizar usuario parcialmente
  // ======================================================
  const updateUser = useCallback(
    (data: Partial<User>) => {
      setUser((prev) => {
        if (!prev) return prev;
        const updated: User = { ...prev, ...data };
        if (token) {
          // Persistimos el objeto merged para que mantenga avatar, safeAvatar, etc.
          saveSession(token, updated);
        }
        return updated;
      });
    },
    [token]
  );

  // ======================================================
  // 🧩 setUserData (reemplazo completo + persistencia)
  // ======================================================
  const setUserData = useCallback(
    (next: User | null) => {
      setUser(next);

      if (next && token) {
        // Guardamos el objeto tal cual lo envía el backend (incluye safeAvatar si viene)
        saveSession(token, next);
      } else if (!next) {
        clearSession();
      }
    },
    [token]
  );

  // ======================================================
  // 🔄 Sincronizar perfil con backend (/users/me)
  // ======================================================
  const syncUserProfile = useCallback(async () => {
    // Si no hay token no tiene sentido llamar al backend
    if (!token) return;

    try {
      const res = await getUserProfile();
      const payload: any = res?.data?.data || res?.data || res;

      const nextUser: User | null =
        payload?.user ||
        payload?.data?.user ||
        (payload && !Array.isArray(payload) ? payload : null);

      if (nextUser) {
        setUser((prev) => {
          const merged = prev ? { ...prev, ...nextUser } : nextUser;
          // Persistimos el merged (con safeAvatar, avatarUrl, etc.)
          if (token) saveSession(token, merged);
          return merged;
        });
      }
    } catch (err) {
      console.warn("⚠️ syncUserProfile falló:", err);
    }
  }, [token]);

  // ======================================================
  // 🚪 Logout
  // ======================================================
  const logout = useCallback(
    async (silent = false) => {
      if (isLoggingOut) {
        console.log("⚠️ Logout duplicado ignorado");
        return;
      }

      setIsLoggingOut(true);

      try {
        setToken(null);
        setUser(null);
        setAuthToken(null);

        await clearSession();
        console.log("🧹 Sesión limpiada");

        if (!silent) {
          setTimeout(() => router.replace("/(auth)/login"), 200);
        }
      } finally {
        // Pequeño delay para evitar rebotes si llegan varios eventos
        setTimeout(() => setIsLoggingOut(false), 800);
      }
    },
    [router, isLoggingOut]
  );

  // ======================================================
  // 🔒 Logout global desde api.ts
  // ======================================================
  useEffect(() => {
    setGlobalLogoutHandler(() => {
      console.warn("⚠️ Logout global ejecutado (token inválido)");
      logout(true);
      setTimeout(() => router.replace("/(auth)/login"), 300);
    });
  }, [logout, router]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      signIn,
      logout,
      restoreSession,
      setUserData,
      updateUser,
      syncUserProfile,
    }),
    [
      user,
      token,
      loading,
      signIn,
      logout,
      restoreSession,
      setUserData,
      updateUser,
      syncUserProfile,
    ]
  );

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
};

export const useUser = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useUser debe usarse dentro de AuthProvider");
  return ctx;
};

export { AuthContext };
