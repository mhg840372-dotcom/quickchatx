// utils/videoTrimService.ts
// =======================================================
// ✂️ trimVideoLocal — stub con validación básica (2025)
// -------------------------------------------------------
// - Sin ffmpeg-kit instalado, devolvemos el mismo URI con metadata.
// - Si quieres recorte real, instala ffmpeg-kit-react-native y
//   reemplaza esta lógica por una llamada real a ffmpeg.
// - NO importamos ffmpeg-kit para no romper el bundle si no existe.
// =======================================================

import * as FileSystem from "expo-file-system/legacy";

export type TrimOptions = {
  inputUri: string; // file://...
  startSec: number; // inicio en segundos
  endSec: number;   // fin en segundos
};

const bytesToMb = (bytes?: number | null): number =>
  !bytes || bytes <= 0 ? 0 : bytes / (1024 * 1024);

/**
 * Normaliza la URI para evitar sorpresas (file:/ → file:/// y espacios).
 * La dejo exportada por si la quieres reutilizar en otros módulos.
 */
export const normalizeUri = (uri: string): string => {
  if (!uri) return uri;

  let fixed = uri;

  // Normalizar file:///
  if (fixed.startsWith("file:/") && !fixed.startsWith("file:///")) {
    fixed = fixed.replace("file:/", "file:///");
  }

  // Escapar espacios
  if (fixed.includes(" ")) {
    fixed = fixed.replace(/ /g, "%20");
  }

  return fixed;
};

export async function trimVideoLocal(
  opts: TrimOptions
): Promise<{ uri: string; durationSec: number; sizeMb: number }> {
  const { inputUri, startSec, endSec } = opts;

  if (!inputUri) {
    throw new Error("inputUri requerido");
  }

  // Evitamos rangos locos / NaN
  if (!Number.isFinite(startSec) || !Number.isFinite(endSec)) {
    throw new Error("startSec/endSec inválidos");
  }

  if (endSec <= startSec) {
    throw new Error("Rango inválido: endSec debe ser mayor que startSec");
  }

  const safeStart = Math.max(0, startSec);
  const rawDuration = endSec - safeStart;
  const duration = Math.max(rawDuration, 0.1); // mínimo 0.1s para evitar 0

  const normalizedUri = normalizeUri(inputUri);
  let sizeMb = 0;

  try {
    const info = (await FileSystem.getInfoAsync(normalizedUri, {
      size: true,
    } as any)) as any;

    sizeMb = bytesToMb(info?.size as number | undefined);
  } catch (e) {
    console.log(
      "[trimVideoLocal] getInfoAsync error, usando sizeMb=0:",
      (e as any)?.message || e
    );
  }

  // 🔁 Stub: devolvemos el mismo archivo, solo ajustamos duración + sizeMb
  return {
    uri: normalizedUri,
    durationSec: duration,
    sizeMb,
  };
}
