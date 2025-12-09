// ======================================================
// 🎨 components/themed-view.tsx
// ✅ QuickChatX v9.0 — Vista y texto temáticos unificados
// ------------------------------------------------------
// - Usa ThemeProvider global (theme/themes.ts)
// - Fallback a useColorScheme() si no hay contexto
// - Props personalizables lightColor / darkColor
// ======================================================

import { useTheme } from "@/theme/themes";
import type { FC } from "react";
import { Text, TextProps, useColorScheme, View, ViewProps } from "react-native";

// 🧱 ThemedView — contenedor adaptable al tema
export const ThemedView: FC<
  ViewProps & { lightColor?: string; darkColor?: string }
> = ({ style, lightColor, darkColor, ...props }) => {
  const themeContext = useTheme?.();
  const scheme = useColorScheme();

  const backgroundColor =
    themeContext?.colors?.background ||
    (scheme === "dark" ? darkColor || "#000" : lightColor || "#fff");

  return <View style={[{ backgroundColor }, style]} {...props} />;
};

// ✍️ ThemedText — texto adaptable al tema
export const ThemedText: FC<
  TextProps & { lightColor?: string; darkColor?: string }
> = ({ style, lightColor, darkColor, ...props }) => {
  const themeContext = useTheme?.();
  const scheme = useColorScheme();

  const color =
    themeContext?.colors?.text ||
    (scheme === "dark" ? darkColor || "#fff" : lightColor || "#000");

  return <Text style={[{ color }, style]} {...props} />;
};
