// ======================================================
// 📄 CreatePostScreen.tsx — v9.5 (2025)
// ------------------------------------------------------
// ✅ URIs normalizadas sin romper rutas locales (file://, content://)
// ✅ Permisos galería / cámara
// ✅ Botón superior "Crear" que SÍ envía el post
// ✅ Botones Galería/Cámara elegantes en fila
// ✅ Soporta múltiples imágenes (hasta 10)
// ✅ Solo 1 video por post, sin mezclar con imágenes
// ✅ Modo WhatsApp: aviso especial para videos grandes
// ✅ Panel tipo YouTube Studio para meta de video
// ✅ Manejo 413 / UPLOAD_LIMIT_EXCEEDED / 524 / ERR_NETWORK
// ✅ Mini-editor inline de video (VideoTrimEditorCard)
// ✅ Normaliza SIEMPRE duración de video a segundos usando tamaño de archivo
// ✅ Envía meta extra de imagen + hint de categoría de video (categoryHint)
// ✅ 🛠 FIX: evita duplicar media (misma imagen dos veces) y doble submit
// ✅ 🆕 Compresión de video en cliente (tipo WhatsApp) antes de subir
// ✅ 🆕 Expo ImagePicker v17: sin MediaTypeOptions ni warning de allowsEditing
// ======================================================

import { useEffect, useState, useRef } from "react";
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Text,
  Animated,
  Easing,
  Alert,
  StatusBar,
  ScrollView,
  Linking,
  Platform,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import type { ImagePickerAsset } from "expo-image-picker";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { Image as ExpoImage } from "expo-image";
import { useRouter, useLocalSearchParams } from "expo-router";

import { createPost } from "../../services/api";
import { useAuth } from "../../hooks/useAuth";
import { GLOBAL_HEADER_HEIGHT } from "../../components/GlobalHeader";
import VideoStudioMetaCard, {
  type VisibilityOption,
} from "../../components/VideoStudioMetaCard";
import VideoTrimEditorCard from "../../components/VideoTrimEditorCard";

// 🆕 Compresor de vídeo (cliente)
import { Video as VideoCompressor } from "react-native-compressor-with-h265";

// ======================================================
// 🔧 FIX UNIVERSAL PARA URIs CORRUPTAS (SAFE)
//   - No rompe rutas locales file:// / content://
//   - Solo sanea URLs remotas (http/https)
// ======================================================
export const fixUri = (uri: string): string => {
  if (!uri) return uri;

  let fixed = uri;

  // Normalizar file:/ → file:///
  if (fixed.startsWith("file:/") && !fixed.startsWith("file:///")) {
    fixed = fixed.replace("file:/", "file:///");
  }

  // Para rutas locales NO tocamos espacios ni caracteres especiales
  if (
    fixed.startsWith("file://") ||
    fixed.startsWith("content://") ||
    fixed.startsWith("asset://")
  ) {
    return fixed;
  }

  // Solo saneamos URLs remotas
  if (/^https?:\/\//i.test(fixed)) {
    if (fixed.includes(" ")) {
      fixed = fixed.replace(/ /g, "%20");
    }
    fixed = fixed.replace(/[\[\]\(\)]/g, "");
  }

  return fixed;
};

// ======================================================
// 🔧 Helper tamaño imagen
// ======================================================
async function getImageSizeSafe(uri: string) {
  try {
    const safeUri = fixUri(uri);
    return await new Promise<{ width: number; height: number }>(
      (resolve, reject) => {
        Image.getSize(
          safeUri,
          (width, height) => resolve({ width, height }),
          (err) => reject(err)
        );
      }
    );
  } catch (e) {
    console.log("⚠️ getImageSizeSafe error:", e);
    return { width: 0, height: 0 };
  }
}

// ======================================================
// 🧭 Orientación de imagen
// ======================================================
type ImageOrientation = "horizontal" | "vertical" | "square" | "unknown";

function computeImageOrientation(
  width: number,
  height: number
): { orientation: ImageOrientation; aspectRatio: number | null } {
  if (!width || !height || width <= 0 || height <= 0) {
    return { orientation: "unknown", aspectRatio: null };
  }

  const aspectRatio = width / height;
  const diff = Math.abs(width - height);
  const threshold = Math.min(width, height) * 0.05;

  if (diff <= threshold) {
    return { orientation: "square", aspectRatio };
  }

  if (width > height) {
    return { orientation: "horizontal", aspectRatio };
  }

  return { orientation: "vertical", aspectRatio };
}

// ======================================================
// 📦 Tipo Media
// ======================================================
type MediaItem = {
  uri: string;
  type: string;
  name: string;
  isVideo: boolean;
  durationSec?: number;
  sizeMb?: number;
  wasTrimmed?: boolean;

  // Solo imágenes:
  imageWidth?: number;
  imageHeight?: number;
  orientation?: ImageOrientation;
  aspectRatio?: number | null;
};

const bytesToMb = (bytes?: number | null): number =>
  !bytes || bytes <= 0 ? 0 : bytes / (1024 * 1024);

// ======================================================
// ⏱ Normalización robusta de duración usando tamaño de archivo
// ======================================================
const normalizeDurationSec = (
  raw?: number | null,
  sizeBytes?: number | null
): number | undefined => {
  if (raw == null || !Number.isFinite(raw) || raw <= 0) return undefined;

  if (!sizeBytes || sizeBytes <= 0) {
    return raw;
  }

  const secAsSeconds = raw;
  const secAsMs = raw / 1000;

  if (!Number.isFinite(secAsSeconds) || secAsSeconds <= 0) {
    return secAsMs > 0 && Number.isFinite(secAsMs) ? secAsMs : undefined;
  }
  if (!Number.isFinite(secAsMs) || secAsMs <= 0) {
    return secAsSeconds;
  }

  const bitrateIfSec = (sizeBytes * 8) / secAsSeconds;
  const bitrateIfMs = (sizeBytes * 8) / secAsMs;

  const MIN_BITRATE = 100_000; // 0.1 Mbps
  const MAX_BITRATE = 100_000_000; // 100 Mbps;

  const secOk =
    bitrateIfSec >= MIN_BITRATE && bitrateIfSec <= MAX_BITRATE;
  const msOk =
    bitrateIfMs >= MIN_BITRATE && bitrateIfMs <= MAX_BITRATE;

  if (secOk && !msOk) return secAsSeconds;
  if (msOk && !secOk) return secAsMs;

  const targetBitrate = Math.sqrt(MIN_BITRATE * MAX_BITRATE);
  const distSec = Math.abs(Math.log(bitrateIfSec) - Math.log(targetBitrate));
  const distMs = Math.abs(Math.log(bitrateIfMs) - Math.log(targetBitrate));

  const chosen = distMs < distSec ? secAsMs : secAsSeconds;

  console.log("⏱ normalizeDurationSec:", {
    raw,
    sizeBytes,
    secAsSeconds,
    secAsMs,
    bitrateIfSec,
    bitrateIfMs,
    chosen,
  });

  return chosen;
};

const MAX_IMAGES = 10;

// ======================================================
// 🧠 Heurística rápida de categoría de video (hint para backend/IA)
// ======================================================
const inferVideoCategoryHint = (
  titleRaw: string,
  descriptionRaw: string
): string | null => {
  try {
    const text = `${titleRaw || ""} ${descriptionRaw || ""}`.toLowerCase();

    if (!text.trim()) return null;

    const containsAny = (words: string[]) =>
      words.some((w) => text.includes(w));

    // Comedia / humor
    if (
      containsAny([
        "broma",
        "bromas",
        "chiste",
        "chistes",
        "risa",
        "risas",
        "comedia",
        "meme",
        "memes",
        "gracioso",
        "graciosos",
        "funny",
        "humor",
      ])
    ) {
      return "comedia";
    }

    // Deportes
    if (
      containsAny([
        "fútbol",
        "futbol",
        "gol",
        "goles",
        "champions",
        "liga",
        "nba",
        "basket",
        "baloncesto",
        "deporte",
        "deportes",
      ])
    ) {
      return "deportes";
    }

    // Noticias / política / actualidad
    if (
      containsAny([
        "noticia",
        "noticias",
        "última hora",
        "ultima hora",
        "breaking",
        "actualidad",
        "política",
        "politica",
        "presidente",
        "gobierno",
        "elecciones",
      ])
    ) {
      return "noticias";
    }

    // Guerra / militar
    if (
      containsAny([
        "guerra",
        "militar",
        "ejército",
        "ejercito",
        "arma",
        "armas",
        "tanque",
        "tanques",
        "conflicto",
        "bombardeo",
        "misil",
        "misiles",
      ])
    ) {
      return "guerra";
    }

    // Películas / cine
    if (
      containsAny([
        "película",
        "pelicula",
        "cine",
        "trailer",
        "tráiler",
        "movie",
        "film",
        "netflix",
        "serie",
        "series",
      ])
    ) {
      return "películas";
    }

    // Música
    if (
      containsAny([
        "música",
        "musica",
        "canción",
        "cancion",
        "concierto",
        "cover",
        "guitarra",
        "piano",
        "banda",
        "álbum",
        "album",
      ])
    ) {
      return "música";
    }

    // Videojuegos / gaming
    if (
      containsAny([
        "juego",
        "juegos",
        "gaming",
        "gameplay",
        "fortnite",
        "minecraft",
        "call of duty",
        "cod",
        "league of legends",
        "lol",
      ])
    ) {
      return "videojuegos";
    }

    // Educación / tutoriales
    if (
      containsAny([
        "tutorial",
        "cómo hacer",
        "como hacer",
        "guía",
        "guia",
        "aprende",
        "aprende a",
        "clase",
        "curso",
        "explicación",
        "explicacion",
      ])
    ) {
      return "educación";
    }

    return null;
  } catch (e) {
    console.log("⚠️ inferVideoCategoryHint error:", e);
    return null;
  }
};

// ======================================================
// 🔑 HELPERS DE PERMISOS
// ======================================================
async function ensureGalleryPermission(): Promise<boolean> {
  try {
    const existing = await ImagePicker.getMediaLibraryPermissionsAsync();
    console.log("📸 existing gallery perm:", existing);

    if (existing.granted) return true;

    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    console.log("📸 requested gallery perm:", perm);

    if (perm.granted) return true;

    if (!perm.canAskAgain) {
      Alert.alert(
        "Permisos requeridos",
        "Debes activar manualmente el acceso a Fotos/Multimedia en los ajustes del sistema.",
        [
          {
            text: "Abrir ajustes",
            onPress: () => {
              if (Platform.OS === "android") {
                Linking.openSettings();
              }
            },
          },
          { text: "Cancelar", style: "cancel" },
        ]
      );
    } else {
      Alert.alert("Permisos requeridos", "Activa el acceso a la galería.");
    }

    return false;
  } catch (e) {
    console.log("❌ ensureGalleryPermission error:", e);
    Alert.alert("Error", "No se pudo comprobar el permiso de galería.");
    return false;
  }
}

async function ensureCameraPermission(): Promise<boolean> {
  try {
    const existing = await ImagePicker.getCameraPermissionsAsync();
    console.log("📷 existing camera perm:", existing);

    if (existing.granted) return true;

    const perm = await ImagePicker.requestCameraPermissionsAsync();
    console.log("📷 requested camera perm:", perm);

    if (perm.granted) return true;

    if (!perm.canAskAgain) {
      Alert.alert(
        "Permisos requeridos",
        "Debes activar manualmente el acceso a la cámara en los ajustes del sistema.",
        [
          {
            text: "Abrir ajustes",
            onPress: () => {
              if (Platform.OS === "android") {
                Linking.openSettings();
              }
            },
          },
          { text: "Cancelar", style: "cancel" },
        ]
      );
    } else {
      Alert.alert("Permisos requeridos", "Activa el acceso a la cámara.");
    }

    return false;
  } catch (e) {
    console.log("❌ ensureCameraPermission error:", e);
    Alert.alert("Error", "No se pudo comprobar el permiso de cámara.");
    return false;
  }
}

// ======================================================
// 🎬 MODO WHATSAPP: AVISO VIDEO GRANDE
// ======================================================
const VIDEO_WHATSAPP_LIMIT_MB = 500;

// 🆕 Límite para compresión en cliente
const VIDEO_CLIENT_COMPRESS_MIN_MB = 5; // no tiene sentido comprimir < 5MB
const VIDEO_CLIENT_COMPRESS_TARGET_MAX_MB = 80; // por encima de ~80MB intentamos bajar

type ClientCompressResult = {
  uri: string;
  sizeBytes?: number;
  sizeMb?: number;
};

// ======================================================
// 🆕 Compresión de video en cliente antes del backend
// ======================================================
async function compressVideoOnClient(
  uri: string,
  originalSizeBytes?: number | null
): Promise<ClientCompressResult> {
  try {
    // Si no es un path file://, mejor no tocarlo (content://, ph://, etc.)
    if (!uri.startsWith("file://")) {
      console.log(
        "ℹ️ compressVideoOnClient: URI no es file://, se omite",
        uri
      );
      const sizeMbTmp =
        originalSizeBytes && originalSizeBytes > 0
          ? bytesToMb(originalSizeBytes)
          : undefined;
      return {
        uri,
        sizeBytes: originalSizeBytes || undefined,
        sizeMb: sizeMbTmp,
      };
    }

    let sizeBytes = originalSizeBytes ?? undefined;
    if (!sizeBytes) {
      const info = (await FileSystemLegacy.getInfoAsync(uri, {
        size: true,
      } as any)) as any;
      sizeBytes = info?.size as number | undefined;
    }

    const sizeMb = bytesToMb(sizeBytes);

    if (sizeMb && sizeMb < VIDEO_CLIENT_COMPRESS_MIN_MB) {
      // ya es pequeño, no merece la pena recomprimir
      return { uri, sizeBytes, sizeMb };
    }

    if (sizeMb && sizeMb <= VIDEO_CLIENT_COMPRESS_TARGET_MAX_MB) {
      // tamaño razonable, dejamos la compresión fina al backend (ffmpeg)
      return { uri, sizeBytes, sizeMb };
    }

    console.log(
      `🎚 Comenzando compresión en cliente: ~${sizeMb?.toFixed(
        1
      )}MB → objetivo <= ${VIDEO_CLIENT_COMPRESS_TARGET_MAX_MB}MB`
    );

    const compressedUri = await VideoCompressor.compress(
      uri,
      {
        compressionMethod: "auto",
      },
      (progress) => {
        console.log("🎚 Progreso compresión (cliente):", progress);
      }
    );

    const compressedInfo = (await FileSystemLegacy.getInfoAsync(
      compressedUri,
      { size: true } as any
    )) as any;

    const compressedBytes = compressedInfo?.size as number | undefined;
    const compressedMb = bytesToMb(compressedBytes);

    console.log("🎬 Cliente comprimió video:", {
      originalMb: sizeMb?.toFixed(1),
      compressedMb: compressedMb?.toFixed(1),
    });

    return {
      uri: compressedUri,
      sizeBytes: compressedBytes,
      sizeMb: compressedMb,
    };
  } catch (e) {
    console.log("⚠️ compressVideoOnClient error:", e);
    const sizeMbTmp =
      originalSizeBytes && originalSizeBytes > 0
        ? bytesToMb(originalSizeBytes)
        : undefined;
    return {
      uri,
      sizeBytes: originalSizeBytes || undefined,
      sizeMb: sizeMbTmp,
    };
  }
}

async function maybeTrimVideoIfNeeded(
  asset: ImagePickerAsset
): Promise<{ asset: ImagePickerAsset; wasTrimmed: boolean } | null> {
  try {
    if (!asset || !asset.uri) {
      return null;
    }

    const isVideo =
      asset.type === "video" || !!asset.type?.startsWith("video");

    if (!isVideo) {
      return { asset, wasTrimmed: false };
    }

    let sizeMb: number | undefined;
    try {
      const info = (await FileSystemLegacy.getInfoAsync(asset.uri, {
        size: true,
      } as any)) as any;
      sizeMb = bytesToMb(info?.size as number | undefined);
    } catch (e) {
      console.log(
        "⚠️ maybeTrimVideoIfNeeded getInfoAsync error:",
        (e as any)?.message || e
      );
    }

    if (!sizeMb || sizeMb <= VIDEO_WHATSAPP_LIMIT_MB) {
      return { asset, wasTrimmed: false };
    }

    const choice = await new Promise<"trim" | "upload" | "cancel">(
      (resolve) => {
        Alert.alert(
          "Video muy grande",
          `Este video pesa ~${sizeMb.toFixed(
            1
          )} MB.\n\nEs posible que el servidor rechace archivos tan grandes.\n¿Qué quieres hacer?`,
          [
            {
              text: "Cancelar",
              style: "cancel",
              onPress: () => resolve("cancel"),
            },
            {
              text: "Subir igual",
              onPress: () => resolve("upload"),
            },
            {
              text: "Recortar después",
              onPress: () => resolve("trim"),
            },
          ],
          { cancelable: false }
        );
      }
    );

    if (choice === "cancel") {
      return null;
    }

    return { asset, wasTrimmed: false };
  } catch (e) {
    console.log("❌ maybeTrimVideoIfNeeded error:", e);
    return { asset, wasTrimmed: false };
  }
}

// ======================================================
// 📄 COMPONENTE PRINCIPAL
// ======================================================
export default function CreatePostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { repostId, repostUrl, repostUser, repostNote } = useLocalSearchParams<{
    repostId?: string | string[];
    repostUrl?: string | string[];
    repostUser?: string | string[];
    repostNote?: string | string[];
  }>();
  const { token, loading: authLoading, syncUserProfile } = useAuth();
  const headerOffset = insets.top + GLOBAL_HEADER_HEIGHT;

  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  // 🛠 FIX: lock de envío real para evitar doble createPost
  const isSubmittingRef = useRef(false);

  // 🎥 Meta tipo YouTube Studio
  const [videoTitle, setVideoTitle] = useState("");
  const [videoVisibility, setVideoVisibility] =
    useState<VisibilityOption>("public");
  const [videoThumbnailFile, setVideoThumbnailFile] = useState<{
    uri: string;
    type: string;
    name: string;
  } | null>(null);

  const opacityAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(40))[0];

  const isPickingRef = useRef(false);
  const isCapturingRef = useRef(false);

  const isVideoPost = media.length === 1 && media[0].isVideo;

  useEffect(() => {
    console.log("🔍 media:", media);
  }, [media]);

  useEffect(() => {
    if (!media.some((m) => m.isVideo)) {
      setVideoTitle("");
      setVideoVisibility("public");
      setVideoThumbnailFile(null);
    }
  }, [media]);

  // Prefill cuando venimos a repostear otro post
  useEffect(() => {
    if (content.trim()) return; // no sobreescribir si el usuario ya escribió

    const first = (val?: string | string[]) =>
      Array.isArray(val) ? val[0] : val;

    const note = first(repostNote);
    if (note && note.trim()) {
      setContent(note.trim());
      return;
    }

    const refUser = first(repostUser);
    const refUrl = first(repostUrl);

    if (!refUser && !refUrl) return;

    const mention = refUser ? `@${refUser}` : "este post";
    const link = refUrl ? `\n\n${refUrl}` : "";
    setContent(`Reposteando ${mention}${link}`);
  }, [content, repostNote, repostUrl, repostUser]);

  useEffect(() => {
    if (!authLoading && !token) {
      Alert.alert(
        "Sesión expirada",
        "Vuelve a iniciar sesión para crear publicaciones.",
        [{ text: "OK", onPress: () => router.replace("/(auth)/login") }]
      );
    }
  }, [authLoading, token, router]);

  const playAnimation = () => {
    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
    ]).start();
  };

  // ======================================================
  // 🧠 NORMALIZACIÓN ASSET (imagen/video)
  // ======================================================
  const handlePickedAsset = async (asset: ImagePickerAsset) => {
    try {
      if (!asset || !asset.uri) return;

      const isVideo =
        asset.type === "video" || !!asset.type?.startsWith("video");

      let workingAsset: ImagePickerAsset | null = asset;
      let wasTrimmed = false;
      let durationSec: number | undefined;
      let sizeMb: number | undefined;
      let sizeBytes: number | undefined;

      if (isVideo) {
        // 1️⃣ Aviso/confirmación para vídeos MUY grandes
        const maybe = await maybeTrimVideoIfNeeded(asset);
        if (!maybe) return;
        workingAsset = maybe.asset;
        wasTrimmed = maybe.wasTrimmed;

        // 2️⃣ Tamaño original
        const fileInfo = (await FileSystemLegacy.getInfoAsync(
          workingAsset.uri,
          { size: true } as any
        )) as any;
        sizeBytes = fileInfo?.size as number | undefined;

        // 3️⃣ COMPRESIÓN EN CLIENTE (tipo WhatsApp) ANTES de subir al backend
        const compressionResult = await compressVideoOnClient(
          workingAsset.uri,
          sizeBytes
        );

        // usamos siempre el URI comprimido de salida
        workingAsset = {
          ...workingAsset,
          uri: compressionResult.uri,
        };
        sizeBytes = compressionResult.sizeBytes;
        sizeMb = compressionResult.sizeMb;

        // 4️⃣ Duración normalizada usando el archivo final (comprimido)
        const rawDuration =
          (workingAsset as any).duration ??
          (asset as any).duration ??
          undefined;

        durationSec = normalizeDurationSec(rawDuration, sizeBytes);

        console.log("🎬 Video detectado (cliente):", {
          uri: workingAsset.uri,
          rawDuration,
          durationSec,
          sizeMb,
        });
      }

      if (!workingAsset) return;

      let finalUri = fixUri(workingAsset.uri);
      let finalName =
        workingAsset.fileName ||
        `${Date.now()}.${isVideo ? "mp4" : "jpg"}`;
      let finalType =
        workingAsset.mimeType ||
        (isVideo ? "video/mp4" : "image/jpeg");

      let imgWidth: number | undefined;
      let imgHeight: number | undefined;
      let orientation: ImageOrientation | undefined;
      let aspectRatio: number | null | undefined;

      if (!isVideo) {
        const size1 = await getImageSizeSafe(finalUri);
        imgWidth = size1.width;
        imgHeight = size1.height;

        if (size1.width > 3000 || size1.height > 3000) {
          console.log("🔧 Imagen enorme, aplicando re-pick seguro");

          const pickerResult = await ImagePicker.launchImageLibraryAsync({
            allowsMultipleSelection: false,
            quality: 0.85,
            aspect:
              size1.width && size1.height
                ? [size1.width, size1.height]
                : undefined,
            // ⬇️ Solo imágenes, usando MediaType (no MediaTypeOptions)
            mediaTypes: "images",
            allowsEditing: true,
          });

          if (!pickerResult.canceled && pickerResult.assets?.[0]) {
            finalUri = fixUri(pickerResult.assets[0].uri);
            finalType = "image/jpeg";
            finalName = `image_${Date.now()}.jpg`;

            const size2 = await getImageSizeSafe(finalUri);
            imgWidth = size2.width;
            imgHeight = size2.height;
          }
        }

        if (imgWidth && imgHeight) {
          const info = computeImageOrientation(imgWidth, imgHeight);
          orientation = info.orientation;
          aspectRatio = info.aspectRatio;
        }
      }

      const newItem: MediaItem = {
        uri: finalUri,
        type: finalType,
        name: finalName,
        isVideo,
        durationSec,
        sizeMb,
        wasTrimmed: isVideo ? !!wasTrimmed : false,
        imageWidth: imgWidth,
        imageHeight: imgHeight,
        orientation,
        aspectRatio,
      };

      setMedia((prev) => {
        // 🛠 FIX DUPLICADOS en memoria:
        // si ya hay un media con misma uri+type+name, no lo añadimos otra vez
        const key = `${newItem.uri}::${newItem.type}::${newItem.name}`;
        const already = prev.some(
          (m) => `${m.uri}::${m.type}::${m.name}` === key
        );
        if (already) {
          return prev;
        }

        if (isVideo) {
          if (prev.length > 0) {
            Alert.alert(
              "Solo un video",
              "No puedes combinar un video con imágenes en la misma publicación."
            );
            return prev;
          }
          return [newItem];
        }

        const hasVideo = prev.some((m) => m.isVideo);
        if (hasVideo) {
          Alert.alert(
            "No se puede agregar imagen",
            "Este post ya tiene un video. No se pueden mezclar imágenes con video."
          );
          return prev;
        }

        if (prev.length >= MAX_IMAGES) {
          Alert.alert(
            "Límite de imágenes",
            `Solo puedes adjuntar hasta ${MAX_IMAGES} imágenes por publicación.`
          );
          return prev;
        }

        return [...prev, newItem];
      });

      playAnimation();
    } catch (e) {
      console.log("❌ handlePickedAsset error:", e);
    }
  };

  // ======================================================
  // 📸 GALERÍA (con anti-doble-tap)
  // ======================================================
  const pickMedia = async () => {
    if (isPickingRef.current) return;
    isPickingRef.current = true;
    try {
      const ok = await ensureGalleryPermission();
      if (!ok) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        // ⬇️ Quitar allowsEditing cuando hay selección múltiple
        quality: 0.85,
        // ⬇️ Usar MediaType en vez de MediaTypeOptions.All
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
      });

      console.log("📸 gallery result:", result);

      if (result.canceled || !result.assets?.length) return;

      for (const asset of result.assets) {
        await handlePickedAsset(asset);
      }
    } catch (e) {
      console.log("❌ pickMedia error:", e);
      try {
        Alert.alert("Error", "No se pudo abrir la galería.");
      } catch {}
    } finally {
      isPickingRef.current = false;
    }
  };

  // ======================================================
  // 📷 CÁMARA (con anti-doble-tap)
  // ======================================================
  const captureMedia = async () => {
    if (isCapturingRef.current) return;
    isCapturingRef.current = true;
    try {
      const ok = await ensureCameraPermission();
      if (!ok) return;

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.85,
        // ⬇️ También aquí MediaType en vez de MediaTypeOptions.All
        mediaTypes: ["images", "videos"],
      });

      console.log("📷 camera result:", result);

      if (result.canceled || !result.assets?.[0]) return;

      await handlePickedAsset(result.assets[0]);
    } catch (e) {
      console.log("❌ captureMedia error:", e);
      try {
        Alert.alert("Error", "No se pudo usar la cámara.");
      } catch {}
    } finally {
      isCapturingRef.current = false;
    }
  };

  // Miniatura manual para videos
  const pickVideoThumbnail = async () => {
    try {
      const ok = await ensureGalleryPermission();
      if (!ok) return;

      const result = await ImagePicker.launchImageLibraryAsync({
        allowsMultipleSelection: false,
        allowsEditing: true,
        quality: 0.85,
        // ⬇️ Solo imágenes, versión nueva
        mediaTypes: "images",
      });

      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setVideoThumbnailFile({
        uri: fixUri(asset.uri),
        type: asset.mimeType || "image/jpeg",
        name: asset.fileName || `thumbnail_${Date.now()}.jpg`,
      });
    } catch (e) {
      console.log("❌ pickVideoThumbnail error:", e);
      try {
        Alert.alert("Error", "No se pudo elegir la miniatura.");
      } catch {}
    }
  };

  const removeMedia = (i: number) =>
    setMedia((prev) => prev.filter((_, idx) => idx !== i));

  // ======================================================
  // 🚀 ENVIAR PUBLICACIÓN (REAL)
  // ======================================================
  const handleSubmit = async () => {
    // 🛠 FIX: doble guard → state + ref sincrono
    if (loading || isSubmittingRef.current) return;
    isSubmittingRef.current = true;

    const baseText = content.trim();
    const titleText = isVideoPost ? videoTitle.trim() : "";

    const text = titleText ? `${titleText}\n\n${baseText}`.trim() : baseText;

    if (!text && media.length === 0) {
      Alert.alert(
        "Contenido requerido",
        "Agrega texto o al menos una imagen/video para publicar."
      );
      isSubmittingRef.current = false;
      return;
    }

    if (!token) {
      Alert.alert("Sesión requerida", "Inicia sesión.");
      router.replace("/(auth)/login");
      isSubmittingRef.current = false;
      return;
    }

    if (
      isVideoPost &&
      media[0]?.sizeMb &&
      media[0].sizeMb > VIDEO_WHATSAPP_LIMIT_MB
    ) {
      Alert.alert(
        "Video demasiado grande",
        `El video pesa ~${media[0].sizeMb.toFixed(
          1
        )} MB, por encima del límite permitido.\nRecorta el video o elige uno más pequeño.`
      );
      isSubmittingRef.current = false;
      return;
    }

    // 🔎 Hint de categoría de video para el backend/IA (no rompe nada)
    let categoryHint: string | undefined;
    if (isVideoPost) {
      const hint = inferVideoCategoryHint(titleText, baseText);
      if (hint) {
        categoryHint = hint;
        console.log("🧠 categoryHint inferido para video:", hint);
      }
    }

    try {
      setLoading(true);

      const videoMeta =
        isVideoPost && media[0]?.isVideo
          ? {
              title: videoTitle.trim() || undefined,
              visibility: videoVisibility,
              thumbnail: videoThumbnailFile,
              // 🧠 Hint opcional de categoría (ej: "comedia", "deportes", "noticias")
              categoryHint,
            }
          : undefined;

      // 🧹 FIX DUPLICADOS hacia backend:
      // nos quedamos con media única por uri+type+name
      const uniqueMedia: MediaItem[] =
        media.length > 0
          ? Array.from(
              new Map(
                media.map((m) => [
                  `${m.uri}::${m.type}::${m.name}`,
                  m,
                ])
              ).values()
            )
          : [];

      const payloadMedia =
        uniqueMedia.length > 0
          ? uniqueMedia.map((m, index) => ({
              uri: m.uri,
              type: m.type,
              name: m.name,
              isVideo: m.isVideo,
              durationSec: m.durationSec,
              sizeMb: m.sizeMb,
              wasTrimmed: m.wasTrimmed,
              // meta extra de imágenes (seguro, el backend actual las puede ignorar)
              imageWidth: m.imageWidth,
              imageHeight: m.imageHeight,
              orientation: m.orientation,
              aspectRatio: m.aspectRatio,
              // meta de video solo en el primer video
              ...(m.isVideo && index === 0 && videoMeta
                ? { videoMeta }
                : {}),
            }))
          : null;

      console.log("📤 Enviando nuevo post:", {
        content: text,
        files: payloadMedia ? payloadMedia.length : 0,
      });

      await createPost(text, payloadMedia as any);

      Alert.alert("Publicado", "Tu publicación ha sido creada.");
      await syncUserProfile?.();
      setContent("");
      setVideoTitle("");
      setVideoVisibility("public");
      setVideoThumbnailFile(null);
      setMedia([]);
      router.back();
    } catch (e: any) {
      const status = e?.response?.status;
      const code = e?.response?.data?.code;
      const serverMsg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message;

      // 🔐 Log seguro (evita que toJSON crashee el app)
      try {
        const raw = typeof e?.toJSON === "function" ? e.toJSON() : e;
        console.log("❌ Error al publicar (detalles crudos):", raw);
      } catch {
        console.log("❌ Error al publicar (log fallback):", e);
      }

      if (status === 413 || code === "UPLOAD_LIMIT_EXCEEDED") {
        Alert.alert(
          "Video demasiado grande",
          "El servidor no acepta archivos de más de 500MB. Recorta el video antes de subirlo o elige un archivo más pequeño."
        );
      } else if (status === 524 || status === 504) {
        Alert.alert(
          "Servidor tardó demasiado",
          "El servidor tardó demasiado en procesar tu publicación.\n\n" +
            "Suele ocurrir con archivos pesados o cuando el servidor está muy ocupado. " +
            "Prueba recortar un poco más el video, comprimirlo o reintentar en unos minutos."
        );
      } else if (!status && e?.code === "ERR_NETWORK") {
        Alert.alert(
          "Error de red",
          "No se pudo contactar con el servidor (ERR_NETWORK).\n\n" +
            "Puede ser tu conexión, un bloqueo temporal o que el servidor/proxy esté rechazando la subida."
        );
      } else if (!status) {
        Alert.alert(
          "Sin conexión o servidor ocupado",
          "No se pudo contactar con el servidor. Revisa tu conexión o inténtalo de nuevo."
        );
      } else {
        console.log("❌ Error al publicar (mensaje servidor):", serverMsg);
        Alert.alert("Error", serverMsg || "No se pudo publicar.");
      }
    } finally {
      setLoading(false);
      isSubmittingRef.current = false;
    }
  };

  const firstMedia =
    media.length === 1
      ? { ...media[0], uri: fixUri(media[0].uri) }
      : null;

  const canSubmit =
    content.trim().length > 0 ||
    videoTitle.trim().length > 0 ||
    media.length > 0;

  const getOrientationLabel = (item: MediaItem | null): string | null => {
    if (!item || item.isVideo) return null;
    switch (item.orientation) {
      case "horizontal":
        return "Formato: Horizontal (paisaje)";
      case "vertical":
        return "Formato: Vertical (retrato)";
      case "square":
        return "Formato: Cuadrado";
      default:
        return null;
    }
  };

  const orientationLabel = getOrientationLabel(firstMedia);

  // ======================================================
  // 🧱 UI
  // ======================================================
  return (
    <>
      <StatusBar translucent backgroundColor="transparent" />

      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        {/* HEADER SIMPLE */}
        <View style={[styles.header, { paddingTop: headerOffset }]}>
          <TouchableOpacity
            style={[styles.closeAction, styles.headerButton]}
            onPress={() => router.back()}
            disabled={loading}
          >
            <Text style={styles.closeActionText}>Cerrar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            disabled={!canSubmit || loading}
            onPress={handleSubmit}
            style={[
              styles.createPostButton,
              styles.headerButton,
              (!canSubmit || loading) && styles.createPostButtonDisabled,
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.createPostButtonText}>Crear</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* CONTENIDO PRINCIPAL */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* INPUT TEXTO / DESCRIPCIÓN */}
          <TextInput
            value={content}
            onChangeText={setContent}
            style={styles.input}
            placeholder={
              isVideoPost
                ? "Cuenta a los usuarios de qué va tu video..."
                : "Escribe algo increíble..."
            }
            placeholderTextColor="#999"
            multiline
          />

          {/* PREVIEW PRINCIPAL */}
          {firstMedia && (
            <View style={styles.singlePreviewContainer}>
              {firstMedia.isVideo ? (
                <VideoTrimEditorCard
                  video={{
                    uri: firstMedia.uri,
                    durationSec: firstMedia.durationSec,
                    sizeMb: firstMedia.sizeMb,
                    wasTrimmed: firstMedia.wasTrimmed,
                  }}
                  thumbnailUri={videoThumbnailFile?.uri || undefined}
                  onVideoUpdated={(update) => {
                    setMedia((prev) =>
                      prev.map((m, idx) =>
                        idx === 0
                          ? {
                              ...m,
                              uri: update.uri,
                              durationSec: update.durationSec,
                              sizeMb: update.sizeMb,
                              wasTrimmed: update.wasTrimmed,
                            }
                          : m
                      )
                    );
                  }}
                />
              ) : (
                <>
                  <ExpoImage
                    source={{ uri: fixUri(firstMedia.uri) }}
                    style={[
                      styles.singlePreviewMedia,
                      firstMedia.aspectRatio
                        ? { aspectRatio: firstMedia.aspectRatio }
                        : { height: 260 },
                      firstMedia.orientation === "vertical"
                        ? { alignSelf: "center", width: "72%" }
                        : null,
                      firstMedia.orientation === "square"
                        ? { alignSelf: "center", width: "80%" }
                        : null,
                    ]}
                    contentFit="cover"
                  />
                  {orientationLabel && (
                    <Text style={styles.orientationLabel}>
                      {orientationLabel}
                    </Text>
                  )}
                </>
              )}

              {/* Panel tipo YouTube Studio SOLO para video */}
              {firstMedia.isVideo && (
                <VideoStudioMetaCard
                  title={videoTitle}
                  onChangeTitle={setVideoTitle}
                  durationSec={firstMedia.durationSec}
                  sizeMb={firstMedia.sizeMb}
                  visibility={videoVisibility}
                  onChangeVisibility={(v: VisibilityOption) =>
                    setVideoVisibility(v)
                  }
                  onChangeThumbnailFile={pickVideoThumbnail}
                  thumbnailFile={videoThumbnailFile || undefined}
                />
              )}

              <TouchableOpacity
                style={styles.singleRemoveBtn}
                onPress={() => removeMedia(0)}
              >
                <Text style={styles.removeBtnText}>Eliminar</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* PREVIEW MULTIPLE EN CARRUSEL (solo imágenes múltiples) */}
          {media.length > 1 && !isVideoPost && (
            <Animated.View
              style={{
                marginTop: 16,
                marginHorizontal: 16,
                opacity: opacityAnim,
                transform: [{ translateY: slideAnim }],
              }}
            >
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {media.map((item, index) => (
                  <View key={index} style={styles.mediaItemWrapper}>
                    <ExpoImage
                      source={{ uri: fixUri(item.uri) }}
                      style={styles.preview}
                      contentFit="cover"
                    />

                    <TouchableOpacity
                      style={styles.removeBtn}
                      onPress={() => removeMedia(index)}
                    >
                      <Text style={styles.removeBtnText}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </Animated.View>
          )}

          {media.length > 0 && (
            <TouchableOpacity
              style={styles.clearAllButton}
              onPress={() => setMedia([])}
            >
              <Text style={styles.clearAllText}>
                Eliminar todos los adjuntos
              </Text>
            </TouchableOpacity>
          )}

          {/* BOTONES GALERÍA / CÁMARA ELEGANTES */}
          <View style={styles.mediaRow}>
            <TouchableOpacity
              style={styles.mediaAction}
              onPress={pickMedia}
              activeOpacity={0.85}
            >
              <Text style={styles.mediaActionEmoji}>🖼️</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.mediaActionTitle}>Galería</Text>
                <Text style={styles.mediaActionSubtitle}>
                  Elige una foto, varias fotos o un video
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.mediaAction}
              onPress={captureMedia}
              activeOpacity={0.85}
            >
              <Text style={styles.mediaActionEmoji}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.mediaActionTitle}>Cámara</Text>
                <Text style={styles.mediaActionSubtitle}>
                  Captura una foto o video
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

// ======================================================
// 💅 ESTILOS
// ======================================================
const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    paddingHorizontal: 28,
    paddingBottom: 12,
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#fff",
    gap: 10,
  } as const,
  headerButton: { flex: 1 },

  input: {
    minHeight: 160,
    padding: 14,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 14,
    backgroundColor: "#f9f9f9",
    fontSize: 16,
    textAlignVertical: "top",
    borderColor: "#eee",
    borderWidth: 1,
  },

  singlePreviewContainer: {
    marginTop: 16,
    marginHorizontal: 16,
    position: "relative",
  },
  singlePreviewMedia: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  orientationLabel: {
    marginTop: 6,
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
  },
  singleRemoveBtn: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },

  mediaItemWrapper: {
    marginRight: 10,
    borderRadius: 18,
    overflow: "hidden",
    position: "relative",
  },
  preview: {
    width: 200,
    height: 200,
    borderRadius: 18,
  },
  removeBtn: {
    position: "absolute",
    top: 8,
    right: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  removeBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },

  mediaRow: {
    flexDirection: "row",
    marginTop: 24,
    marginHorizontal: 16,
    gap: 12,
    marginBottom: 16,
  },
  mediaAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#f4f4f5",
  },
  mediaActionEmoji: {
    fontSize: 24,
    marginRight: 10,
  },
  mediaActionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#111",
  },
  mediaActionSubtitle: {
    fontSize: 12,
    color: "#777",
    marginTop: 2,
  },
  clearAllButton: {
    marginTop: 12,
    marginHorizontal: 16,
  },
  clearAllText: {
    color: "#c00",
    fontWeight: "700",
  },

  createPostButton: {
    backgroundColor: "#111",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 52,
  },
  createPostButtonDisabled: {
    opacity: 0.4,
  },
  createPostButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  closeAction: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    backgroundColor: "#f7f7f8",
    alignItems: "center",
    justifyContent: "center",
  },
  closeActionText: {
    color: "#333",
    fontSize: 15,
    fontWeight: "600",
  },
});
