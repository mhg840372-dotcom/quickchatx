// utils/videoThumbnailExtractor.ts
// =======================================================
// 🎞 Stub seguro para miniaturas de video
// -------------------------------------------------------
// - No depende de expo-video-thumbnails ni módulos nativos
// - Nunca rompe el bundle aunque no exista el paquete
// - FeedItemEnhanced lo usa como "best effort":
//     • Si devuelve uri → se usa como thumbnail
//     • Si devuelve null → se muestra caja negra + icono play
// =======================================================

import { Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Crypto from "expo-crypto";

export type VideoThumbnailResult =
  | string
  | {
      uri?: string | null;
      path?: string | null;
      [key: string]: any;
    };

const failedUrls = new Set<string>();
const cacheDir = `${FileSystem.cacheDirectory}video-thumbs/`;

async function ensureCacheDir() {
  const info = await FileSystem.getInfoAsync(cacheDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(cacheDir, { intermediates: true });
  }
}

/**
 * getVideoThumbnail
 * Intenta devolver una miniatura, pero en este stub simplemente
 * devuelve null para no romper nada si no hay soporte nativo.
 */
export async function getVideoThumbnail(
  url: string
): Promise<VideoThumbnailResult | null> {
  try {
    if (!url) return null;
    if (failedUrls.has(url)) return null;

    // Web no está soportado por expo-video-thumbnails
    if (Platform.OS === "web") {
      console.log("[videoThumbnailExtractor] No soportado en web");
      return null;
    }

    // Carga perezosa para no romper si el paquete falta
    const mod: any = await import("expo-video-thumbnails");
    const getThumb =
      mod?.getThumbnailAsync || mod?.default?.getThumbnailAsync || null;

    if (!getThumb) {
      console.log("[videoThumbnailExtractor] getThumbnailAsync no disponible");
      return null;
    }

    let sourceUri = url;

    // Para URLs remotas, descarga a caché antes de generar thumbnail
    if (/^https?:\/\//i.test(url)) {
      await ensureCacheDir();
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA1,
        url
      );
      const target = `${cacheDir}${hash}.mp4`;
      const info = await FileSystem.getInfoAsync(target);
      if (!info.exists) {
        await FileSystem.downloadAsync(url, target);
      }
      sourceUri = target;
    }

    const result = await getThumb(sourceUri, {
      time: 1500, // ms desde el inicio
      quality: 0.6,
    });

    console.log("[videoThumbnailExtractor] Miniatura generada para:", url);
    return result?.uri ? result : null;
  } catch (e) {
    failedUrls.add(url);
    console.log(
      "[videoThumbnailExtractor] Error generando thumbnail:",
      (e as any)?.message || e
    );
    return null;
  }
}

/**
 * Alias comunes que FeedItemEnhanced podría intentar usar:
 * - extractThumbnail
 * - createVideoThumbnail
 */
export const extractThumbnail = getVideoThumbnail;
export const createVideoThumbnail = getVideoThumbnail;

// default export por compatibilidad
export default getVideoThumbnail;
