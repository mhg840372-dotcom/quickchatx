// ======================================================
// 📄 QuickPlayVideo.tsx
// ======================================================
import type { ComponentRef, MutableRefObject } from "react";
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  LayoutChangeEvent,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  AppState,
  AppStateStatus,
  Platform,
} from "react-native";

import {
  Heart,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import Video from "react-native-video";

import {
  getGlobalMuted,
  setGlobalMuted,
  subscribeToGlobalMuted,
} from "@/utils/videoAudioState";

import { useAuth } from "@/hooks/useAuth";
import { api } from "@/services/api";

type VideoRef = ComponentRef<typeof Video>;

export type VideoViewReason = "play" | "unmute" | "fullscreen";

type Props = {
  uri: string;
  thumbnail?: string;
  autoPlay?: boolean;
  loop?: boolean;
  isVisible?: boolean;
  style?: any;
  qualityLabel?: string;
  manifestUrl?: string;
  onView?: (reason: VideoViewReason) => void;
};

const formatTime = (sec: number) => {
  if (!sec || sec < 0) sec = 0;
  const total = Math.floor(sec);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const getApiBase = () => {
  try {
    const base = (api as any)?.defaults?.baseURL;
    if (typeof base === "string" && base.length > 0) {
      return base.replace(/\/$/, "");
    }
  } catch {}
  // IMPORTANTE: mismo host que tus URLs públicas
  return "https://api.quickchatx.com";
};

const API_BASE = getApiBase();
const FILE_BASE = API_BASE;

// ======================================================
// 🟣 Helper: derivar thumbnail a partir del video
//    - /uploads/videos/vid_1234_720p.mp4 → /uploads/thumbs/vid_1234.jpg
//    - /uploads/<user>/<file>.mp4        → /uploads/thumbs/<user>/<file>.jpg
// ======================================================
const deriveThumbnailFromVideoUri = (
  videoUrl?: string | null
): string | null => {
  if (!videoUrl || typeof videoUrl !== "string") return null;

  try {
    let origin = "";
    let path = videoUrl;

    // 🛑 No intentamos derivar thumbs para rutas locales del dispositivo
    if (/^file:\/\//i.test(videoUrl)) {
      if (__DEV__) {
        console.log("[QuickPlayVideo] deriveThumb SKIP file://", {
          videoUrl,
        });
      }
      return null;
    }

    if (/^https?:\/\//i.test(videoUrl)) {
      const u = new URL(videoUrl);
      origin = `${u.protocol}//${u.host}`;
      path = u.pathname || "";
    }

    if (!path.startsWith("/")) path = `/${path}`;

    // 1) /uploads/videos/vid_1764898279707_720p.mp4
    let m =
      path.match(
        /\/uploads\/videos\/(vid_\d+)[^/]*\.(mp4|mov|m4v|webm)$/i
      ) || null;

    if (m) {
      const baseName = m[1]; // vid_1764898279707
      const thumbPath = `/uploads/thumbs/${baseName}.jpg`;
      const finalUrl = origin
        ? `${origin}${thumbPath}`
        : `${FILE_BASE}${thumbPath}`;
      if (__DEV__) {
        console.log("[QuickPlayVideo] deriveThumb VIDEOS", {
          videoUrl,
          thumbPath,
          finalUrl,
        });
      }
      return finalUrl;
    }

    // 2) /uploads/<user>/<file>.mp4  → /uploads/thumbs/<user>/<file>.jpg
    //    ej: /uploads/mikehg/1764938786242_xxx.mp4
    m =
      path.match(
        /\/uploads\/([^/]+)\/([^/]+)\.(mp4|mov|m4v|webm)$/i
      ) || null;

    if (m) {
      const folder = m[1]; // p.ej. "mikehg"
      const baseName = m[2]; // "1764938786242_..."
      // Evitar interferir con /uploads/videos o /uploads/thumbs directos
      if (
        folder.toLowerCase() !== "videos" &&
        folder.toLowerCase() !== "thumbs"
      ) {
        const thumbPath = `/uploads/thumbs/${folder}/${baseName}.jpg`;
        const finalUrl = origin
          ? `${origin}${thumbPath}`
          : `${FILE_BASE}${thumbPath}`;
        if (__DEV__) {
          console.log("[QuickPlayVideo] deriveThumb USER", {
            videoUrl,
            thumbPath,
            finalUrl,
          });
        }
        return finalUrl;
      }
    }

    if (__DEV__) {
      console.log("[QuickPlayVideo] deriveThumb NO MATCH", {
        path,
        videoUrl,
      });
    }
    return null;
  } catch (e) {
    if (__DEV__) {
      console.log("[QuickPlayVideo] deriveThumb ERROR", {
        videoUrl,
        error: String(e),
      });
    }
    return null;
  }
};

export default function QuickPlayVideo({
  uri,
  thumbnail,
  autoPlay = true,
  loop = true,
  isVisible = true,
  style,
  qualityLabel = "HD",
  manifestUrl,
  onView,
}: Props) {
  const videoRef = useRef<VideoRef>(null);
  const fsRef = useRef<VideoRef>(null);

  const { token } = useAuth();

  const [videoUri, setVideoUri] = useState(uri);

  // 🖼 Miniatura priorizando prop → deriveThumbnailFromVideoUri
  const [thumbUri, setThumbUri] = useState<string | undefined>(() => {
    if (thumbnail) return thumbnail;
    const derived = deriveThumbnailFromVideoUri(uri);
    return derived || undefined;
  });

  const [qualityState, setQualityState] = useState<string | undefined>(
    qualityLabel || undefined
  );

  const [playing, setPlaying] = useState(autoPlay);
  const [muted, setMuted] = useState<boolean>(() => getGlobalMuted());

  const [ready, setReady] = useState(false);
  const [liked, setLiked] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(false);

  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [buffering, setBuffering] = useState(false);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fade = useRef(new Animated.Value(1)).current;
  const heartScale = useRef(new Animated.Value(0)).current;

  const lastTap = useRef(0);
  const seekWidth = useRef(0);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showThumbnail, setShowThumbnail] = useState<boolean>(() => {
    if (thumbnail) return true;
    const derived = deriveThumbnailFromVideoUri(uri);
    return Boolean(derived);
  });

  const appState = useRef<AppStateStatus>(AppState.currentState);

  const hasRegisteredViewRef = useRef(false);

  // ======================
  // Sync props → state
  // ======================
  useEffect(() => {
    setVideoUri(uri);
    setError(null);
    hasRegisteredViewRef.current = false;

    setThumbUri((prev) => {
      if (thumbnail) return thumbnail;
      const derived = deriveThumbnailFromVideoUri(uri);
      if (__DEV__) {
        console.log("[QuickPlayVideo] INIT", {
          uri,
          thumbnail,
          derived,
        });
      }
      return derived || prev;
    });

    setShowThumbnail(() => {
      if (thumbnail) return true;
      const derived = deriveThumbnailFromVideoUri(uri);
      return Boolean(derived);
    });
  }, [uri, thumbnail]);

  useEffect(() => {
    setQualityState(qualityLabel || undefined);
  }, [qualityLabel]);

  useEffect(() => {
    setPlaying(isVisible && autoPlay && !ended && !error);
  }, [isVisible, autoPlay, ended, error]);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  // ======================
  // Registrar view (una sola vez)
  // ======================
  const registerView = useCallback(
    (reason: VideoViewReason) => {
      if (hasRegisteredViewRef.current) return;
      hasRegisteredViewRef.current = true;
      onView?.(reason);
    },
    [onView]
  );

  // ======================
  // Global audio subscription
  // ======================
  useEffect(() => {
    const unsub = subscribeToGlobalMuted((m) => {
      setMuted(m);
    });
    return unsub;
  }, []);

  const toggleGlobalMuted = () => {
    setMuted((prev) => {
      const next = !prev;
      setGlobalMuted(next);

      if (!next) {
        registerView("unmute");
      }

      return next;
    });
  };

  // ======================
  // AppState → pausa en background
  // ======================
  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      const prev = appState.current;
      appState.current = nextState;

      if (
        prev === "active" &&
        (nextState === "background" || nextState === "inactive")
      ) {
        setPlaying(false);
      }
    });

    return () => {
      sub.remove();
    };
  }, []);

  // ======================
  // Manifest JSON protegida (opcional)
  // ======================
  useEffect(() => {
    if (!manifestUrl) return;

    let cancelled = false;

    (async () => {
      try {
        const fullUrl =
          manifestUrl.startsWith("http://") ||
          manifestUrl.startsWith("https://")
            ? manifestUrl
            : `${API_BASE}${
                manifestUrl.startsWith("/") ? "" : "/"
              }${manifestUrl}`;

        const headers: Record<string, string> = {
          Accept: "application/json",
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const res = await fetch(fullUrl, { headers });

        if (!res.ok) {
          if (res.status === 429 || res.status === 404) {
            return;
          }
          console.log(
            "[QuickPlayVideo] manifest error status:",
            res.status
          );
          return;
        }

        const json = await res.json();
        const data = json?.data || json;
        const video = data?.video || {};

        if (cancelled) return;

        if (video.url && typeof video.url === "string") {
          setVideoUri(video.url);
        }

        if (!thumbnail) {
          const manifestThumb =
            video.thumbnailUrl || video.thumbUrl || video.thumbnail;
          if (manifestThumb && typeof manifestThumb === "string") {
            setThumbUri(manifestThumb);
            setShowThumbnail(true);
          }
        }

        if (!qualityLabel && video.quality) {
          setQualityState(String(video.quality));
        }

        const dur =
          typeof video.durationSec === "number"
            ? video.durationSec
            : typeof video.duration === "number"
            ? video.duration
            : typeof video.videoDuration === "number"
            ? video.videoDuration
            : typeof video.length === "number"
            ? video.length
            : null;

        if (dur && dur > 0 && duration === 0) {
          setDuration(dur);
        }
      } catch (e) {
        console.log("[QuickPlayVideo] manifest fetch error:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifestUrl, thumbnail, qualityLabel, token]);

  // ======================
  // Fade-in
  // ======================
  useEffect(() => {
    if (ready) {
      Animated.timing(fade, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [ready, fade]);

  // ======================
  // Double-tap like
  // ======================
  const triggerHeart = () => {
    heartScale.setValue(0);
    setLiked(true);

    Animated.spring(heartScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(heartScale, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }).start(() => setLiked(false));
      }, 700);
    });
  };

  const onTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      triggerHeart();
    } else {
      if (!error) {
        setPlaying((prev) => {
          const next = !prev;
          if (!prev && next) {
            registerView("play");
          }
          return next;
        });
        setEnded(false);
        showControlsTemporarily();
      }
    }
    lastTap.current = now;
  };

  // ======================
  // Auto-hide controls
  // ======================
  const showControlsTemporarily = () => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2300);
  };

  // ======================
  // Video callbacks
  // ======================
  const onLoad = (data: any) => {
    try {
      if (typeof data?.duration === "number" && data.duration > 0) {
        setDuration(data.duration);
      }
      setReady(true);
      setError(null);
      // NO escondemos thumbnail aquí → la ocultamos cuando ya hay progreso
    } catch (e) {
      console.log("[QuickPlayVideo] onLoad error:", e);
    }
  };

  const onProgress = (data: any) => {
    if (!data) return;
    if (typeof data.currentTime === "number" && data.currentTime >= 0) {
      setPosition(data.currentTime);

      // ⛔ Evitar negro: solo ocultar thumbnail cuando ya se está reproduciendo
      if (data.currentTime > 0.3 && showThumbnail) {
        setShowThumbnail(false);
      }
    }
  };

  const onBuffer = ({ isBuffering }: { isBuffering: boolean }) => {
    setBuffering(isBuffering);
  };

  const onEnd = () => {
    setEnded(true);
    setPlaying(false);
  };

  const onError = (err: any) => {
    console.log("[QuickPlayVideo] VIDEO ERROR:", err);
    setBuffering(false);
    setPlaying(false);
    setReady(false);
    setError("No se pudo reproducir el video.");
  };

  const progress = duration ? position / duration : 0;

  const hasDuration = duration > 0;
  const remainingSeconds = hasDuration
    ? Math.max(0, duration - position)
    : 0;

  // ======================
  // Seek
  // ======================
  const onSeekLayout = (e: LayoutChangeEvent) => {
    seekWidth.current = e.nativeEvent.layout.width;
  };

  const handleSeek = (
    evt: any,
    ref: MutableRefObject<VideoRef | null>
  ) => {
    if (!seekWidth.current || !duration || error) return;

    const x = evt.nativeEvent.locationX;
    const ratio = Math.max(0, Math.min(1, x / seekWidth.current));

    const newPos = ratio * duration;

    try {
      ref.current?.seek(newPos);
      setPosition(newPos);
      setEnded(false);
    } catch (e) {
      console.log("[QuickPlayVideo] seek error:", e);
    }
  };

  // ======================
  // Fullscreen
  // ======================
  const openFS = () => {
    if (error) return;
    setFullscreen(true);
    setPlaying(false);

    setTimeout(() => {
      try {
        fsRef.current?.seek(position);
      } catch (e) {
        console.log("[QuickPlayVideo] openFS seek error:", e);
      }
    }, 60);

    registerView("fullscreen");
  };

  const closeFS = () => {
    setFullscreen(false);

    setTimeout(() => {
      try {
        videoRef.current?.seek(position);
        if (!ended && !error && isVisible) setPlaying(true);
      } catch (e) {
        console.log("[QuickPlayVideo] closeFS seek error:", e);
      }
    }, 60);
  };

  // ======================
  // Replay
  // ======================
  const handleReplay = () => {
    setEnded(false);
    setPosition(0);
    setError(null);
    try {
      videoRef.current?.seek(0);
      fsRef.current?.seek(0);
    } catch (e) {
      console.log("[QuickPlayVideo] replay seek error:", e);
    }
    if (isVisible) {
      setPlaying(true);
    }
    // mostramos otra vez thumb al reiniciar
    if (thumbUri) setShowThumbnail(true);
  };

  // ======================
  // Auto-view cuando play + audio ON
  // ======================
  useEffect(() => {
    if (playing && isVisible && !muted && !error) {
      registerView("play");
    }
  }, [playing, isVisible, muted, error, registerView]);

  if (!videoUri) {
    return (
      <View style={[styles.container, style]}>
        <Text style={{ color: "#ccc" }}>Video no disponible</Text>
      </View>
    );
  }

  const posterSource =
    Platform.OS === "ios" && thumbUri ? thumbUri : undefined;

  return (
    <>
      {/* MAIN VIDEO */}
      <View style={[styles.container, style]}>
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: fade }]}>
          {/* VIDEO SIEMPRE ABAJO */}
          <Video
            key={videoUri}
            ref={videoRef}
            source={{ uri: videoUri }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            paused={!playing || !isVisible || !!error}
            muted={muted}
            repeat={loop}
            onLoad={onLoad}
            onProgress={onProgress}
            onBuffer={onBuffer}
            onEnd={onEnd}
            onError={onError}
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
            poster={posterSource}
            posterResizeMode="cover"
          />

          {/* MINIATURA ENCIMA DEL VIDEO (anti-pantalla negra) */}
          {showThumbnail && thumbUri && (
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
              <Image
                source={{ uri: thumbUri }}
                style={[StyleSheet.absoluteFill, { zIndex: 2 }]}
                resizeMode="cover"
              />
            </View>
          )}

          {/* BUFFERING */}
          {buffering && !error && (
            <View style={styles.buffering}>
              <ActivityIndicator color="#fff" />
            </View>
          )}

          {/* ERROR OVERLAY */}
          {error && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.errorButton}
                onPress={handleReplay}
              >
                <Text style={styles.errorButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>

        <TouchableWithoutFeedback onPress={onTap}>
          <View style={styles.overlay}>
            {/* ❤️ */}
            {liked && (
              <Animated.View
                style={[
                  styles.heart,
                  { transform: [{ scale: heartScale }] },
                ]}
              >
                <Heart size={100} color="#ff0050" fill="#ff0050" />
              </Animated.View>
            )}

            {/* REPLAY */}
            {ended && !error && (
              <View style={styles.replayWrapper}>
                <TouchableOpacity
                  onPress={handleReplay}
                  style={styles.replayButton}
                >
                  <Play size={22} color="#fff" />
                  <Text style={styles.replayText}>Repetir</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Badge tiempo restante */}
            {hasDuration && !fullscreen && !error && (
              <View style={styles.durationBadge}>
                <Text style={styles.durationText}>
                  -{formatTime(remainingSeconds)}
                </Text>
              </View>
            )}

            {/* CONTROLES INFERIORES */}
            <View style={styles.controlsWrapper}>
              <TouchableWithoutFeedback
                onPress={(e) => handleSeek(e, videoRef)}
              >
                <View style={styles.seekBar} onLayout={onSeekLayout}>
                  <View style={styles.seekBg} />
                  <View
                    style={[
                      styles.seekProgress,
                      { width: `${progress * 100}%` },
                    ]}
                  />
                </View>
              </TouchableWithoutFeedback>

              {showControls && !error && (
                <View style={styles.row}>
                  <TouchableOpacity
                    onPress={() => {
                      if (error) return;
                      setPlaying((prev) => {
                        const next = !prev;
                        if (!prev && next) {
                          registerView("play");
                        }
                        return next;
                      });
                      setEnded(false);
                    }}
                  >
                    {playing ? (
                      <Pause size={28} color="#fff" />
                    ) : (
                      <Play size={28} color="#fff" />
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity onPress={toggleGlobalMuted}>
                    {muted ? (
                      <VolumeX size={28} color="#fff" />
                    ) : (
                      <Volume2 size={28} color="#fff" />
                    )}
                  </TouchableOpacity>

                  <View style={styles.timeWrapper}>
                    <Text style={styles.timeText}>
                      {formatTime(position)} / {formatTime(duration)}
                      {hasDuration
                        ? `  ·  -${formatTime(remainingSeconds)}`
                        : ""}
                    </Text>
                  </View>

                  {!!qualityState && (
                    <View style={styles.qualityBadge}>
                      <Text style={styles.qualityText}>
                        {qualityState.toUpperCase()}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }} />

                  <TouchableOpacity onPress={openFS}>
                    <Maximize2 size={28} color="#fff" />
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </View>

      {/* FULLSCREEN MODE */}
      <Modal visible={fullscreen} animationType="fade">
        <View style={styles.fs}>
          <Video
            key={`${videoUri}-fs`}
            ref={fsRef}
            source={{ uri: videoUri }}
            style={styles.fsVideo}
            resizeMode="contain"
            paused={!playing || !!error}
            muted={muted}
            repeat={loop}
            onLoad={onLoad}
            onProgress={onProgress}
            onBuffer={onBuffer}
            onEnd={onEnd}
            onError={onError}
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
            poster={posterSource}
            posterResizeMode="contain"
          />

          {buffering && !error && (
            <View style={styles.buffering}>
              <ActivityIndicator color="#fff" />
            </View>
          )}

          {ended && !error && (
            <View style={styles.replayWrapper}>
              <TouchableOpacity
                onPress={handleReplay}
                style={styles.replayButton}
              >
                <Play size={22} color="#fff" />
                <Text style={styles.replayText}>Repetir</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity
                style={styles.errorButton}
                onPress={handleReplay}
              >
                <Text style={styles.errorButtonText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableWithoutFeedback
            onPress={() => {
              if (error) return;
              setShowControls((s) => !s);
              showControlsTemporarily();
            }}
          >
            <View style={styles.fsOverlay}>
              <View style={styles.fsControlsWrapper}>
                <TouchableWithoutFeedback
                  onPress={(e) => handleSeek(e, fsRef)}
                >
                  <View style={styles.seekBar} onLayout={onSeekLayout}>
                    <View style={styles.seekBg} />
                    <View
                      style={[
                        styles.seekProgress,
                        { width: `${progress * 100}%` },
                      ]}
                    />
                  </View>
                </TouchableWithoutFeedback>

                {showControls && !error && (
                  <View style={styles.row}>
                    <TouchableOpacity
                      onPress={() => {
                        if (error) return;
                        setPlaying((prev) => {
                          const next = !prev;
                          if (!prev && next) {
                            registerView("play");
                          }
                          return next;
                        });
                        setEnded(false);
                      }}
                    >
                      {playing ? (
                        <Pause size={28} color="#fff" />
                      ) : (
                        <Play size={28} color="#fff" />
                      )}
                    </TouchableOpacity>

                    <TouchableOpacity onPress={toggleGlobalMuted}>
                      {muted ? (
                        <VolumeX size={28} color="#fff" />
                      ) : (
                        <Volume2 size={28} color="#fff" />
                      )}
                    </TouchableOpacity>

                    <View style={styles.timeWrapper}>
                      <Text style={styles.timeText}>
                        {formatTime(position)} / {formatTime(duration)}
                        {hasDuration
                          ? `  ·  -${formatTime(remainingSeconds)}`
                          : ""}
                      </Text>
                    </View>

                    {!!qualityState && (
                      <View style={styles.qualityBadge}>
                        <Text style={styles.qualityText}>
                          {qualityState.toUpperCase()}
                        </Text>
                      </View>
                    )}

                    <View style={{ flex: 1 }} />

                    <TouchableOpacity onPress={closeFS}>
                      <Minimize2 size={28} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 340,
    backgroundColor: "#000",
    borderRadius: 16,
    overflow: "hidden",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  heart: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
  },
  controlsWrapper: {
    paddingBottom: 14,
    paddingHorizontal: 14,
    paddingTop: 30,
    backgroundColor: "transparent",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 6,
  },
  seekBar: {
    height: 24,
    justifyContent: "center",
  },
  seekBg: {
    height: 4,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  seekProgress: {
    position: "absolute",
    left: 0,
    top: 0,
    height: 4,
    borderRadius: 3,
    backgroundColor: "#fff",
  },
  fs: {
    flex: 1,
    backgroundColor: "#000",
  },
  fsVideo: {
    width: "100%",
    height: "100%",
  },
  fsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
  },
  fsControlsWrapper: {
    paddingBottom: 90,
    paddingHorizontal: 20,
    paddingTop: 18,
    backgroundColor: "transparent",
  },
  buffering: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  replayWrapper: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  replayButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  replayText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  timeWrapper: {
    marginLeft: 12,
  },
  timeText: {
    color: "#fff",
    fontSize: 12,
    opacity: 0.9,
  },
  qualityBadge: {
    marginLeft: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.7)",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  qualityText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  durationBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.7)",
  },
  durationText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "600",
  },
  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 10,
  },
  errorButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#fff",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  errorButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
// ======================================================