// ================================================================
// 🎬 VideoSmartPrefetcher v3.1 — AutoQuality + Prefetch Inteligente
// ---------------------------------------------------------------
// ✔ Prefetch por calidad en archivos .mp4
// ✔ Evita duplicar sufijos (video_480p_720p.mp4 ❌)
// ✔ Cachea la velocidad de red en memoria (menos llamadas)
// ✔ Seguro: si falla, no rompe el reproductor
// ================================================================

import * as FileSystem from "expo-file-system/legacy";

// Carpeta cache
export const CACHE_DIR = FileSystem.cacheDirectory + "video-smart-cache/";
export const TTL = 1000 * 60 * 60 * 24 * 3; // 3 días

// Crear carpeta si no existe
async function ensureDir() {
  const info = await FileSystem.getInfoAsync(CACHE_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
  }
}

// ================================================================
// 🟦 PARTE 1 — Medir velocidad real (con caché en memoria)
// ================================================================
let lastSpeedKbps: number | null = null;
let lastSpeedAt = 0;

export async function measureNetworkSpeed(): Promise<number> {
  const now = Date.now();

  // Reutilizamos la última medición si es reciente (< 30s)
  if (lastSpeedKbps !== null && now - lastSpeedAt < 30_000) {
    return lastSpeedKbps;
  }

  const testUrl = "https://speed.cloudflare.com/__down?bytes=200000"; // ~200KB
  const start = now;

  try {
    await fetch(testUrl);
    const ms = Date.now() - start || 1;
    const speedKbps = (200 / ms) * 8; // KB/ms → kbps
    const clamped = Math.max(50, Math.floor(speedKbps));

    lastSpeedKbps = clamped;
    lastSpeedAt = Date.now();
    return clamped;
  } catch (err) {
    console.log("⚠ measureNetworkSpeed fallo, usando fallback:", err);
    const fallback = 300;
    lastSpeedKbps = fallback;
    lastSpeedAt = Date.now();
    return fallback;
  }
}

// ================================================================
// 🟦 PARTE 2 — Elegir calidad según velocidad real
// ================================================================
export function pickQuality(speedKbps: number) {
  if (speedKbps > 2500) return "1080p";
  if (speedKbps > 1500) return "720p";
  if (speedKbps > 800) return "480p";
  return "360p";
}

// Helper: limpiar sufijos previos y generar URL de calidad
function buildQualityUrl(urlBase: string, quality: string): string {
  if (!urlBase) return urlBase;

  // Solo trabajamos con .mp4
  if (!urlBase.endsWith(".mp4")) {
    return urlBase;
  }

  // Si ya tiene un sufijo de calidad (_1080p, _720p, etc.), lo normalizamos a .mp4
  const qualitySuffixRegex = /_(1080p|720p|480p|360p|240p)\.mp4$/;
  let cleanBase = urlBase;

  if (qualitySuffixRegex.test(urlBase)) {
    cleanBase = urlBase.replace(qualitySuffixRegex, ".mp4");
  }

  // Ahora sí: base.mp4 → base_720p.mp4
  return `${cleanBase.replace(/\.mp4$/, "")}_${quality}.mp4`;
}

// ================================================================
// 🟦 PARTE 3 — Prefetch inteligente por calidad
// ================================================================
function hash(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString();
}

export type SmartPrefetchResult = {
  ok: boolean;
  quality: string;
  localUri: string | null;
  fromCache: boolean;
};

export async function smartPrefetchVideo(
  urlBase: string
): Promise<SmartPrefetchResult> {
  if (!urlBase) {
    return {
      ok: false,
      quality: "480p",
      localUri: null,
      fromCache: false,
    };
  }

  await ensureDir();

  // 1. Medimos velocidad real ⏱️
  const speed = await measureNetworkSpeed();

  // 2. Elegimos calidad 📺
  const quality = pickQuality(speed);

  // 3. Creamos la URL final seguro:
  //    video.mp4 → video_720p.mp4
  //    video_480p.mp4 → normalizado a video.mp4 → video_720p.mp4
  const url = buildQualityUrl(urlBase, quality);

  // Si por lo que sea no pudimos construir una URL distinta, no pasa nada
  const key = hash(url);
  const localFile = `${CACHE_DIR}${key}.mp4`;

  // 4. Si existe en caché → return instantáneo ⚡
  const info = await FileSystem.getInfoAsync(localFile);

  if (info.exists && Date.now() - (info.modificationTime || 0) < TTL) {
    return {
      ok: true,
      quality,
      localUri: localFile,
      fromCache: true,
    };
  }

  // 5. Descargar si no está cacheado
  try {
    const d = await FileSystem.downloadAsync(url, localFile);

    return {
      ok: true,
      quality,
      localUri: d.uri,
      fromCache: false,
    };
  } catch (err) {
    console.log("⚠ smartPrefetchVideo FAIL:", err);
    return {
      ok: false,
      quality,
      localUri: null,
      fromCache: false,
    };
  }
}
