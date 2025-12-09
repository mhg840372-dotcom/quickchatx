// ======================================================
// 🧱 app/_layout.tsx — ROOT LAYOUT GLOBAL (FIX v5.1)
// 🚀 SuccessScreen NO se redirige al login
// ======================================================

import { AuthProvider, useUser } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/theme/themes";
import { Slot, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StatusBar, View, StyleSheet } from "react-native";

function AuthGate() {
  const { token, loading } = useUser();
  const segments = useSegments(); // p.ej: ["(auth)", "SuccessScreen"]
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const rootGroup = segments?.[0]; // "(auth)", "(tabs)", etc.
    const leaf = segments?.[1]; // "login", "register", "SuccessScreen", etc.

    // Si todavía no hay rootGroup (carga inicial), no hacer nada
    if (!rootGroup) {
      return;
    }

    const inAuth = rootGroup === "(auth)";

    // 📌 Pantalla especial: SuccessScreen NO debe ser interceptada
    const isSuccessScreen = inAuth && leaf === "SuccessScreen";

    // 🛑 Si estamos en SuccessScreen → NO hacer ninguna redirección
    if (isSuccessScreen) {
      return;
    }

    // ⛔ Sin token → enviar a login (excepto si ya estás en auth)
    if (!token) {
      if (!inAuth) {
        router.replace("/(auth)/login");
      }
      return;
    }

    // 🔐 Con token → no permitimos volver a las pantallas de auth
    if (token && inAuth) {
      router.replace("/(tabs)");
      return;
    }
  }, [segments, token, loading, router]);

  // Loader inicial
  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />
      <Slot />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AuthGate />
      </AuthProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
});
