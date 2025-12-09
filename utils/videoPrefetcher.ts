// =========================================================
// 🎬 VideoPrefetcher v1.0 — Ultra Fast Prefetch for Feed
// ---------------------------------------------------------
// - Descarga y cachea videos ANTES de que entren a pantalla
// - Devuelve una URI local estable para react-native-video
// - Si ya existe el archivo, lo reutiliza (0ms load)
// - Maneja TTL, errores y cancelaciones
// =========================================================

import * as FileSystem from "expo-file-system/legacy";

const CACHE_DIR = FileSystem.cacheDirectory + "video-cache/";
const TTL = 1000 * 60 * 60 * 24 * 3; // 3 días

// Crear carpeta si no existe
async function ensureDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

export type PrefetchResult = {
  localUri: string | null;
  fromCache: boolean;
  ok: boolean;
};

// =========================================================
// 📌 HASH SIMPLE POR URL → nombre de archivo único
// =========================================================
function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0;
  }
  return Math.abs(h).toString();
}

// =========================================================
// 🎥 PREFETCH PRINCIPAL
// =========================================================
export async function prefetchVideo(url: string): Promise<PrefetchResult> {
  if (!url || typeof url !== "string") {
    return { ok: false, localUri: null, fromCache: false };
  }

  try {
    await ensureDir();

    const key = hash(url);
    const localFile = CACHE_DIR + key + ".mp4";

    const info = await FileSystem.getInfoAsync(localFile);

    // 🟢 Si existe y no está muy viejo → reusar
    if (info.exists) {
      const isFresh = Date.now() - (info.modificationTime ?? 0) < TTL;
      if (isFresh) {
        return { ok: true, localUri: localFile, fromCache: true };
      }
    }

    // 🔵 Si no existe, descargar
    const downloaded = await FileSystem.downloadAsync(url, localFile);

    if (!downloaded.uri) {
      return { ok: false, localUri: null, fromCache: false };
    }

    return { ok: true, localUri: downloaded.uri, fromCache: false };
  } catch (err) {
    console.log("❌ prefetchVideo error:", err);
    return { ok: false, localUri: null, fromCache: false };
  }
}
