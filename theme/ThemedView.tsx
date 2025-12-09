// ======================================================
// ✍️ components/ThemedText.tsx
// ✅ QuickChatX v9.0 — Texto adaptable al tema global
// ------------------------------------------------------
// - Usa ThemeProvider del sistema (theme/themes.ts)
// - Permite variantes: title | body | small
// - Mantiene compatibilidad total con React Native Text
// ======================================================

import { useTheme } from "@/theme/themes";
import type { FC } from "react";
import { Text, TextProps } from "react-native";

type Variant = "title" | "body" | "small";

interface ThemedTextProps extends TextProps {
  variant?: Variant;
}

export const ThemedText: FC<ThemedTextProps> = ({
  variant = "body",
  style,
  children,
  ...props
}) => {
  const theme = useTheme();

  return (
    <Text style={[theme.text[variant], style]} {...props}>
      {children}
    </Text>
  );
};
