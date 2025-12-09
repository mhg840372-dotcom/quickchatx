import { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Animated,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "../../utils/TranslationProvider";
import LottieView from "lottie-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { checkUsername as apiCheckUsername, checkEmail as apiCheckEmail } from "../../services/api";
// GlobalHeader eliminado en pantallas de auth
import { useAuth } from "../../hooks/useAuth";

export default function RegisterScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const registerTitle = "𝓡𝓮𝓰𝓲𝓼𝓽𝓻𝓪𝓽𝓮";
  const { signIn } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const suggestionsOpacity = useRef(new Animated.Value(0)).current;
  const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);

  const [touched, setTouched] = useState({
    firstName: false,
    lastName: false,
    username: false,
    email: false,
    password: false,
    confirmPassword: false,
    birthDate: false,
  });
  const insets = useSafeAreaInsets();
  const contentTopInset = insets.top || 12;

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim());
  const isValidUsername = (u: string) => /^[a-z0-9._-]{3,24}$/i.test(u.trim());
  const isValidPassword = (p: string) => /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/.test(p);
  const parseBirthDate = (value: string) => {
    const m = value.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/); // MM/DD/YYYY o MM-DD-YYYY
    const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/); // YYYY-MM-DD
    let month: number, day: number, year: number;
    if (m) {
      month = parseInt(m[1], 10) - 1;
      day = parseInt(m[2], 10);
      year = parseInt(m[3], 10);
    } else if (iso) {
      year = parseInt(iso[1], 10);
      month = parseInt(iso[2], 10) - 1;
      day = parseInt(iso[3], 10);
    } else {
      return null;
    }
    const date = new Date(year, month, day);
    if (
      Number.isNaN(date.getTime()) ||
      date.getFullYear() !== year ||
      date.getMonth() !== month ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  };

  const isValidBirthDate = (d: string) => {
    const date = parseBirthDate(d);
    if (!date) return false;
    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const m = today.getMonth() - date.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < date.getDate())) age--;
    return age >= 13;
  };

  const checkUsernameAvailability = useCallback(async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || !isValidUsername(trimmed)) {
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
      setCheckingUsername(false);
      return;
    }
    setCheckingUsername(true);
    try {
      const data = await apiCheckUsername(trimmed.toLowerCase());
      if (data?.available) {
        setUsernameAvailable(true);
        setUsernameSuggestions([]);
      } else {
        setUsernameAvailable(false);
        setUsernameSuggestions(data?.suggestions || [
          `${trimmed}1`,
          `${trimmed}_${Math.floor(Math.random() * 90 + 10)}`,
          `${trimmed}.${Math.floor(Math.random() * 900 + 100)}`,
        ]);
      }
    } catch (err) {
      console.error("Error checking username:", err);
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
    } finally {
      setCheckingUsername(false);
    }
  }, []);

  useEffect(() => {
    if (!username) {
      setUsernameAvailable(null);
      setUsernameSuggestions([]);
      return;
    }
    const handler = setTimeout(() => checkUsernameAvailability(username), 900);
    return () => clearTimeout(handler);
  }, [username, checkUsernameAvailability]);

  useEffect(() => {
    let active = true;
    const validateEmail = async () => {
      const clean = email.trim();
      if (!clean || !isValidEmail(clean)) {
        if (active) setEmailAvailable(null);
        return;
      }
      try {
        setEmailChecking(true);
        const res = await apiCheckEmail(clean);
        if (active) setEmailAvailable(res.available);
      } catch {
        if (active) setEmailAvailable(null);
      } finally {
        if (active) setEmailChecking(false);
      }
    };
    const t = setTimeout(validateEmail, 600);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [email]);

  useEffect(() => {
    Animated.timing(suggestionsOpacity, {
      toValue: usernameSuggestions.length > 0 ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [usernameSuggestions, suggestionsOpacity]);

  const getBorderColor = (field: string) => {
    if (!touched[field as keyof typeof touched]) return "#ccc";
    switch (field) {
      case "email":
        return emailAvailable === null
          ? isValidEmail(email)
            ? "#ccc"
            : "red"
          : emailAvailable
          ? "green"
          : "red";
      case "username":
        return usernameAvailable === null ? "#ccc" : usernameAvailable ? "green" : "red";
      case "password":
        return isValidPassword(password) ? "green" : "red";
      case "confirmPassword":
        return password === confirmPassword ? "green" : "red";
      case "firstName":
      case "lastName":
        return (field === "firstName" ? firstName : lastName).trim() ? "green" : "red";
      case "birthDate":
        return birthDate.trim() ? (isValidBirthDate(birthDate) ? "green" : "red") : "#ccc";
      default:
        return "#ccc";
    }
  };

  const handleContinue = () => {
    if (!firstName.trim()) return Alert.alert("Error", "First name required");
    if (!lastName.trim()) return Alert.alert("Error", "Last name required");
    if (!username.trim()) return Alert.alert("Error", "Username required");
    if (!email.trim()) return Alert.alert("Error", "Email required");
    if (!birthDate.trim()) return Alert.alert("Error", "Birth date required");
    if (!password) return Alert.alert("Error", "Password required");
    if (!confirmPassword) return Alert.alert("Error", "Confirm password required");
    if (!isValidEmail(email)) return Alert.alert("Error", "Invalid email address");
    if (emailAvailable === false) {
      Alert.alert(
        "Email en uso",
        "Este email ya está registrado. Usa un email no registrado para crear tu cuenta."
      );
      return;
    }
    const birthParsed = parseBirthDate(birthDate);
    if (!birthParsed || !isValidBirthDate(birthDate))
      return Alert.alert("Error", "You must be at least 13 years old (use MM/DD/YYYY).");
    if (!isValidUsername(username)) return Alert.alert("Error", "Invalid username format");
    if (usernameAvailable === false) return Alert.alert("Error", "Username already exists");
    if (!isValidPassword(password)) return Alert.alert("Error", "Password must have 6+ chars, uppercase, lowercase & number");
    if (password !== confirmPassword) return Alert.alert("Error", "Passwords do not match");

    const payload = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      username: username.trim(),
      email: email.trim(),
      birthDate: birthParsed.toISOString().slice(0, 10),
      password,
      confirmPassword,
    };
    router.push({ pathname: "/(auth)/TermsScreen", params: { data: JSON.stringify(payload) } });
  };

  const handleBirthChange = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "").slice(0, 8);
    let formatted = digits;
    if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    }
    setBirthDate(formatted);
  };

  const isFormDisabled = loading || checkingUsername;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
          <LottieView source={require("../../assets/lottie/App Background.json")} autoPlay loop style={StyleSheet.absoluteFillObject} resizeMode="cover" />
        </View>
        <ScrollView
          contentContainerStyle={[styles.container, { paddingTop: contentTopInset }]}
          keyboardShouldPersistTaps="always"
        >
          <Text style={styles.title}>{registerTitle}</Text>
          <TextInput style={[styles.input, { borderColor: getBorderColor("firstName") }]} placeholder={t("firstName" as any)} value={firstName} onChangeText={setFirstName} placeholderTextColor="#000" editable={!isFormDisabled} onBlur={() => setTouched(prev => ({ ...prev, firstName: true }))} />
          <TextInput style={[styles.input, { borderColor: getBorderColor("lastName") }]} placeholder={t("lastName" as any)} value={lastName} onChangeText={setLastName} placeholderTextColor="#000" editable={!isFormDisabled} onBlur={() => setTouched(prev => ({ ...prev, lastName: true }))} />
          <View style={{ marginBottom: 10, position: "relative" }}>
            <TextInput style={[styles.input, { borderColor: getBorderColor("username") }]} placeholder={t("username" as any)} value={username} onChangeText={setUsername} placeholderTextColor="#000" editable={!isFormDisabled} onFocus={() => setTouched(prev => ({ ...prev, username: true }))} />
            {checkingUsername && <ActivityIndicator style={{ position: "absolute", right: 12, top: 12 }} color="#0078FE" />}
            {!checkingUsername && usernameAvailable !== null && (
              <Ionicons name={usernameAvailable ? "checkmark-circle" : "close-circle"} size={20} color={usernameAvailable ? "green" : "red"} style={{ position: "absolute", right: 12, top: 12 }} />
            )}
          </View>
          {!checkingUsername && usernameAvailable === false && usernameSuggestions.length > 0 && (
            <View style={{ marginTop: 4, marginBottom: 6 }}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestionsContainer}
              >
                {usernameSuggestions.map((sugg) => (
                  <TouchableOpacity
                    key={sugg}
                    style={styles.suggestionPill}
                    onPress={() => setUsername(sugg)}
                    disabled={isFormDisabled}
                  >
                    <Text style={styles.suggestionText}>{sugg}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
          <View style={{ marginBottom: 6 }}>
            <TextInput
              style={[styles.input, { borderColor: getBorderColor("birthDate") }]}
              placeholder="Fecha de nacimiento (MM/DD/YYYY)"
              value={birthDate}
              onChangeText={handleBirthChange}
              placeholderTextColor="#000"
              editable={!isFormDisabled}
              onBlur={() => setTouched((prev) => ({ ...prev, birthDate: true }))}
              keyboardType="number-pad"
            />
            <Text style={styles.helper}>MM / DD / YYYY</Text>
          </View>
          <View style={{ marginBottom: 6, position: "relative" }}>
            <TextInput
              style={[styles.input, { borderColor: getBorderColor("email") }]}
              placeholder={t("email" as any)}
              value={email}
              onChangeText={setEmail}
              placeholderTextColor="#000"
              editable={!isFormDisabled}
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            {emailChecking && (
              <ActivityIndicator
                style={{ position: "absolute", right: 12, top: 12 }}
                color="#0078FE"
              />
            )}
            {!emailChecking && emailAvailable !== null && (
              <Ionicons
                name={emailAvailable ? "checkmark-circle" : "close-circle"}
                size={20}
                color={emailAvailable ? "green" : "red"}
                style={{ position: "absolute", right: 12, top: 12 }}
              />
            )}
          </View>
          {!emailChecking && emailAvailable === false && (
            <Text style={styles.errorHelper}>
              Este email ya está registrado. Usa otro email para crear tu cuenta.
            </Text>
          )}
          <View style={styles.passwordContainer}>
            <TextInput style={[styles.input, { flex: 1, borderColor: getBorderColor("password") }]} placeholder={t("password" as any)} value={password} onChangeText={setPassword} secureTextEntry={!showPassword} placeholderTextColor="#000" editable={!isFormDisabled} onBlur={() => setTouched(prev => ({ ...prev, password: true }))} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton} disabled={isFormDisabled}>
              <Ionicons name={showPassword ? "eye" : "eye-off"} size={24} color="#000" />
            </TouchableOpacity>
          </View>
          <Text style={styles.passwordHelper}>
            La contraseña debe ser fuerte para tu seguridad (6+ caracteres, mayúsculas, minúsculas y número).
          </Text>
          <TextInput style={[styles.input, { borderColor: getBorderColor("confirmPassword") }]} placeholder={t("confirmPassword" as any)} value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry={!showPassword} placeholderTextColor="#000" editable={!isFormDisabled} onBlur={() => setTouched(prev => ({ ...prev, confirmPassword: true }))} />
          <TouchableOpacity onPress={handleContinue} disabled={isFormDisabled} style={{ marginTop: 20 }}>
            <LinearGradient colors={["#0078FE", "#00BFFF"]} style={styles.continueButton}>
              <Text style={styles.continueText}>{t("continue")}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: "center", padding: 28 },
  title: { fontSize: 28, fontWeight: "700", marginBottom: 14, textAlign: "center" },
  input: { borderWidth: 1, marginVertical: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 22, fontSize: 16, backgroundColor: "#fff", color: "#000" },
  passwordContainer: { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  eyeButton: { marginLeft: 8 },
  continueButton: { paddingVertical: 14, alignItems: "center", borderRadius: 22 },
  continueText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  helper: { fontSize: 12, color: "#666", marginLeft: 8, marginTop: 2 },
  suggestionsContainer: {
    paddingVertical: 6,
    gap: 8,
    paddingHorizontal: 4,
    flexDirection: "row",
    flexWrap: "wrap",
  },
  suggestionPill: {
    backgroundColor: "#e8f2ff",
    borderRadius: 14,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: "#b6d4ff",
    minHeight: 36,
    justifyContent: "center",
  },
  suggestionText: { color: "#004b9a", fontWeight: "600", fontSize: 13 },
  errorHelper: { fontSize: 12, color: "#000", marginLeft: 8, marginTop: 2 },
  passwordHelper: { fontSize: 12, color: "#000", marginLeft: 8, marginTop: 4 },
});
