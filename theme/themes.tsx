// ======================================================
// 🎨 theme/themes.tsx — QuickChatX v9.0
// ✅ ThemeProvider + Hook + soporte dark/light automático
// ======================================================

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import { ColorValue, TextStyle, useColorScheme, ViewStyle } from "react-native";

// ======================================================
// 🌗 Tipos del tema
// ======================================================
export interface Theme {
  colors: {
    background: ColorValue;
    text: ColorValue;
    primary: ColorValue;
    secondary: ColorValue;
    card: ColorValue;
    border: ColorValue;
  };
  text: {
    title: TextStyle;
    body: TextStyle;
    small: TextStyle;
  };
  layout: {
    container: ViewStyle;
  };
}

// ======================================================
// 🎨 Definición de temas
// ======================================================
const lightTheme: Theme = {
  colors: {
    background: "#FFFFFF",
    text: "#111111",
    primary: "#007AFF",
    secondary: "#5856D6",
    card: "#F8F8F8",
    border: "#E5E5EA",
  },
  text: {
    title: { fontSize: 20, fontWeight: "700", color: "#111111" },
    body: { fontSize: 16, color: "#333333" },
    small: { fontSize: 13, color: "#666666" },
  },
  layout: {
    container: { flex: 1, backgroundColor: "#FFFFFF" },
  },
};

const darkTheme: Theme = {
  colors: {
    background: "#000000",
    text: "#FFFFFF",
    primary: "#0A84FF",
    secondary: "#5E5CE6",
    card: "#1C1C1E",
    border: "#2C2C2E",
  },
  text: {
    title: { fontSize: 20, fontWeight: "700", color: "#FFFFFF" },
    body: { fontSize: 16, color: "#E5E5EA" },
    small: { fontSize: 13, color: "#8E8E93" },
  },
  layout: {
    container: { flex: 1, backgroundColor: "#000000" },
  },
};

// ======================================================
// 🧩 Contexto y Provider
// ======================================================
const ThemeContext = createContext<Theme>(lightTheme);

export const ThemeProvider = ({
  children,
  mode,
}: {
  children: ReactNode;
  mode?: "light" | "dark" | null;
}) => {
  const systemScheme = useColorScheme();
  const finalMode = mode ?? systemScheme ?? "light";
  const theme = finalMode === "dark" ? darkTheme : lightTheme;

  return (
    <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
  );
};

// ======================================================
// 🎛 Hook principal de acceso al tema
// ======================================================
export const useTheme = () => useContext(ThemeContext);

// ======================================================
// 🎨 Hook helper para obtener color directo
// ======================================================
export const useThemeColor = (
  colorName: keyof Theme["colors"],
  override?: string
): string => {
  const { colors } = useTheme();
  return override ?? (colors[colorName] as string);
};

// ======================================================
// 🧱 Ejemplo de uso:
// const { colors, text } = useTheme();
// <View style={{ backgroundColor: colors.background }}>
//   <Text style={text.body}>Hola QuickChatX</Text>
// </View>
//
// ✅ O con el helper:
// const color = useThemeColor("primary");
// ======================================================
