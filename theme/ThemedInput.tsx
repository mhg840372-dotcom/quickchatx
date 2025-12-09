// ======================================================
// ✏️ components/ThemedInput.tsx
// ✅ QuickChatX v9.0 — Campo de texto adaptable al tema global
// ------------------------------------------------------
// - Integrado con ThemeProvider (theme/themes.ts)
// - Soporta estados de error y deshabilitado
// - Incluye borde dinámico y colores automáticos (light/dark)
// ======================================================

import { useTheme } from "@/theme/themes";
import type { FC } from "react";
import {
    StyleSheet,
    Text,
    TextInput,
    TextInputProps,
    useColorScheme,
    View,
} from "react-native";

interface ThemedInputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const ThemedInput: FC<ThemedInputProps> = ({
  label,
  error,
  style,
  editable = true,
  ...props
}) => {
  const theme = useTheme?.();
  const scheme = useColorScheme();

  // 🎨 Colores base (usa ThemeProvider o fallback)
  const colors = theme?.colors || {
    background: scheme === "dark" ? "#000" : "#FFF",
    text: scheme === "dark" ? "#FFF" : "#000",
    border: scheme === "dark" ? "#333" : "#CCC",
    primary: "#007AFF",
  };

  return (
    <View style={{ marginBottom: 16 }}>
      {label && <Text style={[styles.label, { color: colors.text }]}>{label}</Text>}

      <TextInput
        style={[
          styles.input,
          {
            backgroundColor: colors.background,
            borderColor: error ? "#FF3B30" : colors.border,
            color: colors.text,
          },
          !editable && { opacity: 0.6 },
          style,
        ]}
        placeholderTextColor={scheme === "dark" ? "#888" : "#888"}
        editable={editable}
        {...props}
      />

      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  errorText: {
    color: "#FF3B30",
    fontSize: 13,
    marginTop: 4,
  },
});
