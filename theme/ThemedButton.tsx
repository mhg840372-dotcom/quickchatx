// ======================================================
// 🎨 components/ThemedButton.tsx
// ✅ QuickChatX v9.0 — Botón adaptable al tema global
// ------------------------------------------------------
// - Integrado con ThemeProvider (theme/themes.ts)
// - Soporta variantes: primary / secondary / outline
// - Fallback automático a useColorScheme()
// ======================================================

import { useTheme } from "@/theme/themes";
import type { FC } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TextStyle,
    TouchableOpacity,
    useColorScheme,
    ViewStyle,
} from "react-native";

interface ThemedButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const ThemedButton: FC<ThemedButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const theme = useTheme?.();
  const scheme = useColorScheme();

  // 🎨 Colores base del tema
  const colors = theme?.colors || {
    primary: "#007AFF",
    secondary: "#5856D6",
    text: scheme === "dark" ? "#FFF" : "#000",
    background: scheme === "dark" ? "#000" : "#FFF",
    border: scheme === "dark" ? "#333" : "#DDD",
  };

  // 🎯 Estilo dinámico según variante
  const buttonStyles = [
    styles.buttonBase,
    variant === "primary" && { backgroundColor: colors.primary },
    variant === "secondary" && { backgroundColor: colors.secondary },
    variant === "outline" && {
      backgroundColor: "transparent",
      borderColor: colors.border,
      borderWidth: 1,
    },
    disabled && { opacity: 0.6 },
    style,
  ];

  const textStyles = [
    styles.textBase,
    variant === "outline"
      ? { color: colors.text }
      : { color: "#FFF" },
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyles}
      onPress={!disabled && !loading ? onPress : undefined}
      activeOpacity={0.8}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator color="#FFF" />
      ) : (
        <Text style={textStyles}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  buttonBase: {
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  textBase: {
    fontSize: 16,
    fontWeight: "600",
  },
});
