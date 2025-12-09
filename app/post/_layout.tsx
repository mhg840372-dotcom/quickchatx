// ======================================================
// 📄 app/post/_layout.tsx — FIX v3.5 (FINAL)
// ✅ Elimina fondo blanco doble o solapado
// ✅ Mantiene animación suave del header
// ✅ Compatible con el nuevo GlobalHeader (v3.8)
// ======================================================

import GlobalHeader from "@/components/GlobalHeader";
import { PostScrollProvider } from "@/contexts/PostScrollContext";
import { Stack } from "expo-router";
import { useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";

export default function PostLayout() {
  const headerAnim = useRef(new Animated.Value(0)).current;

  const handleDirection = (dir: "up" | "down") => {
    Animated.timing(headerAnim, {
      toValue: dir === "down" ? -56 : 0,
      duration: 150,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.container}>
      <PostScrollProvider onDirection={handleDirection}>
        {/* ✅ Header global, visible sobre todo */}
        <Animated.View
          style={[
            styles.headerWrapper,
            { transform: [{ translateY: headerAnim }] },
          ]}
        >
          <GlobalHeader />
        </Animated.View>

        {/* ✅ Contenido del stack (sin header duplicado) */}
        <Stack screenOptions={{ headerShown: false }} />
      </PostScrollProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff", // Fondo base, no interfiere con header
  },
  headerWrapper: {
    zIndex: 9999, // 🔥 garantiza que siempre quede arriba
    elevation: 8, // para Android
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: "transparent", // ❗ evita capa blanca sobre íconos
  },
});
