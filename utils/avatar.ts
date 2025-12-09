import { api } from "@/services/api";

const getApiBase = () => {
  try {
    const base = (api as any)?.defaults?.baseURL;
    if (typeof base === "string" && base.length > 0) {
      return base.replace(/\/$/, "");
    }
  } catch {}
  return process.env.EXPO_PUBLIC_API_BASE_URL || "https://api.quickchatx.com/api";
};

/**
 * Normaliza URLs de avatar para que sean absolutas y seguras.
 * Acepta http/https/data/file/content/asset, rutas relativas y //host.
 */
export const resolveAvatarUrl = (
  raw?: string | null,
  fallback: string | null = null
): string | null => {
  if (!raw) return fallback;
  let url = String(raw).trim();

  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("data:") ||
    url.startsWith("file://") ||
    url.startsWith("content://") ||
    url.startsWith("asset://")
  ) {
    return url;
  }

  if (url.startsWith("//")) return `https:${url}`;

  // Prefija con /uploads si parece relativo
  if (!url.startsWith("/")) {
    url = `/uploads/${url.replace(/^\/+/, "")}`;
  }

  const base = getApiBase().replace(/\/$/, "");
  return `${base}${url}`;
};

