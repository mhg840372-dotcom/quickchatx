// ======================================================
// 🎉 SuccessScreen.tsx — QuickChatX v12.0 PRO
// ------------------------------------------------------
// ✔ Sin restoreSession() → no duplica sesión
// ✔ updateUser + saveSession coherentes
// ✔ Navegación estable sin rebote
// ✔ Protección contra múltiples ejecuciones
// ======================================================

import { useTheme } from "@/theme/themes";
import { useLocalSearchParams, useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { saveSession } from "../../utils/authStorage";
// GlobalHeader removido en pantallas de auth

export default function SuccessScreen() {
  const router = useRouter();
  const theme = useTheme();
  const params = useLocalSearchParams();
  const { updateUser, signIn } = useAuth();
  const insets = useSafeAreaInsets();

  const [executed, setExecuted] = useState(false); // 🛡 evita doble ejecución
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const token = params?.token;
  const userParam = params?.user ? JSON.parse(params.user as string) : null;

  useEffect(() => {
    // 🎬 Fade-in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 700,
      useNativeDriver: true,
    }).start();

    // 🛡 Protección: ejecuta solo una vez
    if (executed) return;
    setExecuted(true);

    async function completeRegistration() {
      if (!token || !userParam) return;

      const finalUser = {
        ...userParam,
        onboardingCompleted: true,
      };

      // 1️⃣ Guardar token + usuario en Storage
      await saveSession(token as string, finalUser);

      // 2️⃣ Actualizar AuthContext + hacer login inmediato
      await signIn(token as string, finalUser);
    }

    completeRegistration();
  }, []);

  const paddingTop = insets.top || 12;

  return (
    <View style={{ flex: 1 }}>
      <Animated.View
        style={[
          styles.container,
          {
            backgroundColor: theme.colors.background,
            opacity: fadeAnim,
            paddingTop,
          },
        ]}
      >
        <LottieView
          source={require("@/assets/lottie/Applied successfully.json")}
          autoPlay
          loop={false}
          style={{ width: 220, height: 220 }}
        />

        <Text style={[styles.title, { color: theme.colors.text }]}>
          ¡Cuenta creada con éxito!
        </Text>

        <Text style={[styles.subtitle, { color: theme.colors.text }]}>
          Configurando tu perfil...
        </Text>

        <ActivityIndicator
          color={theme.colors.primary}
          style={{ marginTop: 25 }}
          size="large"
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 35,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginTop: 10,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 17,
    textAlign: "center",
    marginTop: 10,
    opacity: 0.85,
  },
});
