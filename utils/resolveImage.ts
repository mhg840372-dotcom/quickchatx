// utils/resolveImage.ts
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, "") ||
  "https://api.quickchatx.com";

export function resolveImageUrl(input?: string | null): string | undefined {
  if (!input) return undefined;

  const url = input.trim();

  // URIs locales (cache, file system)
  if (
    url.startsWith("file://") ||
    url.startsWith("content://") ||
    url.startsWith("data:") ||
    url.startsWith("ph://")
  ) {
    return url;
  }

  // URLs completas
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Rutas relativas -> pegar API_BASE
  if (url.startsWith("/")) {
    return `${API_BASE}${url}`;
  }

  return `${API_BASE}/${url}`;
}
