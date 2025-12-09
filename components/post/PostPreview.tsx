// ======================================================
// 📄 PostPreview.tsx — v10.5 ULTRA-SAFE (2025)
// ------------------------------------------------------
// 🛡 FIX: URIs normalizadas con fixUri() (anti crash ExpoImage)
// 🛡 FIX: paths locales corruptos: espacios, file:/ → OK
// 🖼 Imagen segura → ExpoImage
// 🎬 Video → placeholder estable
// 🔧 Logs defensivos completos
// ======================================================

import { api } from "@/services/api";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { useEffect, useMemo } from "react";
import {
  Dimensions,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

// ⬅️ IMPORTAMOS fixUri PARA EVITAR CRASHES
import { fixUri } from "../../app/post/create"; // Ajusta el path si es necesario

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ======================================================
// 🧩 Tipos
// ======================================================
type PreviewMedia = {
  uri: string;
  type?: string;
  isVideo?: boolean;
  isLocal?: boolean;
};

type Props = {
  content: string;
  media?: PreviewMedia | null;
  onClose: () => void;
  onConfirm: () => void;
};

// ======================================================
// 🔧 Obtener baseURL + resolver rutas relativas
// ======================================================
const getApiBase = (): string => {
  try {
    const base = (api as any)?.defaults?.baseURL;
    if (typeof base === "string" && base.length > 0) {
      return base.replace(/\/$/, "");
    }
  } catch {}

  return "https://api.quickchatx.com";
};

const API_BASE = getApiBase();

const resolvePreviewUri = (url?: string | null): string | null => {
  if (!url || typeof url !== "string") return null;

  const fixed = fixUri(url);

  if (
    fixed.startsWith("http://") ||
    fixed.startsWith("https://") ||
    fixed.startsWith("file://") ||
    fixed.startsWith("content://") ||
    fixed.startsWith("asset://")
  ) {
    return fixed;
  }

  return `${API_BASE}${fixed.startsWith("/") ? "" : "/"}${fixed}`;
};

// ======================================================
// 📦 COMPONENTE PRINCIPAL
// ======================================================
export default function PostPreview({
  content,
  media,
  onClose,
  onConfirm,
}: Props) {
  
  // Logs para debug real
  useEffect(() => {
    try {
      console.log("👁 [PostPreview] media recibido:", JSON.stringify(media, null, 2));
    } catch {
      console.log("👁 [PostPreview] media recibido (no serializable)");
    }
  }, [media]);

  // ======================================================
  // 🧠 Normalización super defensiva
  // ======================================================
  const normalizedMedia = useMemo<PreviewMedia | null>(() => {
    try {
      if (!media || !media.uri) {
        console.log("👁 [PostPreview] media vacío");
        return null;
      }

      const rawUri = String(media.uri);

      // ⛑ APLICAMOS FIXURI ANTES QUE NADA
      let safeUri = fixUri(rawUri);

      // Resolver si es relativa
      safeUri = resolvePreviewUri(safeUri) || safeUri;

      const type = typeof media.type === "string" ? media.type : "";

      const isVideo =
        media.isVideo ||
        type.startsWith("video/") ||
        safeUri.toLowerCase().endsWith(".mp4") ||
        safeUri.toLowerCase().endsWith(".mov") ||
        safeUri.toLowerCase().endsWith(".mkv") ||
        safeUri.toLowerCase().endsWith(".webm");

      const isLocal =
        safeUri.startsWith("file://") || safeUri.startsWith("content://");

      const normalized: PreviewMedia = {
        uri: safeUri,
        type,
        isVideo,
        isLocal,
      };

      console.log("👁 [PostPreview] normalizado:", JSON.stringify(normalized, null, 2));

      return normalized;
    } catch (err) {
      console.log("❌ [PostPreview] normalización falló:", (err as any)?.message || err);
      return null;
    }
  }, [media]);

  // ======================================================
  // 🎥 Render media seguro (nunca crashea)
  // ======================================================
  const renderMedia = () => {
    if (!normalizedMedia?.uri) return null;

    // --------------------------------------------------
    // 🎬 VIDEO → Placeholder
    // --------------------------------------------------
    if (normalizedMedia.isVideo) {
      return (
        <View style={[styles.mediaBox, styles.videoPlaceholder]}>
          <Text style={styles.videoIcon}>▶</Text>
          <Text style={styles.videoText}>Video listo para publicar</Text>
        </View>
      );
    }

    // --------------------------------------------------
    // 🖼 IMAGEN → ExpoImage (super stable)
    // --------------------------------------------------
    console.log("🖼 [PostPreview] cargando imagen:", normalizedMedia.uri);

    return (
      <ExpoImage
        source={{ uri: normalizedMedia.uri }}
        style={styles.image}
        contentFit="cover"
        onError={(e) =>
          console.log("❌ [PostPreview] Error cargando imagen:", (e as any)?.error)
        }
      />
    );
  };

  // ======================================================
  // 🧱 Render principal
  // ======================================================
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={26} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Vista previa</Text>
        </View>

        {/* TEXTO */}
        {content?.trim() && (
          <Text style={styles.content}>{content.trim()}</Text>
        )}

        {/* MEDIA */}
        {renderMedia()}

        {/* FOOTER */}
        <View style={styles.footer}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.publishBtn} onPress={onConfirm}>
            <Text style={styles.publishText}>Publicar</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ======================================================
// 🎨 ESTILOS
// ======================================================
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#fff",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingVertical: 20,
    backgroundColor: "#fff",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  backBtn: {
    marginRight: 10,
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111",
  },

  content: {
    fontSize: 16,
    lineHeight: 22,
    color: "#111",
    marginBottom: 16,
  },

  // Imagen
  image: {
    width: SCREEN_WIDTH - 36,
    height: 330,
    borderRadius: 12,
    backgroundColor: "#000",
    alignSelf: "center",
    marginBottom: 20,
  },

  // Placeholder video
  mediaBox: {
    width: SCREEN_WIDTH - 36,
    height: 330,
    borderRadius: 12,
    backgroundColor: "#000",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  videoPlaceholder: {
    paddingHorizontal: 8,
  },
  videoIcon: {
    fontSize: 48,
    color: "white",
    marginBottom: 8,
  },
  videoText: {
    color: "#ddd",
    fontSize: 14,
    textAlign: "center",
  },

  footer: {
    flexDirection: "row",
    marginTop: 10,
    justifyContent: "space-between",
  },
  cancelBtn: {
    flex: 1,
    marginRight: 8,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    justifyContent: "center",
    alignItems: "center",
  },
  cancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#444",
  },
  publishBtn: {
    flex: 1,
    marginLeft: 8,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#007AFE",
    justifyContent: "center",
    alignItems: "center",
  },
  publishText: {
    color: "white",
    fontSize: 16,
    fontWeight: "700",
  },
});
