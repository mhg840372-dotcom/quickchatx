// ======================================================
// 📄 PostDetailView.tsx — v22.3 POST+COMMENTS SINGLE SCROLL (2025)
// ------------------------------------------------------
// ✅ QuickPlayVideo
// ✅ Carrusel + fullscreen viewer
// ✅ Contadores locales + FeedUpdate
// ✅ AuthContext (likes & comentarios)
// ✅ Limpieza total de URIs (fixUri + resolve)
// ✅ Usa metadata de video del backend (thumb/quality)
// ✅ Registro de views por post SIN romper el render
// ✅ Sincroniza views con el Feed vía feedEvents
// ✅ Avatar unificado con Feed (safeAvatar, followers/following, cache)
// ✅ Control de views en barra de acciones (👁 + contador)
// ✅ Views SOLO para VIDEO (no imágenes)
// ✅ Views SOLO suben (nunca rebote)
// ✅ 1 view por usuario+post, persistente con AsyncStorage
// ✅ Si el usuario sale y entra, NO se vuelve a contar
// ✅ DEDUPE de imágenes en el detalle (no más duplicadas, ni en modal)
// ✅ DEDUPE canónico (ignora dominio, /api y querystring + IDs de media)
// ✅ IMÁGENES del detalle con `contain` (no se recortan)
// ✅ Comentarios en el mismo scroll que el post (ListHeaderComponent)
// ======================================================

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
  Modal,
  Dimensions,
  ActivityIndicator,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Heart, MessageCircle, Eye } from "lucide-react-native";
import { api, API_URL } from "@/services/api";
import { LinearGradient } from "expo-linear-gradient";
import QuickPlayVideo, {
  type VideoViewReason,
} from "@/components/QuickPlayVideo";
import { emitFeedUpdate, subscribeToUserProfileUpdates } from "@/utils/feedEvents";
import { useRouter } from "expo-router";
import { useAuth } from "../../hooks/useAuth";
import { useUser } from "@/contexts/AuthContext";

// 📱 Constantes de tamaño de pantalla
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ======================================================
// 👁️ Persistencia de views de video (userId + postId)
// ======================================================
const VIDEO_VIEWS_KEY_PREFIX = "qc_videoViewsByUser_v1:";

const getViewsKey = (userId?: string | null) =>
  `${VIDEO_VIEWS_KEY_PREFIX}${userId || "anon"}`;

const hasUserSeenVideoPost = async (
  userId: string | null,
  postId: string
): Promise<boolean> => {
  try {
    const key = getViewsKey(userId);
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return false;
    return !!data[postId];
  } catch {
    return false;
  }
};

const markUserSeenVideoPost = async (
  userId: string | null,
  postId: string
): Promise<void> => {
  try {
    const key = getViewsKey(userId);
    const raw = await AsyncStorage.getItem(key);
    let data: Record<string, boolean> = {};
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        data = parsed;
      }
    }
    if (data[postId]) return;
    data[postId] = true;
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch {
    // noop
  }
};

// ======================================================
// 🔧 FIX URI — ANTI-CRASH (para media en general)
// ======================================================
const fixUri = (uri?: string | null): string => {
  if (!uri || typeof uri !== "string") return "";

  let u = uri.trim();

  // Espacios → %20
  u = u.replace(/ /g, "%20");

  // Normalizar file://
  if (u.startsWith("file:/") && !u.startsWith("file:///")) {
    u = u.replace("file:/", "file:///");
  }

  // content:// se respeta tal cual
  if (u.startsWith("content://")) return u;

  // Evitar dobles barras innecesarias (sin tocar "://")
  u = u.replace(/([^:]\/)\/+/g, "$1");

  return u;
};

// ======================================================
// 🌐 Base API + imágenes (igual que Feed + Comments)
// ======================================================
const getApiBase = () => {
  try {
    const base = (api as any)?.defaults?.baseURL;
    if (typeof base === "string" && base.length > 0) {
      return base.replace(/\/$/, "");
    }
  } catch {}
  return API_URL || "https://api.quickchatx.com/api";
};

const RAW_BASE = getApiBase();
const TRIMMED_API_BASE_URL = RAW_BASE.replace(/\/+$/, "");
const IMAGE_BASE_URL = TRIMMED_API_BASE_URL.replace(/\/api$/i, "");

// 🔧 Resolver URIs seguras para media (videos/imágenes del post)
const resolveMediaUri = (raw?: string | null): string | null => {
  if (!raw || typeof raw !== "string") return null;

  let url = fixUri(raw);

  if (
    url.startsWith("http://") ||
    url.startsWith("https://") ||
    url.startsWith("file://") ||
    url.startsWith("content://") ||
    url.startsWith("asset://")
  ) {
    return url;
  }

  const base = TRIMMED_API_BASE_URL;
  return `${base}${url.startsWith("/") ? "" : "/"}${url}`;
};

// 🔧 Resolver imágenes/avatars (mismas reglas que Feed)
const resolveImage = (url?: string | null): string | null => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${IMAGE_BASE_URL}${url}`;

  const cleaned = url.replace(/^\/+/, "");

  if (cleaned.startsWith("uploads/") || cleaned.startsWith("upload/")) {
    return `${IMAGE_BASE_URL}/${cleaned}`;
  }

  return `${IMAGE_BASE_URL}/uploads/${cleaned}`;
};

const resolveAvatar = (url?: string | null): string | null => {
  return resolveImage(url);
};

// Avatar del usuario autenticado (igual que Feed/Comments)
const getAuthUserAvatar = (authUser: any): string | null => {
  if (!authUser) return null;

  const candidates = [
    authUser.safeAvatar,
    authUser.avatarUrl,
    authUser.profilePhoto,
    authUser.image,
    authUser.photoUrl,
    authUser.picture,

    authUser.user?.safeAvatar,
    authUser.user?.avatarUrl,
    authUser.user?.profilePhoto,
    authUser.user?.image,
    authUser.user?.photoUrl,
    authUser.user?.picture,
  ];

  for (const src of candidates) {
    if (!src) continue;
    const resolved = resolveAvatar(src);
    if (resolved) return resolved;
  }

  return null;
};

// Busca avatar del autor dentro de followers/following del usuario logueado
const resolveAvatarFromRelations = (
  authUser: any,
  authorId?: string | null
): { url: string | null; from: "followers" | "following" | null } => {
  if (!authUser || !authorId) {
    return { url: null, from: null };
  }

  const followers = Array.isArray(authUser.followers)
    ? authUser.followers
    : [];
  const following = Array.isArray(authUser.following)
    ? authUser.following
    : [];

  const findInList = (list: any[]): string | null => {
    const found = list.find(
      (u) => String(u?._id || u?.id) === String(authorId)
    );
    if (!found) return null;

    const candidate =
      found.safeAvatar ||
      found.avatarUrl ||
      found.profilePhoto ||
      found.photoUrl ||
      found.picture;

    return resolveAvatar(candidate);
  };

  const fromFollowers = findInList(followers);
  if (fromFollowers) return { url: fromFollowers, from: "followers" };

  const fromFollowing = findInList(following);
  if (fromFollowing) return { url: fromFollowing, from: "following" };

  return { url: null, from: null };
};

// ======================================================
// 🔍 Heurística de calidad por URL
// ======================================================
const guessQualityFromUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const u = url.toLowerCase();

  if (u.includes("1080")) return "1080p";
  if (u.includes("720")) return "720p";
  if (u.includes("480")) return "480p";
  if (u.includes("360")) return "360p";
  if (u.includes("240")) return "240p";
  if (u.includes("uhd") || u.includes("4k")) return "4K";
  if (u.includes("hd")) return "HD";

  return null;
};

// ======================================================
// 🔢 Extraer viewsCount (igual que en FeedItemEnhanced)
// ======================================================
const extractViewsCount = (src: any): number | null => {
  if (!src || typeof src !== "object") return null;

  if (typeof src.viewsCount === "number") return src.viewsCount;
  if (typeof src.videoViews === "number") return src.videoViews;

  if (Array.isArray(src.views)) return src.views.length;

  if (src.stats && typeof src.stats === "object") {
    if (typeof src.stats.views === "number") return src.stats.views;
    if (typeof src.stats.videoViews === "number")
      return src.stats.videoViews;
  }

  return null;
};

// ======================================================
// 🔑 Clave canónica de media (para DEDUPE robusto)
// ======================================================
const getCanonicalMediaKey = (
  m: any,
  kind: "image" | "video"
): string => {
  const prefix = kind === "video" ? "v" : "i";

  if (kind === "video" && m?.videoId) {
    return `${prefix}:videoId:${String(m.videoId)}`;
  }

  const idLike =
    m?.mediaId || m?._id || m?.id || m?.public_id || m?.publicId;
  if (idLike) {
    return `${prefix}:id:${String(idLike)}`;
  }

  const candidates = [
    m?.url,
    m?.imageUrl,
    m?.videoUrl,
    m?.path,
    m?.uri,
    m?.originalPath,
  ];
  let raw: string | null = null;
  for (const c of candidates) {
    if (typeof c === "string" && c.trim().length > 0) {
      raw = c.trim();
      break;
    }
  }

  if (raw) {
    try {
      const noQuery = raw.split("?")[0];
      const noHost = noQuery.replace(/^https?:\/\/[^/]+/i, "");
      const noApi = noHost.replace(/^\/api(\/|$)/i, "/");
      return `${prefix}:url:${noApi}`;
    } catch {
      return `${prefix}:url:${raw}`;
    }
  }

  return `${prefix}:raw:${JSON.stringify(m || {})}`;
};

// ======================================================
// 🧩 Props
// ======================================================
type PostDetailViewProps = {
  post: any;
  onCommentSent?: (comment: any, newCommentsCount: number) => void;
};

// ======================================================
// 🧩 Helper: calcular avatar del autor (unificado con Feed)
// ======================================================
const computeAuthorAvatar = (
  safePost: any,
  currentUser: any,
  authorId: string | null
): string => {
  const fallbackAvatar =
    resolveAvatar("/uploads/default-avatar.png") ||
    "https://api.quickchatx.com/uploads/default-avatar.png";

  if (!authorId) {
    const raw =
      safePost.safeAvatar ||
      safePost.avatarUrl ||
      safePost.avatar ||
      safePost.photoUrl ||
      safePost.picture;
    return resolveAvatar(raw) || fallbackAvatar;
  }

  const isCurrentUserAuthor =
    !!currentUser &&
    String(currentUser._id || currentUser.id) === String(authorId);

  const fromSelf = isCurrentUserAuthor
    ? getAuthUserAvatar(currentUser)
    : null;

  const itemCandidates = [
    safePost.safeAvatar,

    safePost.avatarUrl,
    safePost.avatar,
    safePost.photoUrl,
    safePost.picture,

    safePost.author?.safeAvatar,
    safePost.author?.avatarUrl,
    safePost.author?.avatar,
    safePost.author?.photoUrl,
    safePost.author?.profilePhoto,
    safePost.author?.photo,
    safePost.author?.picture,

    safePost.createdBy?.safeAvatar,
    safePost.createdBy?.avatarUrl,
    safePost.createdBy?.avatar,
    safePost.createdBy?.photoUrl,
    safePost.createdBy?.profilePhoto,
    safePost.createdBy?.photo,
    safePost.createdBy?.picture,

    safePost.user?.safeAvatar,
    safePost.user?.avatarUrl,
    safePost.user?.avatar,
    safePost.user?.photoUrl,
    safePost.user?.profilePhoto,
    safePost.user?.photo,
    safePost.user?.picture,

    safePost.owner?.safeAvatar,
    safePost.owner?.avatarUrl,
    safePost.owner?.avatar,
    safePost.owner?.photoUrl,
    safePost.owner?.profilePhoto,
    safePost.owner?.photo,
    safePost.owner?.picture,
  ];

  let fromItem: string | null = null;
  for (const src of itemCandidates) {
    if (!src) continue;
    const resolved = resolveAvatar(src);
    if (resolved) {
      fromItem = resolved;
      break;
    }
  }

  const { url: fromRelations } = resolveAvatarFromRelations(
    currentUser,
    authorId
  );

  const finalAvatar =
    fromSelf || fromItem || fromRelations || fallbackAvatar;

  return finalAvatar;
};

// ======================================================
// 🧱 Componente principal
// ======================================================
export default function PostDetailView({
  post,
  onCommentSent,
}: PostDetailViewProps) {
  const safePost: any = useMemo(() => post ?? {}, [post]);
  const router = useRouter();
  const { token } = useAuth();
  const { user: currentUser } = useUser();

  const currentUserId: string | null =
    (currentUser && (currentUser._id || currentUser.id)) || null;

  const rawPostId =
    safePost.__baseId ||
    safePost._id ||
    safePost.id ||
    safePost.postId ||
    safePost.newsId ||
    null;
  const postId: string = rawPostId ? String(rawPostId) : "";

  const authorId: string | null =
    safePost.authorId ||
    safePost.userId ||
    safePost.user?._id ||
    safePost.user?.id ||
    safePost.author?._id ||
    safePost.author?.id ||
    safePost.createdBy?._id ||
    safePost.createdBy?.id ||
    safePost.owner?._id ||
    safePost.owner?.id ||
    null;

  const authorUsername =
    safePost.authorUsername ||
    safePost.user?.username ||
    safePost.author?.username ||
    safePost.createdBy?.username ||
    safePost.owner?.username ||
    "Usuario";

  const [authorAvatar, setAuthorAvatar] = useState<string>(() =>
    computeAuthorAvatar(safePost, currentUser, authorId)
  );

  useEffect(() => {
    setAuthorAvatar(computeAuthorAvatar(safePost, currentUser, authorId));
  }, [safePost, currentUser, authorId]);

  // ----------------- Media Normalizado + DEDUPE -----------------
  const rawMediaArray: any[] = useMemo(() => {
    const base: any[] = Array.isArray(safePost?.media)
      ? [...safePost.media]
      : [];

    if (safePost.imageUrl) {
      base.push({ type: "image", url: safePost.imageUrl });
    }
    if (safePost.videoUrl) {
      base.push({ type: "video", url: safePost.videoUrl });
    }

    return base;
  }, [safePost]);

  const normalizedMediaArray = rawMediaArray
    .map((m: any) => {
      const uri =
        resolveMediaUri(
          m.url ||
            m.path ||
            m.uri ||
            m.imageUrl ||
            m.videoUrl ||
            m.originalPath ||
            null
        ) || null;
      return { ...m, url: uri };
    })
    .filter((m: any) => m.url || m.videoId);

  const isVideoMedia = useCallback(
    (m: any) =>
      (typeof m.type === "string" &&
        m.type.toLowerCase().startsWith("video")) ||
      !!m.videoId ||
      (typeof m.url === "string" &&
        (m.url.toLowerCase().endsWith(".mp4") ||
          m.url.toLowerCase().endsWith(".mov") ||
          m.url.toLowerCase().endsWith(".m4v") ||
          m.url.toLowerCase().endsWith(".webm"))),
    []
  );

  const isImageMedia = useCallback(
    (m: any) =>
      !isVideoMedia(m) &&
      ((typeof m.type === "string" &&
        m.type.toLowerCase().startsWith("image")) ||
        (!!m.url && !m.videoId)),
    [isVideoMedia]
  );

  const mediaArray: any[] = useMemo(() => {
    const seen = new Set<string>();
    const result: any[] = [];
    for (const m of normalizedMediaArray) {
      const kind: "image" | "video" = isVideoMedia(m) ? "video" : "image";
      const key = getCanonicalMediaKey(m, kind);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(m);
    }
    return result;
  }, [normalizedMediaArray, isVideoMedia]);

  const imageItems: any[] = useMemo(() => {
    const imgs = mediaArray.filter(
      (m: any) => isImageMedia(m) && typeof m.url === "string"
    );
    const seen = new Set<string>();
    const result: any[] = [];
    for (const img of imgs) {
      const key = getCanonicalMediaKey(img, "image");
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(img);
    }
    return result;
  }, [mediaArray, isImageMedia]);

  const videoItem = useMemo(
    () =>
      mediaArray.find(
        (m: any) => isVideoMedia(m) && typeof m.url === "string"
      ) || null,
    [mediaArray, isVideoMedia]
  );

  // ======================================================
  // 🎛️ Estados
  // ======================================================
  const [liked, setLiked] = useState(
    Boolean(safePost.likedByUser || safePost.liked)
  );
  const [likesCount, setLikesCount] = useState(
    typeof safePost.likesCount === "number"
      ? safePost.likesCount
      : Array.isArray(safePost.likes)
      ? safePost.likes.length
      : 0
  );
  const [commentsCount, setCommentsCount] = useState(
    typeof safePost.commentsCount === "number"
      ? safePost.commentsCount
      : Array.isArray(safePost.comments)
      ? safePost.comments.length
      : 0
  );
  const [expanded, setExpanded] = useState(false);

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const lastTapRef = useRef<number | null>(null);

  const [viewsCount, setViewsCount] = useState<number | null>(() =>
    videoItem ? extractViewsCount(safePost) : null
  );

  const hasRegisteredViewRef = useRef(false);

  useEffect(() => {
    hasRegisteredViewRef.current = false;
  }, [postId]);

  useEffect(() => {
    if (!post) return;

    setLiked(Boolean(post.likedByUser || post.liked));
    setLikesCount(
      typeof post.likesCount === "number"
        ? post.likesCount
        : Array.isArray(post.likes)
        ? post.likes.length
        : 0
    );
    setCommentsCount(
      typeof post.commentsCount === "number"
        ? post.commentsCount
        : Array.isArray(post.comments)
        ? post.comments.length
        : 0
    );

    const v = videoItem ? extractViewsCount(post) : null;
    setViewsCount(typeof v === "number" ? v : null);
  }, [post, videoItem]);

  useEffect(() => {
    const unsub = subscribeToUserProfileUpdates((payload) => {
      if (!authorId) return;
      if (String(payload.userId) !== String(authorId)) return;

      const rawAvatar = payload.safeAvatar || payload.avatarUrl;
      const resolved = resolveAvatar(rawAvatar);
      if (resolved) {
        setAuthorAvatar(resolved);
      }
    });
    return unsub;
  }, [authorId]);

  // ======================================================
  // 👁️ Registrar view de video (PERSISTENTE + sync con feed)
// ======================================================
  const handleVideoView = useCallback(
    (reason?: VideoViewReason) => {
      if (!postId || !videoItem || !videoItem.url) return;

      if (hasRegisteredViewRef.current) return;
      hasRegisteredViewRef.current = true;

      (async () => {
        const alreadySeen = await hasUserSeenVideoPost(
          currentUserId,
          postId
        );

        if (alreadySeen) return;

        markUserSeenVideoPost(currentUserId, postId).catch(() => {});

        setTimeout(() => {
          const currentSafe =
            typeof viewsCount === "number" ? viewsCount : 0;
          const optimisticNext = currentSafe + 1;

          setViewsCount(optimisticNext);

          emitFeedUpdate({
            type: "videoViews",
            postId,
            viewsCount: optimisticNext,
          });

          (async () => {
            const endpoints = [
              `/posts/${postId}/views`,
              `/posts/${postId}/view`,
            ];

            for (const url of endpoints) {
              try {
                const payload = reason ? { reason } : undefined;
                const res = await api.post(url, payload);
                const data = res?.data?.data || res?.data || {};

                const backendViews = extractViewsCount(data);

                if (typeof backendViews === "number") {
                  const final =
                    backendViews > optimisticNext
                      ? backendViews
                      : optimisticNext;

                  setViewsCount(final);

                  emitFeedUpdate({
                    type: "videoViews",
                    postId,
                    viewsCount: final,
                  });
                }

                break;
              } catch (err: any) {
                const status = err?.response?.status;
                if (status === 404 || status === 405) {
                  continue;
                }
                console.log("❌ Error registrando view:", err);
                break;
              }
            }
          })();
        }, 0);
      })();
    },
    [postId, videoItem, currentUserId, viewsCount]
  );

  // ======================================================
  // ❤️ Like
  // ======================================================
  const handleLike = async () => {
    if (!token) {
      console.log("⚠️ No hay token para like.");
      return;
    }
    if (!postId) return;

    const newLiked = !liked;
    setLiked(newLiked);
    setLikesCount((p: number) => (newLiked ? p + 1 : Math.max(p - 1, 0)));

    try {
      const res = await api.post(`/posts/like/${postId}`);
      const updated = res?.data?.data || res?.data;

      if (updated) {
        const backendLiked = !!updated.likedByUser || !!updated.liked;

        const backendCount =
          typeof updated.likesCount === "number"
            ? updated.likesCount
            : Array.isArray(updated.likes)
            ? updated.likes.length
            : likesCount;

        setLiked(backendLiked);
        setLikesCount(backendCount);

        emitFeedUpdate({
          type: "likes",
          postId: String(postId),
          liked: backendLiked,
          likesCount: backendCount,
        });
      }
    } catch (err) {
      console.log("❌ Error al dar like:", err);
      setLiked((p: boolean) => !p);
      setLikesCount((p: number) =>
        newLiked ? Math.max(p - 1, 0) : p + 1
      );
    }
  };

  // ======================================================
  // ✂️ Contenido "Leer más"
  // ======================================================
  const renderContent = () => {
    if (!safePost.content) return null;

    const content = safePost.content.trim();
    const MAX = 400;

    if (content.length <= MAX) {
      return <Text style={styles.content}>{content}</Text>;
    }

    const short = content.slice(0, MAX) + "...";

    return (
      <View style={{ marginBottom: 10 }}>
        <View style={{ position: "relative" }}>
          <Text
            style={styles.content}
            numberOfLines={expanded ? undefined : 7}
          >
            {expanded ? content : short}
          </Text>

          {!expanded && (
            <LinearGradient
              colors={["transparent", "#fff"]}
              style={styles.fadeGradient}
            />
          )}
        </View>

        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Text style={styles.readMore}>
            {expanded ? "Leer menos ▲" : "Leer más ▼"}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ======================================================
  // 🖼 FullScreen Viewer
  // ======================================================
  const openViewerAt = (index: number) => {
    setViewerIndex(index);
    setCurrentImageIndex(index);
    setViewerVisible(true);
  };

  const handleViewerTap = () => {
    const now = Date.now();
    if (lastTapRef.current && now - lastTapRef.current < 250) {
      handleLike();
    }
    lastTapRef.current = now;
  };

  // ======================================================
  // 🎞️ Render Media (incluye Video + imágenes)
// ======================================================
  const renderMedia = () => {
    const hasOnlyVideo = !!videoItem && imageItems.length === 0;
    const hasImages = imageItems.length > 0;

    if (!hasOnlyVideo && !hasImages) return null;

    const manifestUrl =
      postId ? `/posts/${postId}/video-manifest` : undefined;

    return (
      <>
        {videoItem && videoItem.url && (
          <View>
            {videoItem.videoId ? (
              <View
                style={{
                  width: "100%",
                  height: 330,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "#000",
                  borderRadius: 22,
                  overflow: "hidden",
                  marginVertical: 14,
                  alignSelf: "center",
                }}
              >
                <Text style={{ color: "#fff" }}>
                  Video de YouTube ({videoItem.videoId})
                </Text>
              </View>
            ) : (
              <View style={styles.mediaVideoBox}>
                <QuickPlayVideo
                  uri={videoItem.url}
                  thumbnail={
                    resolveMediaUri(
                      videoItem.thumbUrl ||
                        videoItem.thumbnailUrl ||
                        videoItem.posterUrl ||
                        null
                    ) || undefined
                  }
                  autoPlay
                  loop
                  style={{ width: "100%", height: "100%" }}
                  qualityLabel={
                    (videoItem.quality ||
                      videoItem.resolution ||
                      videoItem.label ||
                      guessQualityFromUrl(videoItem.url)) ?? undefined
                  }
                  manifestUrl={manifestUrl}
                  onView={handleVideoView}
                />
              </View>
            )}

            {typeof viewsCount === "number" && (
              <View style={styles.viewsRow}>
                <Text style={styles.viewsText}>
                  {viewsCount === 1
                    ? "1 reproducción"
                    : `${viewsCount} reproducciones`}
                </Text>
              </View>
            )}
          </View>
        )}

        {hasImages && (
          <View style={styles.carouselWrapper}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onScroll={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.x /
                    e.nativeEvent.layoutMeasurement.width
                );
                if (!Number.isNaN(index)) setCurrentImageIndex(index);
              }}
              scrollEventThrottle={16}
            >
              {imageItems.map((img: any, index: number) => {
                const uri = img.url as string;
                if (!uri) return null;
                return (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.9}
                    onPress={() => openViewerAt(index)}
                  >
                    <Image
                      source={{ uri }}
                      style={styles.image}
                      resizeMode="contain"
                    />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {imageItems.length > 1 && (
              <View style={styles.imageCounter}>
                <Text style={styles.imageCounterText}>
                  {currentImageIndex + 1}/{imageItems.length}
                </Text>
              </View>
            )}
          </View>
        )}
      </>
    );
  };

  // ======================================================
  // 🧱 UI
  // ======================================================
  if (!postId) {
    return (
      <View style={styles.loadingCenter}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <>
      <View style={styles.container}>
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.authorRow}
          onPress={() => {
            if (authorId) router.push(`/profile/${authorId}`);
          }}
        >
          <Image source={{ uri: authorAvatar }} style={styles.authorAvatar} />
          <Text style={styles.author}>@{authorUsername}</Text>
        </TouchableOpacity>

        {renderContent()}
        {renderMedia()}

        {/* ❤️ / 👁 / 💬 */}
        <View style={styles.actions}>
          <TouchableOpacity onPress={handleLike} style={styles.likeWrapper}>
            <Heart
              size={26}
              color={liked ? "black" : "#555"}
              fill={liked ? "black" : "transparent"}
            />
            <Text style={styles.likesCount}>
              {likesCount > 0 ? likesCount : ""}
            </Text>
          </TouchableOpacity>

          {videoItem && typeof viewsCount === "number" && (
            <View style={styles.viewsInfo}>
              <Eye size={24} color="#555" />
              <Text style={styles.viewsCountText}>{viewsCount}</Text>
            </View>
          )}

          <View style={styles.commentsInfo}>
            <MessageCircle size={26} color="#555" />
            {commentsCount > 0 && (
              <Text style={styles.count}> {commentsCount}</Text>
            )}
          </View>
        </View>
      </View>

      {/* 🔍 VISOR FULLSCREEN */}
      {imageItems.length > 0 && (
        <Modal
          visible={viewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setViewerVisible(false)}
        >
          <View style={styles.viewerContainer}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              contentOffset={{
                x: viewerIndex * SCREEN_WIDTH,
                y: 0,
              }}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.x / SCREEN_WIDTH
                );
                if (!Number.isNaN(index)) {
                  setCurrentImageIndex(index);
                  setViewerIndex(index);
                }
              }}
            >
              {imageItems.map((img: any, index: number) => {
                const uri = img.url as string;
                if (!uri) return null;
                return (
                  <ScrollView
                    key={index}
                    style={{ width: SCREEN_WIDTH }}
                    maximumZoomScale={3}
                    minimumZoomScale={1}
                    contentContainerStyle={styles.viewerImageWrapper}
                    centerContent
                  >
                    <TouchableWithoutFeedback onPress={handleViewerTap}>
                      <Image
                        source={{ uri }}
                        style={styles.viewerImage}
                        resizeMode="contain"
                      />
                    </TouchableWithoutFeedback>
                  </ScrollView>
                );
              })}
            </ScrollView>

            {/* 🔙 Cerrar */}
            <TouchableOpacity
              style={styles.viewerClose}
              onPress={() => setViewerVisible(false)}
            >
              <Text style={styles.viewerCloseText}>Cerrar</Text>
            </TouchableOpacity>

            {/* 🔢 Contador */}
            {imageItems.length > 1 && (
              <View style={styles.viewerCounter}>
                <Text style={styles.viewerCounterText}>
                  {currentImageIndex + 1}/{imageItems.length}
                </Text>
              </View>
            )}
          </View>
        </Modal>
      )}
    </>
  );
}

// ======================================================
// 💅 Estilos
// ======================================================
const styles = StyleSheet.create({
  loadingCenter: {
    paddingVertical: 60,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  container: {
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginBottom: 6,
  },
  authorAvatar: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#e5e5e5",
  },
  author: { fontWeight: "700", fontSize: 16 },
  content: { fontSize: 16, lineHeight: 22, color: "#111" },
  fadeGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 60,
  },
  readMore: {
    color: "#007bff",
    fontWeight: "600",
    fontSize: 15,
    marginTop: 4,
  },
  image: {
    width: SCREEN_WIDTH - 24,
    height: 330,
    borderRadius: 12,
    marginVertical: 14,
    alignSelf: "center",
    backgroundColor: "#000",
  },
  mediaVideoBox: {
    width: SCREEN_WIDTH - 14,
    height: 330,
    backgroundColor: "#000",
    borderRadius: 22,
    overflow: "hidden",
    marginVertical: 14,
    alignSelf: "center",
  },
  viewsRow: {
    marginTop: -6,
    marginBottom: 10,
    paddingHorizontal: 4,
    alignItems: "flex-start",
  },
  viewsText: {
    fontSize: 13,
    color: "#666",
  },
  carouselWrapper: { position: "relative" },
  imageCounter: {
    position: "absolute",
    right: 18,
    top: 32,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  imageCounterText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 0,
    marginBottom: 22,
  },
  likeWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  likesCount: { fontSize: 16, fontWeight: "600" },
  commentsInfo: { flexDirection: "row", alignItems: "center" },
  count: { fontSize: 16, marginLeft: 4, fontWeight: "600" },
  viewsInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  viewsCountText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#555",
  },
  viewerContainer: { flex: 1, backgroundColor: "#000" },
  viewerImageWrapper: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: Dimensions.get("window").height,
  },
  viewerClose: {
    position: "absolute",
    top: 40,
    right: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
  },
  viewerCloseText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
  viewerCounter: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  viewerCounterText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});
