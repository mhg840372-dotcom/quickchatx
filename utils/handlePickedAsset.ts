// ======================================================
// 📦 handlePickedAsset.ts — Expo SDK 55 READY (2025)
// ------------------------------------------------------
// ✔ Convierte la imagen/video de ImagePicker en un file válido
// ✔ Usa nuevo File API (FileSystem.File) cuando existe
// ✔ Fallback a FileSystem legacy sin romper builds antiguos
// ✔ Devuelve objeto listo para FormData + metadata útil
// ✔ Marca vídeos demasiado pesados con tooHeavy (no rompe nada)
// ======================================================

import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as LegacyFileSystem from "expo-file-system/legacy";
import { Alert } from "react-native";

export type PickedAssetResult = {
  uri: string;
  name: string;
  type: string;
  /**
   * Tamaño en bytes (compatibilidad con versión anterior)
   */
  size?: number;

  // 🔥 Campos nuevos (no rompen nada existente)
  sizeBytes?: number;
  sizeMb?: number;
  isVideo: boolean;
  durationSec?: number;
  imageWidth?: number;
  imageHeight?: number;
  aspectRatio?: number;

  /**
   * 🧱 Flag opcional: true si el vídeo supera el límite recomendado de tamaño.
   * No evita que lo uses, solo te avisa (depende del caller ignorarlo o bloquearlo).
   */
  tooHeavy?: boolean;
};

/**
 * Límite "seguro" para vídeos antes de que el backend/proxy empiece a dar timeout.
 * Puedes ajustar este valor según quieras.
 */
const MAX_VIDEO_MB = 50;

/**
 * Adivina MIME en base a mimeType, extensión y tipo (imagen / video).
 */
function guessMimeType(
  asset: ImagePicker.ImagePickerAsset,
  fallbackName: string
): string {
  if (asset.mimeType) return asset.mimeType;

  const lower = fallbackName.toLowerCase();

  if (asset.type === "video") {
    if (lower.endsWith(".mp4")) return "video/mp4";
    if (lower.endsWith(".mov")) return "video/quicktime";
    if (lower.endsWith(".webm")) return "video/webm";
    return "video/mp4";
  }

  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";

  return "image/jpeg";
}

/**
 * Convierte resultado de ImagePicker en un archivo compatible con FormData
 * + metadata útil para el front (isVideo, sizeMb, aspectRatio, etc.).
 */
export async function handlePickedAsset(
  asset: ImagePicker.ImagePickerAsset
): Promise<PickedAssetResult> {
  if (!asset?.uri) throw new Error("El asset no contiene URI");

  const fallbackName =
    asset.fileName || asset.uri.split("/").pop() || "media.bin";

  const type = guessMimeType(asset, fallbackName);
  const isVideo = asset.type === "video";

  let uri = asset.uri;
  let sizeBytes: number | undefined;

  try {
    // SDK 54+ : nuevo FileSystem.File API
    const fileFromUriAsync = (FileSystem as any)?.File?.fromUriAsync;

    if (typeof fileFromUriAsync === "function") {
      const file = await fileFromUriAsync(asset.uri);
      uri = file?.uri || asset.uri;
      sizeBytes = typeof file?.size === "number" ? file.size : undefined;
    } else {
      // Fallback: legacy getInfoAsync (a través del módulo legacy)
      const info = await (LegacyFileSystem as any).getInfoAsync(asset.uri);
      uri = asset.uri;
      sizeBytes = typeof info?.size === "number" ? info.size : undefined;
    }
  } catch (err: any) {
    console.error("❌ handlePickedAsset error:", err);
    // Si algo falla, seguimos al menos con la URI original
    uri = asset.uri;
  }

  const sizeMb = sizeBytes ? sizeBytes / (1024 * 1024) : undefined;

  const width = asset.width ?? undefined;
  const height = asset.height ?? undefined;
  const aspectRatio =
    width && height && height !== 0 ? width / height : undefined;

  // 🧱 Flag para marcar vídeos demasiado pesados (no rompe compatibilidad)
  const tooHeavy =
    isVideo && typeof sizeMb === "number" && sizeMb > MAX_VIDEO_MB;

  if (tooHeavy) {
    // ⚠️ Solo avisamos visualmente; el caller decide si usa o no el asset
    Alert.alert(
      "Video muy pesado",
      `Tu video pesa aproximadamente ${sizeMb.toFixed(
        1
      )} MB.\n\nPara evitar que la publicación falle o tarde demasiado ` +
        `te recomendamos recortarlo más o comprimirlo (máx. ${MAX_VIDEO_MB} MB).`
    );
    console.warn(
      `[handlePickedAsset] Video marcado como tooHeavy (${sizeMb.toFixed(
        2
      )} MB) — uri=${uri}`
    );
  }

  const result: PickedAssetResult = {
    uri,
    type,
    name: fallbackName,
    size: sizeBytes, // compat
    sizeBytes,
    sizeMb,
    isVideo,
    durationSec: isVideo ? asset.duration ?? undefined : undefined,
    imageWidth: width,
    imageHeight: height,
    aspectRatio,
    tooHeavy,
  };

  return result;
}

/**
 * Helper para varios assets a la vez (multi-selección).
 */
export async function handlePickedAssets(
  assets: ImagePicker.ImagePickerAsset[]
): Promise<PickedAssetResult[]> {
  return Promise.all(assets.map((a) => handlePickedAsset(a)));
}
