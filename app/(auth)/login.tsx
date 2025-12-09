// ======================================================
// 🔐 app/(auth)/login.tsx — Login Final Optimizado v5.2
// 🟣 Compatible 100% con backend QuickChatX actualizado
// ======================================================

import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../hooks/useAuth";
import { loginUser } from "../../services/api";
// Se elimina GlobalHeader en pantallas de auth para un diseño limpio

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const loginTitle = "𝓘𝓷𝓲𝓬𝓲𝓪 𝓢𝓮𝓬𝓲𝓸𝓷";

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  const handleLogin = async () => {
    if (!login.trim() || !password.trim()) {
      Alert.alert("Campos requeridos", "Ingresa usuario/email y contraseña.");
      return;
    }

    try {
      setBusy(true);

      // 📡 Llamada al backend QuickChatX
      const response = await loginUser(login.trim(), password.trim());

      // 🛑 Validación del backend según tu API real
      if (!response || !response.token || !response.user) {
        console.log("⚠️ Respuesta inesperada:", response);
        throw new Error("El servidor no regresó la sesión completa.");
      }

      // 🟢 Guardar sesión
      await signIn(response.token, response.user);

      // 🔄 Ir al home principal
      router.replace("/(tabs)");
    } catch (err: any) {
      console.error("❌ Error en login:", err);

      // 🟣 Backend QuickChatX usa "error", NO "message"
      const status = err?.response?.status;
      const serverMessage =
        err?.response?.data?.error || err?.response?.data?.message;
      const normalizedServer = (serverMessage || "").toLowerCase();

      const isAuthError =
        status === 401 ||
        status === 403 ||
        normalizedServer.includes("token");

      const userError =
        normalizedServer.includes("user") ||
        normalizedServer.includes("usuario") ||
        normalizedServer.includes("username");

      const passError =
        normalizedServer.includes("pass") ||
        normalizedServer.includes("contrase");

      let message: string;
      if (isAuthError) {
        if (userError && !passError) {
          message = "Usuario incorrecto o no encontrado.";
        } else if (passError && !userError) {
          message = "Contraseña incorrecta.";
        } else {
          message = "Usuario o contraseña incorrectos. Inténtalo de nuevo.";
        }
      } else {
        message =
          serverMessage ||
          err?.message ||
          "No se pudo iniciar sesión. Intenta nuevamente.";
      }

      Alert.alert("Error de inicio de sesión", message);
    } finally {
      setBusy(false);
    }
  };

  const instagramBlue = "#405DE6";
  const instagramPurple = "#C13584";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#000" }}>
      <LottieView
        source={require("../../assets/lottie/App Background.json")}
        autoPlay
        loop
        resizeMode="cover"
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        style={[styles.container, { paddingTop: insets.top || 12 }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.form}>
          {/* 🔥 Título con estilo Instagram */}
          <Text style={[styles.title, { color: instagramPurple, fontSize: 44 }]}>{loginTitle}</Text>

          <TextInput
            placeholder="Usuario o correo electrónico"
            value={login}
            onChangeText={setLogin}
            style={styles.input}
            placeholderTextColor="#ccc"
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!busy}
          />

          {/* 🔒 Password con icono de visibilidad */}
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="Contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              placeholderTextColor="#ccc"
              editable={!busy}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              disabled={busy}
              style={styles.eyeIcon}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color="#ccc"
              />
            </TouchableOpacity>
          </View>

          {/* Botón / Loader */}
          {busy ? (
            <ActivityIndicator size="large" color={instagramBlue} style={{ marginVertical: 10 }} />
          ) : (
            <Pressable
              style={[styles.button, { backgroundColor: instagramBlue }]}
              onPress={handleLogin}
            >
              <Text style={[styles.buttonText, { fontSize: 20 }]}>𝓔𝓷𝓽𝓻𝓪𝓻</Text>
            </Pressable>
          )}

          {/* Registro */}
          <Pressable
            style={[styles.button, styles.registerButton]}
            onPress={() => router.push("/(auth)/register")}
            disabled={busy}
          >
            <Text style={[styles.buttonText, { fontSize: 20 }]}>𝓒𝓻𝓮𝓪𝓻 𝓬𝓾𝓮𝓷𝓽𝓪</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ======================================================
// 🎨 Estilos
// ======================================================
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  form: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    padding: 44,
    borderRadius: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 20,
    fontStyle: "italic",
  },
  input: {
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "rgba(255,255,255,0.1)",
    padding: 14,
    marginBottom: 16,
    borderRadius: 10,
    color: "#fff",
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderColor: "#333",
    borderWidth: 1,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.1)",
    marginBottom: 16,
  },
  eyeIcon: {
    paddingHorizontal: 12,
  },
  button: {
    paddingVertical: 14,
    borderRadius: 25,
    alignItems: "center",
    marginVertical: 10,
  },
  registerButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#fff",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
// ======================================================
