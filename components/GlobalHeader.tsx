// src/components/GlobalHeader.tsx
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export const GLOBAL_HEADER_HEIGHT = 60;

export default function GlobalHeader() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const headerAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(0)).current;

  // Animación suave del título (igual al Home)
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(titleAnim, {
          toValue: -5,
          duration: 900,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
        Animated.timing(titleAnim, {
          toValue: 0,
          duration: 900,
          easing: Easing.ease,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <>
      {/* Fondo debajo de la StatusBar */}
      <View
        style={{
          height: insets.top,
          backgroundColor: "#fff",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 30,
        }}
      />

      {/* HEADER ANIMADO */}
      <Animated.View
        style={[
          styles.header,
          {
            top: insets.top,
            transform: [{ translateY: headerAnim }],
          },
        ]}
      >
        <View style={styles.row}>
          <Text></Text>

          <Animated.Text
            style={[
              styles.title,
              { transform: [{ translateY: titleAnim }] },
            ]}
          >
            QuickChatX
          </Animated.Text>

          <Ionicons
            name="settings-outline"
            size={28}
            color="#111"
            onPress={() => router.push("/(tabs)/settings")}
          />
        </View>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    height: GLOBAL_HEADER_HEIGHT,
    backgroundColor: "#fff",
    borderBottomWidth: 0.5,
    borderBottomColor: "#ddd",
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 25,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between", // título izquierda, ícono derecha
  },
  title: {
    fontSize: 24,
    fontFamily: "Pacifico_400Regular",
    color: "#000",
    textAlign: "left",
  },
});
