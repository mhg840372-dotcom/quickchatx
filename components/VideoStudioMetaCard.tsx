// components/VideoStudioMetaCard.tsx
// ======================================================
// 🎬 VideoStudioMetaCard — v4 (2025)
// ------------------------------------------------------
// • Título estilo YouTube Studio
// • Selector de visibilidad (Público / Oculto / No listado)
// • Info rápida (duración, tamaño) con formato claro: 1h 40m 10s
// • Selector de portada con miniatura
//   - Muestra la miniatura que le pasa el padre por props
//   - Al tocar "Elegir portada" llama a onChangeThumbnailFile()
//   - El padre (CreatePost) abre la galería y setea thumbnailFile
// ======================================================

import React from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Image as ExpoImage } from "expo-image";

export type VisibilityOption = "public" | "private" | "unlisted";

type ThumbnailFile = {
  uri: string;
  type: string;
  name: string;
};

type Props = {
  title: string;
  onChangeTitle: (value: string) => void;

  durationSec?: number;
  sizeMb?: number | null;

  visibility?: VisibilityOption;
  onChangeVisibility?: (value: VisibilityOption) => void;

  // Miniatura actual (la que se usará como portada principal del video)
  thumbnailFile?: ThumbnailFile;

  // Callback que dispara el picker (lo maneja el padre: CreatePostScreen)
  // En create.tsx le estás pasando: onChangeThumbnailFile={pickVideoThumbnail}
  onChangeThumbnailFile?: () => void;
};

// 🔢 Formato de tiempo claro: 20s, 2m 5s, 1h 40m 10s
const formatHMS = (sec?: number) => {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "0s";

  const total = Math.round(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}h ${m}m ${s}s`;
  }
  if (m > 0) {
    return `${m}m ${s}s`;
  }
  return `${s}s`;
};

const formatMb = (mb?: number | null) => {
  if (mb == null || mb <= 0) return "";
  return `${mb.toFixed(1)}MB`;
};

const VIS_LABEL: Record<VisibilityOption, string> = {
  public: "Público",
  private: "Oculto",
  unlisted: "No listado",
};

const VideoStudioMetaCard: React.FC<Props> = ({
  title,
  onChangeTitle,
  durationSec,
  sizeMb,
  visibility = "public",
  onChangeVisibility,
  thumbnailFile,
  onChangeThumbnailFile,
}) => {
  const handleVisibilityPress = (value: VisibilityOption) => {
    if (value === visibility) return;
    onChangeVisibility?.(value);
  };

  const handleThumbnailPress = () => {
    onChangeThumbnailFile?.();
  };

  const infoText = [
    durationSec != null
      ? `Duración: ${formatHMS(durationSec)}`
      : null,
    sizeMb != null && sizeMb > 0
      ? `Tamaño: ${formatMb(sizeMb)}`
      : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <View style={styles.card}>
      <Text style={styles.titleLabel}>Detalles del video</Text>

      {/* TÍTULO */}
      <TextInput
        value={title}
        onChangeText={onChangeTitle}
        placeholder="Título del video"
        placeholderTextColor="#9ca3af"
        style={styles.titleInput}
      />

      {/* INFO RÁPIDA */}
      {infoText.length > 0 && (
        <Text style={styles.infoText}>{infoText}</Text>
      )}

      {/* VISIBILIDAD + MINIATURA */}
      <View style={styles.bottomRow}>
        {/* VISIBILIDAD */}
        <View style={styles.visibilityColumn}>
          <Text style={styles.sectionLabel}>Visibilidad</Text>
          <View style={styles.visibilityPillsRow}>
            {(["public", "private", "unlisted"] as VisibilityOption[]).map(
              (opt) => {
                const active = visibility === opt;
                return (
                  <TouchableOpacity
                    key={opt}
                    style={[
                      styles.visibilityPill,
                      active && styles.visibilityPillActive,
                    ]}
                    onPress={() => handleVisibilityPress(opt)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.visibilityPillText,
                        active && styles.visibilityPillTextActive,
                      ]}
                    >
                      {VIS_LABEL[opt]}
                    </Text>
                  </TouchableOpacity>
                );
              }
            )}
          </View>
        </View>

        {/* MINIATURA / PORTADA */}
        <TouchableOpacity
          style={styles.thumbContainer}
          onPress={handleThumbnailPress}
          activeOpacity={0.9}
        >
          {thumbnailFile?.uri ? (
            <ExpoImage
              source={{ uri: thumbnailFile.uri }}
              style={styles.thumbImage}
              contentFit="cover"
            />
          ) : (
            <View style={styles.thumbPlaceholder}>
              <Text style={styles.thumbPlaceholderIcon}>🖼️</Text>
            </View>
          )}

          <View style={styles.thumbLabelWrapper}>
            <Text style={styles.thumbLabelMain}>
              {thumbnailFile ? "Cambiar portada" : "Elegir portada"}
            </Text>
            <Text style={styles.thumbLabelSub}>
              Esta imagen será la portada
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default VideoStudioMetaCard;

// ======================================================
// 💅 ESTILOS
// ======================================================
const styles = StyleSheet.create({
  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#050816",
    borderWidth: 1,
    borderColor: "#111827",
  },
  titleLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 6,
  },
  titleInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#1f2937",
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: "#f9fafb",
    fontSize: 14,
    backgroundColor: "#030712",
  },
  infoText: {
    marginTop: 6,
    fontSize: 11,
    color: "#9ca3af",
  },

  bottomRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "flex-start",
  },

  // VISIBILIDAD
  visibilityColumn: {
    flex: 1,
    paddingRight: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#e5e7eb",
    marginBottom: 4,
  },
  visibilityPillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  visibilityPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4b5563",
    backgroundColor: "#020617",
  },
  visibilityPillActive: {
    borderColor: "#6366f1",
    backgroundColor: "#111827",
  },
  visibilityPillText: {
    fontSize: 11,
    color: "#9ca3af",
    fontWeight: "500",
  },
  visibilityPillTextActive: {
    color: "#e5e7eb",
    fontWeight: "700",
  },

  // MINIATURA
  thumbContainer: {
    width: 150,
    flexDirection: "row",
    alignItems: "center",
  },
  thumbImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#0b1120",
  },
  thumbPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: "#111827",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbPlaceholderIcon: {
    fontSize: 24,
    color: "#9ca3af",
  },
  thumbLabelWrapper: {
    marginLeft: 8,
    flex: 1,
  },
  thumbLabelMain: {
    fontSize: 11,
    fontWeight: "700",
    color: "#e5e7eb",
  },
  thumbLabelSub: {
    marginTop: 2,
    fontSize: 10,
    color: "#9ca3af",
  },
});
