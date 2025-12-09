// components/VideoTrimEditorCard.tsx
// ======================================================
// 🎬 VideoTrimEditorCard — v3.2 (2025)
// ------------------------------------------------------
// ✔ UI tipo editor (preview + timeline + presets + panel inferior)
// ✔ Recorte REAL usando react-native-video-trim
// ✔ Barra IN/OUT interactiva (tap mueve IN o OUT)
// ✔ Controles finos ±1s
// ✔ Formato de tiempo claro: 20s, 2m 5s, 1h 40m 10s
// ✔ Miniaturas Inicio/Medio/Final/etc con expo-video-thumbnails
// ✔ Muestra tamaño estimado y real del clip recortado
// ======================================================

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Pressable,
  LayoutChangeEvent,
  GestureResponderEvent,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import * as FileSystemLegacy from "expo-file-system/legacy";
import * as VideoThumbnails from "expo-video-thumbnails";
import { trim, TrimResult } from "react-native-video-trim";

import QuickPlayVideo from "@/components/QuickPlayVideo";

// Tipo mínimo compatible con MediaItem de CreatePost
export type VideoMediaLike = {
  uri: string;
  durationSec?: number;
  sizeMb?: number;
  wasTrimmed?: boolean;
};

type Props = {
  video: VideoMediaLike;
  thumbnailUri?: string | null;
  onVideoUpdated?: (update: {
    uri: string;
    durationSec?: number;
    sizeMb?: number;
    wasTrimmed?: boolean;
  }) => void;
};

const bytesToMb = (bytes?: number | null): number =>
  !bytes || bytes <= 0 ? 0 : bytes / (1024 * 1024);

// 🔢 Formato de tiempo claro: 20s, 2m 5s, 1h 40m 10s
const formatHMS = (sec?: number): string => {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return "0s";
  const total = Math.round(sec); // redondeamos a segundos
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

const MIN_SEGMENT_SEC = 1.0;

const VideoTrimEditorCard: React.FC<Props> = ({
  video,
  thumbnailUri,
  onVideoUpdated,
}) => {
  const initialDuration =
    typeof video.durationSec === "number" && video.durationSec > 0
      ? video.durationSec
      : 60;

  const [videoDurationSec, setVideoDurationSec] =
    useState<number>(initialDuration);

  const [startSec, setStartSec] = useState(0);
  const [endSec, setEndSec] = useState(initialDuration);

  const [sizeMb, setSizeMb] = useState<number | undefined>(
    video.sizeMb || undefined
  );
  const [trimming, setTrimming] = useState(false);
  const [trimmedSizeMb, setTrimmedSizeMb] = useState<number | undefined>(
    undefined
  );
  const [trimSuccess, setTrimSuccess] = useState<null | boolean>(null);

  // Miniaturas para presets (inicio / medio / final / etc.)
  const [presetThumbs, setPresetThumbs] = useState<string[]>([]);

  // Ancho real de la barra de timeline para calcular posición IN/OUT
  const [timelineWidth, setTimelineWidth] = useState(0);

  const hasThumb = !!thumbnailUri;

  const normalizedUri = useMemo(
    () => (video.uri || "").replace(/\\/g, "/"),
    [video.uri]
  );

  // Si nos cambian el video desde fuera, reseteamos cosas
  useEffect(() => {
    setVideoDurationSec(
      typeof video.durationSec === "number" && video.durationSec > 0
        ? video.durationSec
        : initialDuration
    );
    setStartSec(0);
    setEndSec(
      typeof video.durationSec === "number" && video.durationSec > 0
        ? video.durationSec
        : initialDuration
    );
    if (typeof video.sizeMb === "number" && video.sizeMb > 0) {
      setSizeMb(video.sizeMb);
    }
    setTrimSuccess(null);
    setTrimmedSizeMb(undefined);
  }, [video.uri, video.durationSec, video.sizeMb, initialDuration]);

  // Cargar tamaño real si no viene del padre
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        if (!normalizedUri || sizeMb != null) return;

        const info = (await FileSystemLegacy.getInfoAsync(normalizedUri, {
          size: true,
        } as any)) as any;
        if (!mounted) return;
        const mb = bytesToMb(info?.size as number | undefined);
        setSizeMb(mb);
      } catch (e) {
        console.log("[VideoTrimEditorCard] getInfo error:", e);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [normalizedUri, sizeMb]);

  // Generar miniaturas para presets (5 puntos del video)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!normalizedUri || !videoDurationSec) return;

      try {
        const fractions = [0.0, 0.25, 0.5, 0.75, 1.0];
        const thumbs: string[] = [];

        for (const frac of fractions) {
          const timeMs = Math.max(
            0,
            Math.min(
              videoDurationSec * 1000,
              videoDurationSec * 1000 * frac
            )
          );
          try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(
              normalizedUri,
              { time: timeMs }
            );
            thumbs.push(uri);
          } catch (e) {
            console.log("[VideoTrimEditorCard] thumbnail error:", e);
            thumbs.push("");
          }
        }

        if (!cancelled) setPresetThumbs(thumbs);
      } catch (e) {
        console.log("[VideoTrimEditorCard] thumbnails global error:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedUri, videoDurationSec]);

  // Aseguramos que end siempre sea válido al inicio
  useEffect(() => {
    setEndSec((prev) => {
      const max = videoDurationSec;
      if (!Number.isFinite(prev) || prev > max) return max;
      if (max - prev < MIN_SEGMENT_SEC) return max;
      return prev;
    });
  }, [videoDurationSec]);

  const segmentDuration = useMemo(
    () => Math.max(endSec - startSec, MIN_SEGMENT_SEC),
    [startSec, endSec]
  );

  // Estimación de tamaño del clip según duración (proporcional)
  const estimatedClipMb = useMemo(() => {
    if (!sizeMb || !videoDurationSec || videoDurationSec <= 0) return undefined;
    const ratio = segmentDuration / videoDurationSec;
    if (!Number.isFinite(ratio) || ratio <= 0) return undefined;
    return sizeMb * ratio;
  }, [sizeMb, videoDurationSec, segmentDuration]);

  // === Helpers para clamping de IN/OUT y reset de estado de trim ===

  const resetTrimFlags = () => {
    setTrimSuccess(null);
    setTrimmedSizeMb(undefined);
  };

  const setStartClamped = (value: number) => {
    setStartSec((prev) => {
      let next = isNaN(value) ? prev : value;
      const maxStart = Math.max(videoDurationSec - MIN_SEGMENT_SEC, 0);

      if (next < 0) next = 0;
      if (next > maxStart) next = maxStart;

      setEndSec((endPrev) => {
        let e = endPrev;
        if (e - next < MIN_SEGMENT_SEC) {
          e = next + MIN_SEGMENT_SEC;
          if (e > videoDurationSec) e = videoDurationSec;
        }
        return e;
      });

      resetTrimFlags();
      return next;
    });
  };

  const setEndClamped = (value: number) => {
    setEndSec((prev) => {
      let next = isNaN(value) ? prev : value;

      if (next > videoDurationSec) next = videoDurationSec;
      if (next - startSec < MIN_SEGMENT_SEC) {
        next = startSec + MIN_SEGMENT_SEC;
        if (next > videoDurationSec) next = videoDurationSec;
      }

      resetTrimFlags();
      return next;
    });
  };

  const adjustStart = (delta: number) => {
    setStartClamped(startSec + delta);
  };

  const adjustEnd = (delta: number) => {
    setEndClamped(endSec + delta);
  };

  const applyPreset = (startFraction: number, endFraction: number) => {
    const s = Math.max(
      0,
      Math.min(videoDurationSec, videoDurationSec * startFraction)
    );
    let e = Math.max(
      s + MIN_SEGMENT_SEC,
      Math.min(videoDurationSec, videoDurationSec * endFraction)
    );
    if (e > videoDurationSec) e = videoDurationSec;

    setStartClamped(s);
    setEndClamped(e);
  };

  // === Timeline interactiva (tap mueve IN o OUT) ===

  const onTimelineLayout = (e: LayoutChangeEvent) => {
    setTimelineWidth(e.nativeEvent.layout.width);
  };

  const onTimelinePress = (e: GestureResponderEvent) => {
    if (!timelineWidth || videoDurationSec <= 0) return;

    const x = e.nativeEvent.locationX;
    const pct = x / timelineWidth;
    let sec = pct * videoDurationSec;

    if (sec < 0) sec = 0;
    if (sec > videoDurationSec) sec = videoDurationSec;

    const distToStart = Math.abs(sec - startSec);
    const distToEnd = Math.abs(sec - endSec);

    // Movemos el handle más cercano
    if (distToStart <= distToEnd) {
      setStartClamped(sec);
    } else {
      setEndClamped(sec);
    }
  };

  // === Recorte REAL usando react-native-video-trim ===

  const handleTrimApply = async () => {
    if (!normalizedUri || trimming) return;

    try {
      setTrimming(true);
      setTrimSuccess(null);

      // ruta sin "file://"
      const inputPath = normalizedUri.replace("file://", "");

      const start = Math.max(0, startSec);
      const end = Math.min(videoDurationSec, endSec);
      const duration = Math.max(end - start, MIN_SEGMENT_SEC);

      const startMs = Math.round(start * 1000);
      const endMs = Math.round(end * 1000);

      console.log(
        "[VideoTrimEditorCard] trim()",
        inputPath,
        "start=",
        startMs,
        "ms",
        "end=",
        endMs,
        "ms"
      );

      const trimResult: TrimResult = await trim(inputPath, {
        startTime: startMs,
        endTime: endMs,
      });

      const rawOutputPath =
        trimResult?.outputPath ||
        (trimResult as unknown as { path?: string })?.path ||
        "";

      const normalizedOutputPath =
        rawOutputPath.length > 0 ? rawOutputPath : normalizedUri;

      const outputUri = normalizedOutputPath.startsWith("file://")
        ? normalizedOutputPath
        : `file://${normalizedOutputPath}`;

      // Tamaño real del fichero recortado
      let mb: number | undefined = undefined;
      try {
        const info = (await FileSystemLegacy.getInfoAsync(outputUri, {
          size: true,
        } as any)) as any;
        mb = bytesToMb(info?.size as number | undefined);
        setTrimmedSizeMb(mb);
      } catch (e) {
        console.log("[VideoTrimEditorCard] getInfo output error:", e);
      }

      setTrimSuccess(true);

      // Actualizamos duración local para coherencia
      setVideoDurationSec(duration);
      setStartSec(0);
      setEndSec(duration);

      onVideoUpdated?.({
        uri: outputUri,
        durationSec: duration,
        sizeMb: mb,
        wasTrimmed: true,
      });
    } catch (e) {
      console.log("❌ [VideoTrimEditorCard] trim error:", e);
      setTrimSuccess(false);
    } finally {
      setTrimming(false);
    }
  };

  const disabledDone = trimming || !normalizedUri;

  const startPct =
    videoDurationSec > 0 ? (startSec / videoDurationSec) * 100 : 0;
  const endPct =
    videoDurationSec > 0 ? (endSec / videoDurationSec) * 100 : 100;
  const selectionWidthPct = Math.max(endPct - startPct, 2);

  return (
    <View style={styles.card}>
      {/* PREVIEW CON MINIATURA */}
      <View style={styles.previewSection}>
        <View style={styles.previewWrapper}>
          {hasThumb ? (
            <ExpoImage
              source={{ uri: thumbnailUri! }}
              style={styles.thumbnail}
              contentFit="cover"
            />
          ) : (
            <QuickPlayVideo
              uri={normalizedUri}
              autoPlay={false}
              loop={false}
              isVisible={true}
              style={styles.thumbnail}
            />
          )}

          <View style={styles.previewInfo}>
            <Text style={styles.previewTitle}>Video seleccionado</Text>

            {!!segmentDuration && (
              <Text style={styles.previewMeta}>
                Clip seleccionado: {formatHMS(segmentDuration)}
              </Text>
            )}

            {!!videoDurationSec && (
              <Text style={styles.previewMeta}>
                Original: {formatHMS(videoDurationSec)}
                {sizeMb ? ` • ~${sizeMb.toFixed(1)}MB` : ""}
              </Text>
            )}

            {estimatedClipMb && (
              <Text style={styles.previewMeta}>
                Estimado clip: ~{estimatedClipMb.toFixed(1)}MB
              </Text>
            )}

            {typeof trimmedSizeMb === "number" && (
              <Text style={styles.previewMeta}>
                Clip recortado: {trimmedSizeMb.toFixed(1)}MB
              </Text>
            )}

            {trimSuccess === true && (
              <Text style={[styles.previewMeta, { color: "#4ade80" }]}>
                ✅ Clip recortado listo para publicar
              </Text>
            )}

            {trimSuccess === false && (
              <Text style={[styles.previewMeta, { color: "#f97373" }]}>
                ⚠️ Error al recortar, revisa la consola
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* PANEL ESTILO EDITOR */}
      <View style={styles.bottomPanel}>
        {/* TIMELINE */}
        <View style={styles.timelineCard}>
          <View style={styles.timelineHeaderRow}>
            <Text style={styles.timelineTitle}>IN &amp; OUT</Text>
            <Text style={styles.timelineDuration}>
              {formatHMS(segmentDuration)}
            </Text>
          </View>

          <Pressable onPress={onTimelinePress}>
            <View
              style={styles.timelineBarWrapper}
              onLayout={onTimelineLayout}
            >
              <View style={styles.timelineBarBackground} />
              <View
                style={[
                  styles.timelineSelection,
                  {
                    left: `${startPct}%`,
                    width: `${selectionWidthPct}%`,
                  },
                ]}
              />
              <View
                style={[
                  styles.timelineHandle,
                  { left: `${startPct}%` },
                ]}
              />
              <View
                style={[
                  styles.timelineHandle,
                  { left: `${endPct}%` },
                ]}
              />
            </View>
          </Pressable>

          <View style={styles.timelineFooterRow}>
            <Text style={styles.timelineLabel}>
              Inicio: {formatHMS(startSec)}
            </Text>
            <Text style={styles.timelineLabel}>
              Fin: {formatHMS(endSec)}
            </Text>
            <Text style={styles.timelineMeta}>
              Duración total: {formatHMS(videoDurationSec)}
            </Text>
          </View>
        </View>

        {/* PESTAÑAS (solo UI de momento) */}
        <View style={styles.tabsRow}>
          <View style={[styles.tabChip, styles.tabChipActive]}>
            <Text style={styles.tabChipActiveText}>Combo</Text>
          </View>
          <View style={styles.tabChip}>
            <Text style={styles.tabChipText}>Intro</Text>
          </View>
          <View style={styles.tabChip}>
            <Text style={styles.tabChipText}>Outro</Text>
          </View>
        </View>

        {/* PRESETS con miniaturas */}
        <View style={styles.presetsRow}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {/* Inicio */}
            <TouchableOpacity
              style={styles.presetCard}
              onPress={() => applyPreset(0.0, 0.25)}
            >
              {presetThumbs[0] ? (
                <ExpoImage
                  source={{ uri: presetThumbs[0] }}
                  style={styles.presetThumb}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.presetThumb} />
              )}
              <Text style={styles.presetLabel}>Inicio</Text>
            </TouchableOpacity>

            {/* Medio */}
            <TouchableOpacity
              style={styles.presetCard}
              onPress={() => applyPreset(0.25, 0.5)}
            >
              {presetThumbs[2] ? (
                <ExpoImage
                  source={{ uri: presetThumbs[2] }}
                  style={styles.presetThumb}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.presetThumb} />
              )}
              <Text style={styles.presetLabel}>Medio</Text>
            </TouchableOpacity>

            {/* Final */}
            <TouchableOpacity
              style={styles.presetCard}
              onPress={() => applyPreset(0.5, 1.0)}
            >
              {presetThumbs[4] ? (
                <ExpoImage
                  source={{ uri: presetThumbs[4] }}
                  style={styles.presetThumb}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.presetThumb} />
              )}
              <Text style={styles.presetLabel}>Final</Text>
            </TouchableOpacity>

            {/* Clip corto */}
            <TouchableOpacity
              style={styles.presetCard}
              onPress={() => applyPreset(0.0, 0.15)}
            >
              {presetThumbs[1] ? (
                <ExpoImage
                  source={{ uri: presetThumbs[1] }}
                  style={styles.presetThumb}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.presetThumb} />
              )}
              <Text style={styles.presetLabel}>Clip corto</Text>
            </TouchableOpacity>

            {/* Clip largo */}
            <TouchableOpacity
              style={styles.presetCard}
              onPress={() => applyPreset(0.0, 0.5)}
            >
              {presetThumbs[3] ? (
                <ExpoImage
                  source={{ uri: presetThumbs[3] }}
                  style={styles.presetThumb}
                  contentFit="cover"
                />
              ) : (
                <View style={styles.presetThumb} />
              )}
              <Text style={styles.presetLabel}>Clip largo</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* CONTROLES FINOS */}
        <View style={styles.fineControlsRow}>
          <View style={styles.fineColumn}>
            <Text style={styles.fineLabel}>Inicio</Text>
            <Text style={styles.fineValue}>{formatHMS(startSec)}</Text>
            <View style={styles.fineButtonsRow}>
              <TouchableOpacity
                style={styles.fineButton}
                onPress={() => adjustStart(-1)}
              >
                <Text style={styles.fineButtonText}>-1s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.fineButton}
                onPress={() => adjustStart(+1)}
              >
                <Text style={styles.fineButtonText}>+1s</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.fineColumn}>
            <Text style={styles.fineLabel}>Fin</Text>
            <Text style={styles.fineValue}>{formatHMS(endSec)}</Text>
            <View style={styles.fineButtonsRow}>
              <TouchableOpacity
                style={styles.fineButton}
                onPress={() => adjustEnd(-1)}
              >
                <Text style={styles.fineButtonText}>-1s</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.fineButton}
                onPress={() => adjustEnd(+1)}
              >
                <Text style={styles.fineButtonText}>+1s</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* BOTÓN DONE */}
        <View style={styles.doneRow}>
          <TouchableOpacity
            style={[
              styles.doneButton,
              disabledDone && styles.doneButtonDisabled,
            ]}
            onPress={handleTrimApply}
            disabled={disabledDone}
          >
            {trimming ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.doneText}>DONE</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "100%",
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#050014",
  },

  // PREVIEW
  previewSection: {
    padding: 12,
  },
  previewWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumbnail: {
    width: 140,
    height: 140,
    borderRadius: 16,
    backgroundColor: "#000",
  },
  previewInfo: {
    flex: 1,
    marginLeft: 14,
  },
  previewTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  previewMeta: {
    color: "#d0c8ff",
    fontSize: 12,
    marginTop: 2,
  },

  // PANEL INFERIOR
  bottomPanel: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 6,
    backgroundColor: "#08081A",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },

  // TIMELINE
  timelineCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: "#11112B",
  },
  timelineHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  timelineTitle: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  timelineDuration: {
    color: "#E5D4FF",
    fontSize: 13,
    fontWeight: "700",
  },
  timelineBarWrapper: {
    marginVertical: 6,
    height: 36,
    justifyContent: "center",
  },
  timelineBarBackground: {
    height: 8,
    borderRadius: 999,
    backgroundColor: "#252552",
  },
  timelineSelection: {
    position: "absolute",
    top: "50%",
    marginTop: -6,
    height: 12,
    borderRadius: 999,
    backgroundColor: "#A855FF",
  },
  timelineHandle: {
    position: "absolute",
    top: "50%",
    marginTop: -12,
    width: 4,
    height: 24,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  timelineFooterRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  timelineLabel: {
    color: "#E5E5FF",
    fontSize: 11,
  },
  timelineMeta: {
    color: "#8B8BB5",
    fontSize: 11,
  },

  // TABS
  tabsRow: {
    flexDirection: "row",
    marginTop: 12,
    marginBottom: 8,
    gap: 8,
  },
  tabChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#14142A",
  },
  tabChipActive: {
    backgroundColor: "#A855FF",
  },
  tabChipText: {
    color: "#8A8AB5",
    fontSize: 11,
    fontWeight: "600",
  },
  tabChipActiveText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },

  // PRESETS
  presetsRow: {
    marginBottom: 10,
  },
  presetCard: {
    width: 90,
    marginRight: 8,
    borderRadius: 14,
    backgroundColor: "#181838",
    padding: 6,
  },
  presetThumb: {
    height: 48,
    borderRadius: 10,
    backgroundColor: "#2B2B5C",
    marginBottom: 4,
  },
  presetLabel: {
    color: "#E1E1FF",
    fontSize: 11,
    fontWeight: "600",
  },

  // CONTROLES FINOS
  fineControlsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    marginBottom: 10,
  },
  fineColumn: {
    flex: 1,
    marginHorizontal: 4,
    padding: 8,
    borderRadius: 14,
    backgroundColor: "#14142A",
  },
  fineLabel: {
    color: "#A7A7D5",
    fontSize: 11,
  },
  fineValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    marginTop: 2,
  },
  fineButtonsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  fineButton: {
    flex: 1,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
  },
  fineButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },

  // DONE
  doneRow: {
    alignItems: "flex-end",
  },
  doneButton: {
    marginTop: 2,
    paddingHorizontal: 26,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#A855FF",
  },
  doneButtonDisabled: {
    opacity: 0.5,
  },
  doneText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 0.8,
  },
});

export default VideoTrimEditorCard;
