// ======================================================
// 📄 FeedItemEnhanced.tsx — v31.2-HYBRID (auto-fit imágenes mejorado + repost persistente)
// ======================================================

import QuickPlayVideo, {
  type VideoViewReason,
} from "@/components/QuickPlayVideo";
import { useUser } from "@/contexts/AuthContext";
import { api, API_URL, deletePost, repostPost } from "@/services/api";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  Eye,
  Heart,
  MessageCircle,
  MoreHorizontal,
  Play,
  ArrowUpDown,
  Trash2,
} from "lucide-react-native";
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AccessibilityInfo,
  ActionSheetIOS,
  Alert,
  AlertButton,
  Dimensions,
  Image,
  Linking,
  LogBox,
  Modal,
  Platform,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  emitFeedUpdate,
  subscribeToUserProfileUpdates,
} from "../utils/feedEvents";

LogBox.ignoreLogs(["Unable to activate keep awake"]);

// Orientaciones de imagen
type ImageOrientation = "horizontal" | "vertical" | "square" | "unknown";

type FeedItemProps = {
  item: any;
  isVisible: boolean;
  onDeleted?: (id: string) => void;
  nextItem?: any;
  onMediaError?: (item: any) => void;
};

// ======================================================
// 🕓 Función "hace X tiempo"
// ======================================================
const timeAgo = (dateString?: string) => {
  if (!dateString) return "";
  const now = new Date();
  const date = new Date(dateString);
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 5) return "justo ahora";
  if (diffSec < 60) return `hace ${diffSec}s`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `hace ${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `hace ${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays}d`;
  return date.toLocaleDateString();
};

// ======================================================
// ⏱ Formatear duración tipo 1:23 / 01:23:45
// ======================================================
const formatDuration = (sec?: number | null): string => {
  if (typeof sec !== "number" || !Number.isFinite(sec) || sec <= 0) {
    return "0:00";
  }
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s
      .toString()
      .padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
};

// ======================================================
// 📋 Clipboard resiliente (Expo / RN bare)
// ======================================================
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    // eslint-disable-next-line import/no-unresolved
    const expoClip = await import("expo-clipboard");
    if (expoClip?.setStringAsync) {
      await expoClip.setStringAsync(text);
      return true;
    }
  } catch {}

  try {
    const RNClip =
      // eslint-disable-next-line import/no-unresolved
      (await import("@react-native-clipboard/clipboard")).default;
    if (RNClip?.setString) {
      RNClip.setString(text);
      return true;
    }
  } catch {}

  try {
    await Share.share({ message: text });
    return true;
  } catch {}

  return false;
}

// ======================================================
// 🌐 Base URL imágenes/media (mismo host que api.ts)
// ======================================================
const RAW_BASE =
  api?.defaults?.baseURL ||
  API_URL ||
  "https://api.quickchatx.com/api";

const TRIMMED_API_BASE_URL = RAW_BASE.replace(/\/+$/, "");
const IMAGE_BASE_URL = TRIMMED_API_BASE_URL.replace(/\/api$/i, "");

// ======================================================
// 🧠 Helper calidad por URL
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
// 🧩 Resolver imágenes / media
// ======================================================
const resolveImage = (url?: string | null): string | null => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("/")) return `${IMAGE_BASE_URL}${url}`;

  const cleaned = url.replace(/^\/+/, "");

  if (cleaned.startsWith("uploads/") || cleaned.startsWith("upload/")) {
    return `${IMAGE_BASE_URL}/${cleaned}`;
  }

  return `${IMAGE_BASE_URL}/${
    cleaned.startsWith("maykelhg/") ? cleaned : `uploads/${cleaned}`
  }`;
};

// ✅ Avatares usan exactamente la misma lógica que las imágenes del feed
const resolveAvatar = (url?: string | null): string | null => {
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  return resolveImage(url);
};

// 🔧 Helper para sacar avatar del usuario autenticado, soportando distintos shapes
const getAuthUserAvatar = (authUser: any): string | null => {
  if (!authUser) return null;

  const candidates = [
    // Preferimos virtual seguro del backend si existe
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

    authUser.data?.user?.safeAvatar,
    authUser.data?.user?.avatarUrl,
    authUser.data?.user?.profilePhoto,
    authUser.data?.user?.image,
    authUser.data?.user?.photoUrl,
    authUser.data?.user?.picture,
  ];

  for (const src of candidates) {
    if (!src) continue;
    const resolved = resolveAvatar(src);
    if (resolved) return resolved;
  }

  return null;
};

// ======================================================
// 🧠 Cache global de avatares por userId
// ======================================================
const avatarCache: Record<string, string> = {};

const getAvatarFromCache = (authorId?: string | null): string | null => {
  if (!authorId) return null;
  return avatarCache[String(authorId)] || null;
};

const setAvatarInCache = (
  authorId?: string | null,
  url?: string | null
): void => {
  if (!authorId || !url) return;
  avatarCache[String(authorId)] = url;
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

/**
 * Escoge la mejor variante de video desde el JSON del backend.
 * 👉 Para el feed móvil, preferimos 360p (rápido), luego 720p, 480p, 1080p, 240p.
 */
const pickBestVariant = (variants: any[] | undefined | null): any | null => {
  if (!Array.isArray(variants) || variants.length === 0) return null;

  const pref = ["360p", "720p", "480p", "1080p", "240p"];

  for (const p of pref) {
    const found = variants.find((v) => {
      const q = String(v?.quality || "").toLowerCase();
      return q === p.toLowerCase();
    });
    if (found) return found;
  }

  return variants[0];
};

const getOrientationFromWH = (
  width?: number | null,
  height?: number | null
): ImageOrientation => {
  if (!width || !height || width <= 0 || height <= 0) return "unknown";
  const ratio = width / height;
  if (ratio > 1.05) return "horizontal";
  if (ratio < 0.95) return "vertical";
  return "square";
};

const normalizeOrientationFromBackend = (
  orientation: any
): ImageOrientation => {
  if (!orientation) return "unknown";
  const val = String(orientation).toLowerCase();
  if (val === "horizontal" || val === "landscape") return "horizontal";
  if (val === "vertical" || val === "portrait") return "vertical";
  if (val === "square" || val === "cuadrada" || val === "squareish")
    return "square";
  return "unknown";
};

// ======================================================
// 🔢 Extraer viewsCount desde cualquier shape del backend
// ======================================================
const extractViewsCount = (src: any): number | undefined => {
  if (!src || typeof src !== "object") return undefined;

  if (typeof src.viewsCount === "number") return src.viewsCount;
  if (typeof src.videoViews === "number") return src.videoViews;

  if (Array.isArray(src.views)) return src.views.length;

  if (src.stats && typeof src.stats === "object") {
    if (typeof src.stats.views === "number") return src.stats.views;
    if (typeof src.stats.videoViews === "number")
      return src.stats.videoViews;
  }

  return undefined;
};

// ======================================================
// 🔢 Extraer repostsCount desde cualquier shape del backend
// ======================================================
const extractRepostsCount = (src: any): number | undefined => {
  if (!src || typeof src !== "object") return undefined;

  // Campos directos
  if (typeof src.repostsCount === "number") return src.repostsCount;
  if (typeof src.repostCount === "number") return src.repostCount;
  if (typeof src.sharesCount === "number") return src.sharesCount;
  if (typeof src.shareCount === "number") return src.shareCount;

  // Arrays
  if (Array.isArray(src.reposts)) return src.reposts.length;
  if (Array.isArray(src.shares)) return src.shares.length;

  // Dentro de stats
  if (src.stats && typeof src.stats === "object") {
    if (typeof src.stats.reposts === "number") return src.stats.reposts;
    if (typeof src.stats.shares === "number") return src.stats.shares;
  }

  return undefined;
};

// ======================================================
// 🧱 Obtener post raíz para estadísticas de repost
// ======================================================
const getRootPostForReposts = (src: any) => {
  if (!src || typeof src !== "object") return src;
  return (
    src.originalPost ||
    src.targetPost ||
    src.rootPost ||
    src.post ||
    src
  );
};

// ======================================================
// 🖼 Derivar thumbnail a partir de la URL del video
// ======================================================
const deriveVideoThumbFromUrl = (
  videoUrl?: string | null
): string | null => {
  if (!videoUrl || typeof videoUrl !== "string") return null;

  try {
    let origin = "";
    let path = videoUrl;

    // 🔹 No tiene sentido derivar thumb para rutas locales del dispositivo
    if (/^file:\/\//i.test(videoUrl)) {
      if (__DEV__) {
        console.log("[FeedItemEnhanced] deriveThumb SKIP file://", {
          videoUrl,
        });
      }
      return null;
    }

    // Si viene con http(s), separamos host y path
    if (/^https?:\/\//i.test(videoUrl)) {
      const u = new URL(videoUrl);
      origin = `${u.protocol}//${u.host}`;
      path = u.pathname || "";
    } else {
      if (!path.startsWith("/")) path = `/${path}`;
    }

    // 1️⃣ Caso principal: cualquier ruta que contenga "vid_<digits>...mp4"
    const vidMatch =
      path.match(/(vid_\d+)[^/]*\.(mp4|mov|m4v|webm)$/i) || null;

    if (vidMatch) {
      const baseName = vidMatch[1]; // vid_1764898279707
      const host = origin || IMAGE_BASE_URL;
      const thumbPath = `/uploads/thumbs/${baseName}.jpg`;
      const final = `${host}${thumbPath}`;

      if (__DEV__) {
        console.log("[FeedItemEnhanced] deriveThumb MATCH vid_", {
          videoUrl,
          path,
          thumb: final,
        });
      }

      return final;
    }

    // 2️⃣ Patrón general backend:
    //     /uploads/<carpetas...>/<file>.mp4
    const uploadsMatch =
      path.match(
        /\/uploads\/(.+)\/([^/]+)\.(mp4|mov|m4v|webm)$/i
      ) || null;

    if (uploadsMatch) {
      const folders = uploadsMatch[1];
      const baseName = uploadsMatch[2];
      const host = origin || IMAGE_BASE_URL;

      const thumbPath = `/uploads/thumbs/${folders}/${baseName}.jpg`;
      const final = `${host}${thumbPath}`;

      if (__DEV__) {
        console.log(
          "[FeedItemEnhanced] deriveThumb MATCH uploads/*",
          {
            videoUrl,
            path,
            thumb: final,
          }
        );
      }

      return final;
    }

    if (__DEV__) {
      console.log("[FeedItemEnhanced] deriveThumb NO MATCH", {
        videoUrl,
        path,
      });
    }

    return null;
  } catch (e) {
    if (__DEV__) {
      console.log("[FeedItemEnhanced] deriveThumb ERROR", {
        videoUrl,
        error: String(e),
      });
    }
    return null;
  }
};

// ======================================================
// 📦 Lista de medias (galería)
// ======================================================
const resolveMediaList = (item: any) => {
  const list = Array.isArray(item?.media) ? item.media : [];

  // 🧹 DEDUPE: evitamos medias duplicadas por la misma URL cruda
  const seen = new Set<string>();
  const uniqueList = list.filter((m: any) => {
    const rawUrl =
      m?.url ||
      m?.path ||
      m?.videoUrl ||
      m?.imageUrl ||
      m?.thumbnail ||
      m?.thumbUrl ||
      m?.previewUrl ||
      m?.mediaUrl ||
      item?.videoUrl ||
      item?.video?.url ||
      item?.imageUrl;

    const key = rawUrl ? String(rawUrl) : JSON.stringify(m || {});
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return uniqueList
    .map((m: any) => {
      const rawType = m?.type || m?.kind;
      const mime = m?.mime || m?.mimetype || "";
      const isVideoFromType =
        rawType === "video" ||
        rawType === "VIDEO" ||
        rawType === "video/mp4";
      const isVideoFromMime =
        typeof mime === "string" && mime.toLowerCase().startsWith("video");
      const isVideo = isVideoFromType || isVideoFromMime;

      const variants = Array.isArray(m?.variants) ? m.variants : [];
      const bestVariant = pickBestVariant(variants);

      const rawUrl =
        m?.url ||
        bestVariant?.url ||
        m?.path ||
        m?.videoUrl ||
        m?.imageUrl ||
        m?.thumbnail ||
        m?.thumbUrl ||
        m?.previewUrl ||
        m?.mediaUrl ||
        item?.videoUrl ||
        item?.video?.url ||
        item?.imageUrl;

      const qualityFromMeta =
        m?.quality ||
        m?.resolution ||
        m?.label ||
        bestVariant?.quality ||
        item?.video?.quality ||
        null;
      const qualityFromUrl = guessQualityFromUrl(rawUrl);

      const duration =
        typeof m?.duration === "number"
          ? m.duration
          : typeof m?.videoDuration === "number"
          ? m.videoDuration
          : typeof m?.length === "number"
          ? m.length
          : typeof m?.meta?.duration === "number"
          ? m.meta.duration
          : typeof item?.duration === "number"
          ? item.duration
          : typeof item?.videoDuration === "number"
          ? item.videoDuration
          : null;

      const width =
        typeof m?.width === "number"
          ? m.width
          : typeof m?.w === "number"
          ? m.w
          : typeof m?.meta?.width === "number"
          ? m.meta.width
          : undefined;

      const height =
        typeof m?.height === "number"
          ? m.height
          : typeof m?.h === "number"
          ? m.h
          : typeof m?.meta?.height === "number"
          ? m.meta.height
          : undefined;

      const aspectRatio =
        typeof width === "number" &&
        typeof height === "number" &&
        width > 0 &&
        height > 0
          ? width / height
          : undefined;

      const orientationFromBackend = normalizeOrientationFromBackend(
        m?.orientation
      );
      const orientation: ImageOrientation =
        orientationFromBackend !== "unknown"
          ? orientationFromBackend
          : getOrientationFromWH(width, height);

      return {
        type: isVideo ? "video" : "image",
        url: resolveImage(rawUrl),
        thumb: resolveImage(
          m?.thumbUrl ||
            m?.thumbnailUrl ||
            m?.posterUrl ||
            m?.thumbnail ||
            m?.previewUrl ||
            item?.video?.thumbUrl ||
            item?.video?.thumbnailUrl ||
            item?.thumbUrl ||
            item?.thumbnailUrl ||
            item?.thumbnail ||
            item?.previewUrl
        ),
        videoId: m?.videoId || null,
        quality: qualityFromMeta || qualityFromUrl || null,
        duration,
        width,
        height,
        aspectRatio,
        orientation,
      };
    })
    .filter((m: any) => m.url || m.videoId);
};

// ======================================================
// 🎬 Media principal (primer elemento / directo)
// ======================================================
const resolveMedia = (item: any) => {
  // 1) Array media (caso principal)
  if (Array.isArray(item?.media) && item.media.length > 0) {
    const m = item.media[0];

    const rawType = m?.type || m?.kind;
    const mime = m?.mime || m?.mimetype || "";
    const isVideoFromType =
      rawType === "video" ||
      rawType === "VIDEO" ||
      rawType === "video/mp4";
    const isVideoFromMime =
      typeof mime === "string" && mime.toLowerCase().startsWith("video");
    const isVideo = isVideoFromType || isVideoFromMime;

    const variants = Array.isArray(m?.variants) ? m.variants : [];
    const bestVariant = pickBestVariant(variants);

    const rawUrl =
      m?.url ||
      bestVariant?.url ||
      m?.path ||
      m?.videoUrl ||
      m?.imageUrl ||
      m?.thumbnail ||
      m?.thumbUrl ||
      m?.previewUrl ||
      m?.mediaUrl ||
      item?.videoUrl ||
      item?.video?.url ||
      item?.imageUrl;

    const qualityFromMeta =
      m?.quality ||
      m?.resolution ||
      m?.label ||
      bestVariant?.quality ||
      item?.video?.quality ||
      null;
    const qualityFromUrl = guessQualityFromUrl(rawUrl);

    const duration =
      typeof m?.duration === "number"
        ? m.duration
        : typeof m?.videoDuration === "number"
        ? m.videoDuration
        : typeof m?.length === "number"
        ? m.length
        : typeof item?.duration === "number"
        ? item.duration
        : typeof item?.videoDuration === "number"
        ? item.videoDuration
        : typeof m?.meta?.duration === "number"
        ? m.meta.duration
        : null;

    const width =
      typeof m?.width === "number"
        ? m.width
        : typeof m?.w === "number"
        ? m.w
        : typeof m?.meta?.width === "number"
        ? m.meta.width
        : undefined;

    const height =
      typeof m?.height === "number"
        ? m.height
        : typeof m?.h === "number"
        ? m.h
        : typeof m?.meta?.height === "number"
        ? m.meta.height
        : undefined;

    const aspectRatio =
      typeof width === "number" &&
      typeof height === "number" &&
      width > 0 &&
      height > 0
        ? width / height
        : undefined;

    const orientationFromBackend = normalizeOrientationFromBackend(
      m?.orientation
    );
    const orientation: ImageOrientation =
      orientationFromBackend !== "unknown"
        ? orientationFromBackend
        : getOrientationFromWH(width, height);

    return {
      type: isVideo ? "video" : "image",
      url: resolveImage(rawUrl),
      thumb: resolveImage(
        m?.thumbUrl ||
          m?.thumbnailUrl ||
          m?.posterUrl ||
          m?.thumbnail ||
          m?.previewUrl ||
          item?.video?.thumbUrl ||
          item?.video?.thumbnailUrl ||
          item?.thumbUrl ||
          item?.thumbnailUrl ||
          item?.thumbnail ||
          item?.previewUrl
      ),
      videoId: m?.videoId || null,
      quality: qualityFromMeta || qualityFromUrl || null,
      duration,
      width,
      height,
      aspectRatio,
      orientation,
    } as any;
  }

  // 2) YouTube
  if (item?.videoId) {
    return {
      type: "youtube",
      videoId: item.videoId,
      thumb: `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
      url: null,
      quality: null,
      duration: null,
    };
  }

  // 3) Video directo (string o JSON simple)
  if (item?.video || item?.videoUrl || typeof item?.video === "object") {
    const videoObj = typeof item.video === "object" ? item.video : null;
    const variants = Array.isArray(videoObj?.variants)
      ? videoObj.variants
      : [];

    const bestVariant = pickBestVariant(variants);

    const rawUrl =
      videoObj?.url ||
      bestVariant?.url ||
      item.video ||
      item.videoUrl;

    const duration =
      typeof videoObj?.duration === "number"
        ? videoObj.duration
        : typeof item?.duration === "number"
        ? item.duration
        : typeof item?.videoDuration === "number"
        ? item.videoDuration
        : null;

    const qualityFromMeta =
      videoObj?.quality ||
      bestVariant?.quality ||
      item?.videoQuality ||
      null;
    const qualityFromUrl = guessQualityFromUrl(rawUrl);

    return {
      type: "video",
      url: resolveImage(rawUrl),
      thumb: resolveImage(
        videoObj?.thumbUrl ||
          videoObj?.thumbnailUrl ||
          videoObj?.posterUrl ||
          videoObj?.previewUrl ||
          item?.thumbUrl ||
          item?.thumbnailUrl ||
          item?.thumbnail ||
          item?.previewUrl
      ),
      videoId: videoObj?.videoId || null,
      quality: qualityFromMeta || qualityFromUrl || null,
      duration,
    };
  }

  // 4) Imagen directa (más campos soportados)
  const directImageRaw =
    item?.image ||
    item?.imageUrl ||
    item?.thumbnail ||
    item?.thumbUrl ||
    item?.previewUrl ||
    item?.mediaUrl;

  if (directImageRaw) {
    return {
      type: "image",
      url: resolveImage(directImageRaw),
      thumb: resolveImage(
        item?.thumbUrl ||
          item?.thumbnailUrl ||
          item?.thumbnail ||
          item?.previewUrl
      ),
      videoId: null,
      quality: null,
      duration: null,
    };
  }

  // 5) Sin media
  return {
    type: "post",
    url: null,
    thumb: null,
    videoId: null,
    quality: null,
  };
};

// ======================================================
// 🧩 Componente principal
// ======================================================
function FeedItemEnhanced({
  item,
  isVisible,
  onDeleted,
  nextItem,
  onMediaError,
}: FeedItemProps) {
  const router = useRouter();
  const { user, syncUserProfile } = useUser();

  const currentUserId = user?._id || user?.id || null;
  const isNews = item?.type === "news";

  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [viewsCount, setViewsCount] = useState(0);
  const [repostsCount, setRepostsCount] = useState(0);
  const [reposted, setReposted] = useState(false);
  const [mediaRetry, setMediaRetry] = useState(0);

  const [cachedItem, setCachedItem] = useState(item);
  const [relativeTime, setRelativeTime] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [showNewsModal, setShowNewsModal] = useState(false);

  const [galleryIndex, setGalleryIndex] = useState(0);
  const galleryLenRef = useRef(0);

  // 👁️ Control: solo una view registrada por sesión de item en feed
  const hasRegisteredViewRef = useRef(false);

  const [avatarError, setAvatarError] = useState(false);

  // 🎞 Miniatura generada localmente (si el backend no envía thumb)
  const [videoThumb, setVideoThumb] = useState<string | null>(null);
  const [repostPreviewGenerated, setRepostPreviewGenerated] =
    useState<string | null>(null);

  // 🧮 Orientación de la imagen principal del post
  const [mainImageOrientation, setMainImageOrientation] =
    useState<ImageOrientation>("unknown");

  // 🧮 Proporción real de la imagen principal (width/height)
  const [mainAspectRatio, setMainAspectRatio] = useState<number | null>(null);

  // 🌀 Repost modal state
  const [showRepostModal, setShowRepostModal] = useState(false);
  const [repostComment, setRepostComment] = useState("");
  const [reposting, setReposting] = useState(false);

  useEffect(() => {
    if (__DEV__) {
      console.log("🟣 ITEM FEED:", item?._id || item?.id || "sin-id");
    }
  }, [item]);

  const [reduceTransparencyIOS, setReduceTransparencyIOS] = useState(false);

  useEffect(() => {
    const AI: any = AccessibilityInfo;
    let subscription: { remove?: () => void } | undefined;

    AI?.isReduceTransparencyEnabled?.()
      ?.then((v: boolean) => setReduceTransparencyIOS(v))
      .catch(() => {});

    if (AI?.addEventListener) {
      subscription = AI.addEventListener(
        "reduceTransparencyChanged",
        (v: boolean) => setReduceTransparencyIOS(v)
      );
    }

    return () => {
      subscription?.remove?.();
    };
  }, []);

  const showDots = !(Platform.OS === "ios" && reduceTransparencyIOS);

  // 👉 Usamos cachedItem para media, por si se refresca vía feedEvents
  const media: any = useMemo(
    () => resolveMedia(cachedItem),
    [cachedItem]
  );
  const gallery: any[] = useMemo(
    () => resolveMediaList(cachedItem),
    [cachedItem]
  );
  galleryLenRef.current = gallery.length;

  const {
    type: mediaType,
    width: mediaWidth,
    height: mediaHeight,
    thumb: mediaThumb,
    url: mediaUrl,
    orientation: mediaOrientation,
    aspectRatio: mediaAspectRatio,
  } = media || {};

  // 👉 Flag claro de si el post es de VIDEO
  const isVideoPost = !isNews && mediaType === "video";

  // Vista previa para el modal de repost
  const repostPreviewUri = useMemo(() => {
    if (mediaType === "image") {
      return mediaThumb || mediaUrl;
    }
    if (mediaType === "video") {
      return mediaThumb || videoThumb || (mediaUrl ? deriveVideoThumbFromUrl(mediaUrl) : null);
    }
    if (Array.isArray(gallery) && gallery.length > 0) {
      const first = gallery[0];
      return first?.thumb || first?.url || null;
    }
    return mediaThumb || mediaUrl || null;
  }, [mediaType, mediaThumb, mediaUrl, videoThumb, gallery]);

  const effectiveRepostPreview = repostPreviewGenerated || repostPreviewUri;

  // ======================================================
  // 🧮 Detectar orientación + aspectRatio de la imagen principal
  // ======================================================
  useEffect(() => {
    if (mediaType !== "image") {
      setMainImageOrientation("unknown");
      setMainAspectRatio(null);
      return;
    }

    const backendOri = normalizeOrientationFromBackend(mediaOrientation);
    if (backendOri !== "unknown") {
      setMainImageOrientation(backendOri);
    } else {
      const oriFromMeta = getOrientationFromWH(mediaWidth, mediaHeight);
      setMainImageOrientation(oriFromMeta);
    }

    if (typeof mediaAspectRatio === "number" && mediaAspectRatio > 0) {
      setMainAspectRatio(mediaAspectRatio);
      return;
    }

    if (
      typeof mediaWidth === "number" &&
      typeof mediaHeight === "number" &&
      mediaWidth > 0 &&
      mediaHeight > 0
    ) {
      setMainAspectRatio(mediaWidth / mediaHeight);
      return;
    }

    const uri = mediaThumb || mediaUrl;
    if (!uri) return;

    let cancelled = false;

    Image.getSize(
      uri,
      (w, h) => {
        if (cancelled) return;
        const o = getOrientationFromWH(w, h);
        setMainImageOrientation(o);
        if (w > 0 && h > 0) {
          setMainAspectRatio(w / h);
        }
      },
      () => {
        if (!cancelled) {
          setMainImageOrientation("unknown");
          setMainAspectRatio(null);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [
    mediaType,
    mediaOrientation,
    mediaAspectRatio,
    mediaWidth,
    mediaHeight,
    mediaThumb,
    mediaUrl,
  ]);

  // ======================================================
  // 🎞 Generar miniatura local si es video y no hay thumb
  // ======================================================
  useEffect(() => {
    if (media.type !== "video" || !media.url) {
      setVideoThumb(null);
      return;
    }

    if (media.thumb) {
      setVideoThumb(null);
      return;
    }

    if (videoThumb) return;

    let cancelled = false;

    (async () => {
      try {
        const mod: any = await import("@/utils/videoThumbnailExtractor");
        const fn =
          mod?.getVideoThumbnail ||
          mod?.extractThumbnail ||
          mod?.createVideoThumbnail ||
          mod?.default;

        if (!fn) {
          console.log("⚠ videoThumbnailExtractor sin función usable");
          return;
        }

        const result = await fn(media.url);
        if (cancelled) return;

        const uri =
          typeof result === "string"
            ? result
            : result?.uri || result?.path || null;

        if (uri) {
          console.log("✅ Miniatura generada para", media.url);
          setVideoThumb(uri);
        }
      } catch (e) {
        console.log("⚠ Error generando miniatura:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [media.type, media.url, media.thumb, videoThumb]);

  // Intentar generar thumbnail para modal de repost cuando falte
  useEffect(() => {
    if (!showRepostModal) return;
    if (effectiveRepostPreview) return;
    if (media.type !== "video" || !media.url) return;

    let cancelled = false;

    (async () => {
      try {
        const mod: any = await import("@/utils/videoThumbnailExtractor");
        const fn =
          mod?.getVideoThumbnail ||
          mod?.extractThumbnail ||
          mod?.createVideoThumbnail ||
          mod?.default;

        if (!fn) return;
        const result = await fn(media.url);
        if (cancelled) return;
        const uri =
          typeof result === "string"
            ? result
            : result?.uri || result?.path || null;
        if (uri) {
          setRepostPreviewGenerated(uri);
        }
      } catch {
        // silencioso
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [showRepostModal, effectiveRepostPreview, media.type, media.url]);

  const postId = String(cachedItem?._id || cachedItem?.id || "");

  // cada vez que cambia de post ⇒ reset de flag de view
  useEffect(() => {
    hasRegisteredViewRef.current = false;
  }, [postId]);

  const publishedAt =
    item?.publishedAt ||
    item?.createdAt ||
    item?.timestamp ||
    item?.date ||
    null;

  const absolutePublishedAt = publishedAt ? new Date(publishedAt) : null;
  const absolutePublishedAtStr = absolutePublishedAt
    ? absolutePublishedAt.toLocaleString()
    : "";

  const authorId =
    item?.authorId ||
    item?.userId ||
    item?.user?._id ||
    item?.user?.id ||
    item?.ownerId ||
    item?.owner?._id ||
    item?.author?._id ||
    item?.createdBy?._id ||
    null;

  const isCurrentUserAuthor =
    !!user && authorId && String(authorId) === String(user._id || user.id);

  const newsSourceName =
    typeof item?.source === "string"
      ? item.source
      : item?.source?.name || "News";

  const selfDisplayName =
    user?.username ||
    (user as any)?.displayName ||
    (((user as any)?.firstName || (user as any)?.lastName) &&
      `${(user as any)?.firstName || ""} ${
        (user as any)?.lastName || ""
      }`.trim()) ||
    (user as any)?.name ||
    "Yo";

  const username = isNews
    ? newsSourceName
    : isCurrentUserAuthor
    ? selfDisplayName
    : item?.authorUsername ||
      item?.username ||
      item?.user?.username ||
      item?.owner?.username ||
      item?.author?.username ||
      item?.createdBy?.username ||
      item?.user?.name ||
      item?.owner?.name ||
      item?.author?.name ||
      item?.createdBy?.name ||
      item?.name ||
      "Usuario";

  const avatar: string | null = isNews
    ? null
    : (() => {
        const srcItem = cachedItem || item;

        const fromSelf =
          isCurrentUserAuthor && user ? getAuthUserAvatar(user) : null;

        const fromCache = getAvatarFromCache(authorId);

        const itemCandidates = [
          srcItem?.safeAvatar,

          srcItem?.avatarUrl,
          srcItem?.avatar,
          srcItem?.photo,
          srcItem?.photoUrl,
          srcItem?.picture,

          srcItem?.author?.safeAvatar,
          srcItem?.author?.avatarUrl,
          srcItem?.author?.avatar,
          srcItem?.author?.photoUrl,
          srcItem?.author?.profilePhoto,
          srcItem?.author?.photo,
          srcItem?.author?.picture,

          srcItem?.createdBy?.safeAvatar,
          srcItem?.createdBy?.avatarUrl,
          srcItem?.createdBy?.avatar,
          srcItem?.createdBy?.photoUrl,
          srcItem?.createdBy?.profilePhoto,
          srcItem?.createdBy?.photo,
          srcItem?.createdBy?.picture,

          srcItem?.user?.safeAvatar,
          srcItem?.user?.avatarUrl,
          srcItem?.user?.avatar,
          srcItem?.user?.photoUrl,
          srcItem?.user?.profilePhoto,
          srcItem?.user?.photo,
          srcItem?.user?.picture,

          srcItem?.owner?.safeAvatar,
          srcItem?.owner?.avatarUrl,
          srcItem?.owner?.avatar,
          srcItem?.owner?.photoUrl,
          srcItem?.owner?.profilePhoto,
          srcItem?.owner?.photo,
          srcItem?.owner?.picture,
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
          user,
          authorId
        );

        const fallback = resolveAvatar("/uploads/default-avatar.png");

        const finalAvatar =
          fromSelf ||
          fromCache ||
          fromItem ||
          fromRelations ||
          fallback ||
          null;

        if (authorId && finalAvatar && finalAvatar !== fromCache) {
          setAvatarInCache(authorId, finalAvatar);
        }

        if (__DEV__) {
          console.log(
            "🧑‍🎨 AVATAR DEBUG",
            JSON.stringify(
              {
                postId,
                authorId,
                avatarError,
                finalAvatar,
                fromSelf,
                fromCache,
                fromItem,
                fromRelations,
              },
              null,
              2
            )
          );
        }

        return finalAvatar;
      })();

  const fallbackAvatar =
    resolveAvatar("/uploads/default-avatar.png") ||
    `${IMAGE_BASE_URL}/uploads/default-avatar.png`;

  const avatarSource = avatarError
    ? { uri: fallbackAvatar }
    : { uri: avatar || fallbackAvatar };

  const isOwner = isCurrentUserAuthor;

  useEffect(() => {
    if (!publishedAt || isNews) return;
    setRelativeTime(timeAgo(publishedAt));
    const interval = setInterval(
      () => setRelativeTime(timeAgo(publishedAt)),
      60000
    );
    return () => clearInterval(interval);
  }, [publishedAt, isNews]);

  // ======================================================
  // 🔄 Inicializar LIKEs / COMENTARIOS / VIEWS (solo video) + REPOSTS
  // ======================================================
  useEffect(() => {
    setCachedItem(item);

    const likesArray = Array.isArray(item?.likes) ? item.likes : [];
    const initialLikesCount =
      typeof item?.likesCount === "number"
        ? item.likesCount
        : likesArray.length;

    const initialLiked =
      typeof item?.likedByUser === "boolean"
        ? item.likedByUser
        : typeof item?.liked === "boolean"
        ? item.liked
        : currentUserId
        ? likesArray.some(
            (id: any) => String(id) === String(currentUserId)
          )
        : false;

    setLikesCount(initialLikesCount);
    setLiked(initialLiked);

    const initialCommentsCount =
      typeof item?.commentsCount === "number"
        ? item.commentsCount
        : Array.isArray(item?.comments)
        ? item.comments.length
        : 0;

    setCommentsCount(initialCommentsCount);

    // 🔁 REPOSTS desde backend (siempre usando el post raíz) + nunca bajar el contador local
    const repostSource = getRootPostForReposts(item);

    const initialRepostsCount =
      extractRepostsCount(repostSource) ?? 0;

    const repostsArray = Array.isArray(repostSource?.reposts)
      ? repostSource.reposts
      : [];

    const initialReposted =
      typeof repostSource?.repostedByUser === "boolean"
        ? repostSource.repostedByUser
        : currentUserId
        ? repostsArray.some(
            (id: any) => String(id) === String(currentUserId)
          )
        : false;

    setRepostsCount((prev) => {
      const safePrev = typeof prev === "number" ? prev : 0;
      return initialRepostsCount > safePrev
        ? initialRepostsCount
        : safePrev;
    });
    setReposted(initialReposted);

    // 👁 Inicializar views SOLO si es un post de VIDEO
    if (!isVideoPost) {
      setViewsCount(0);
      return;
    }

    const initialViewsCount = extractViewsCount(item) ?? 0;

    // 🔒 FIX: nunca bajar el contador local; solo subir si backend trae más
    setViewsCount((prev) => {
      const safePrev = typeof prev === "number" ? prev : 0;
      return initialViewsCount > safePrev ? initialViewsCount : safePrev;
    });
  }, [item, currentUserId, isVideoPost]);

  // ======================================================
  // 🔄 Sync explícito con backend al montar/abrir post de VIDEO
  // ======================================================
  const refreshViewsFromBackend = useCallback(async () => {
    if (!postId || isNews || !isVideoPost) return;

    const endpoints = [
      `/posts/${postId}/stats`,
      `/posts/${postId}/views`,
      `/posts/${postId}`,
    ];

    for (const url of endpoints) {
      try {
        const res = await api.get(url as any);
        const data = res?.data?.data || res?.data;

        const backendViews = extractViewsCount(data);
        if (typeof backendViews === "number") {
          setViewsCount((prev) => {
            const safePrev = typeof prev === "number" ? prev : 0;
            const final = backendViews > safePrev ? backendViews : safePrev;

            if (final > safePrev) {
              emitFeedUpdate({
                type: "videoViews",
                postId: String(postId),
                viewsCount: final,
              });
            }

            return final;
          });
        }

        break; // éxito en este endpoint → salimos del loop
      } catch (e: any) {
        const status = e?.response?.status;
        if (status === 404 || status === 405) {
          continue;
        }
        if (__DEV__) {
          console.log(
            "[FeedItemEnhanced] error refrescando views desde backend:",
            url,
            e?.response?.status || e
          );
        }
        break;
      }
    }
  }, [postId, isNews, isVideoPost]);

  useEffect(() => {
    if (!postId || isNews || !isVideoPost) return;
    refreshViewsFromBackend();
  }, [postId, isNews, isVideoPost, refreshViewsFromBackend]);

  // ======================================================
  // 🔄 Sync de avatar vía feedEvents
  // ======================================================
  useEffect(() => {
    const unsub = subscribeToUserProfileUpdates((payload) => {
      if (!authorId) return;
      if (String(payload.userId) !== String(authorId)) return;

      setCachedItem((prev: any) => ({
        ...prev,
        safeAvatar: payload.safeAvatar || prev?.safeAvatar,
        avatarUrl: payload.avatarUrl || prev?.avatarUrl,
        authorUsername: payload.username || prev?.authorUsername,
        author: {
          ...(prev?.author || {}),
          safeAvatar: payload.safeAvatar || prev?.author?.safeAvatar,
          avatarUrl: payload.avatarUrl || prev?.author?.avatarUrl,
          username: payload.username || prev?.author?.username,
        },
        createdBy: {
          ...(prev?.createdBy || {}),
          safeAvatar: payload.safeAvatar || prev?.createdBy?.safeAvatar,
          avatarUrl: payload.avatarUrl || prev?.createdBy?.avatarUrl,
          username: payload.username || prev?.createdBy?.username,
        },
        user: {
          ...(prev?.user || {}),
          safeAvatar: payload.safeAvatar || prev?.user?.safeAvatar,
          avatarUrl: payload.avatarUrl || prev?.user?.avatarUrl,
          username: payload.username || prev?.user?.username,
        },
      }));

      const rawAvatar = payload.safeAvatar || payload.avatarUrl;
      const resolved = resolveAvatar(rawAvatar);
      if (resolved) {
        setAvatarInCache(payload.userId, resolved);
      }

      setAvatarError(false);
    });

    return unsub;
  }, [authorId]);

  const openPostOrNews = useCallback(() => {
    if (isNews) return setShowNewsModal(true);
    if (!postId) return;
    router.push(`/post/${postId}`);
  }, [isNews, postId, router]);

  const handleLike = useCallback(async () => {
    if (!postId) return;

    const optimistic = !liked;
    setLiked(optimistic);
    setLikesCount((n) => (optimistic ? n + 1 : Math.max(n - 1, 0)));

    try {
      const endpoint = isNews
        ? `/news/like/${postId}`
        : `/posts/like/${postId}`;
      const res = await api.post(endpoint);
      const updated = res?.data?.data || res?.data;

      if (updated) {
        const backendLikesArr = Array.isArray(updated.likes)
          ? updated.likes
          : [];

        const backendCount =
          typeof updated.likesCount === "number"
            ? updated.likesCount
            : backendLikesArr.length;

        const backendLiked =
          typeof updated.likedByUser === "boolean"
            ? updated.likedByUser
            : currentUserId
            ? backendLikesArr.some(
                (id: any) => String(id) === String(currentUserId)
              )
            : optimistic;

        setLiked(backendLiked);
        setLikesCount(backendCount);
        syncUserProfile?.();
      }
    } catch (e: any) {
      const isNetwork = !!e?.isAxiosError && !e?.response;

      if (!isNetwork) {
        setLiked((prev) => !prev);
        setLikesCount((n) => (optimistic ? Math.max(n - 1, 0) : n + 1));
      }
    }
  }, [liked, postId, isNews, currentUserId, syncUserProfile]);

  const handleDelete = useCallback(() => {
    if (!postId) return;

    Alert.alert(
      "Eliminar publicación",
      "¿Seguro que quieres eliminar esta publicación?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await deletePost(postId);
              if (res?.success) {
                Alert.alert("Eliminada", "La publicación fue eliminada.");
                onDeleted?.(postId);
                await syncUserProfile?.();
              } else {
                Alert.alert("Error", res?.error || "No se pudo eliminar.");
              }
            } catch (err) {
              console.log("No se pudo eliminar la publicación:", err);
              Alert.alert("Error", "No se pudo eliminar la publicación.");
            }
          },
        },
      ]
    );
  }, [postId, onDeleted, syncUserProfile]);

  const buildShareUrl = useCallback(() => {
    if (!postId) return null;
    const base = (api?.defaults?.baseURL || "").replace(/\/$/, "");
    const path = isNews ? "/news/" : "/post/";
    return `${base}${path}${postId}`;
  }, [postId, isNews]);

  const copyLink = useCallback(async () => {
    if (!postId) return;
    const url = buildShareUrl();
    if (!url) return;
    const ok = await copyToClipboard(url);
    Alert.alert(ok ? "🔗 Enlace copiado" : "No se pudo copiar", url);
  }, [postId, buildShareUrl]);

  const openRepostModal = useCallback(() => {
    setRepostComment("");
    setRepostPreviewGenerated(null);
    setShowRepostModal(true);
  }, []);

  const handleConfirmRepost = useCallback(async () => {
    if (!postId || reposting) return;

    const note = repostComment.trim();
    const url = buildShareUrl();

    // 🌟 Optimista: marcamos como repost antes de llamar a la API
    setReposted(true);
    setRepostsCount((prev) => prev + 1);

    try {
      setReposting(true);

      const res: any = await repostPost(
        postId,
        note || undefined,
        url || undefined
      );

      const updatedRootRaw =
        res?.data?.originalPost ||
        res?.data?.post ||
        res?.data?.targetPost ||
        res?.originalPost ||
        res?.post ||
        res?.targetPost ||
        res?.data ||
        res;

      const updatedRoot = getRootPostForReposts(updatedRootRaw);

      const backendReposts = extractRepostsCount(updatedRoot);

      // 🔒 Nunca bajar el contador local; si backend trae más, usamos ese
      setRepostsCount((prev) => {
        const safePrev = typeof prev === "number" ? prev : 0;
        if (typeof backendReposts === "number") {
          return backendReposts > safePrev ? backendReposts : safePrev;
        }
        return safePrev;
      });

      setShowRepostModal(false);
      Alert.alert("Repost creado", "Se ha publicado tu repost.");
    } catch {
      // ❌ Si falla, revertimos el optimista
      setReposted(false);
      setRepostsCount((prev) => Math.max(prev - 1, 0));

      Alert.alert(
        "No se pudo repostear",
        "Inténtalo de nuevo en un momento."
      );
    } finally {
      setReposting(false);
    }
  }, [buildShareUrl, postId, repostComment, reposting]);

  const openMenu = useCallback(() => {
    const options = isOwner
      ? ["Eliminar publicación", "Copiar enlace", "Cancelar"]
      : ["Ver perfil", "Copiar enlace", "Reportar", "Cancelar"];

    const cancelButtonIndex = options.length - 1;

    const handleAction = (i: number) => {
      if (isOwner) {
        if (i === 0) return handleDelete();
        if (i === 1) return copyLink();
      } else {
        if (i === 0 && authorId && !isNews) {
          if (
            user &&
            String(user._id || user.id) === String(authorId)
          ) {
            router.push("/(tabs)/profile");
          } else {
            router.push(`/profile/${authorId}`);
          }
        }
        if (i === 1) return copyLink();
        if (i === 2)
          return Alert.alert("🚨 Reporte enviado", "Gracias por tu ayuda.");
      }
    };

    if (Platform.OS === "ios") {
      return ActionSheetIOS.showActionSheetWithOptions(
        { options, cancelButtonIndex },
        handleAction
      );
    }

    const alertButtons: AlertButton[] = options.map((opt, index) => ({
      text: opt,
      style: index === cancelButtonIndex ? "cancel" : "default",
      onPress: () => handleAction(index),
    }));

    Alert.alert("Opciones del post", "", alertButtons);
  }, [isOwner, copyLink, handleDelete, authorId, isNews, user, router]);

  const renderContent = () => {
    if (isNews) {
      const title = (item?.title || "").trim();
      const description = (item?.description || "").trim();
      let summary = title && description ? `${title} — ${description}` : title;
      if (!summary) return null;

      const MAX = 260;
      const isLong = summary.length > MAX;
      const displayed =
        expanded || !isLong ? summary : summary.slice(0, MAX) + "...";

      return (
        <View style={[styles.contentWrapper, { marginBottom: 8 }]}>
          <Text style={[styles.content, styles.newsContent]}>
            {displayed}
          </Text>
          {isLong && (
            <TouchableOpacity onPress={() => setExpanded(!expanded)}>
              <Text style={styles.readMore}>
                {expanded ? "Leer menos ▲" : "Leer más ▼"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }

    const content = cachedItem?.content?.trim() || "";
    if (!content) return null;

    const MAX = 400;
    if (content.length <= MAX) {
      return (
        <View style={styles.contentWrapper}>
          <Text style={styles.content}>{content}</Text>
        </View>
      );
    }

    const shortText = content.slice(0, MAX) + "...";

    return (
      <View style={[styles.contentWrapper, { marginBottom: 8 }]}>
        <View style={{ position: "relative" }}>
          <Text
            style={styles.content}
            numberOfLines={expanded ? undefined : 7}
            ellipsizeMode="tail"
          >
            {expanded ? content : shortText}
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
  // 📊 Registrar view de VIDEO en backend + actualizar contador
  // ======================================================
  const handleVideoView = useCallback(
    (reason: VideoViewReason) => {
      if (!postId || isNews || !isVideoPost) return;

      if (hasRegisteredViewRef.current) return;
      hasRegisteredViewRef.current = true;

      setTimeout(() => {
        setViewsCount((prev) => {
          const safePrev = typeof prev === "number" ? prev : 0;
          const next = safePrev + 1;

          emitFeedUpdate({
            type: "videoViews",
            postId: String(postId),
            viewsCount: next,
          });

          return next;
        });

        (async () => {
          const endpoints = [
            `/posts/${postId}/views`,
            `/posts/${postId}/view`,
          ];

          for (const url of endpoints) {
            try {
              const res = await api.post(url, { reason });
              const updated = res?.data?.data || res?.data;

              const backendViews = extractViewsCount(updated);

              if (typeof backendViews === "number") {
                setViewsCount((prev) => {
                  const safePrev = typeof prev === "number" ? prev : 0;
                  const final =
                    backendViews > safePrev ? backendViews : safePrev;

                  if (final > safePrev) {
                    emitFeedUpdate({
                      type: "videoViews",
                      postId: String(postId),
                      viewsCount: final,
                    });
                  }

                  return final;
                });
              }

              break;
            } catch (e: any) {
              const status = e?.response?.status;
              if (status === 404 || status === 405) {
                continue;
              }
              if (__DEV__) {
                console.log(
                  "[FeedItemEnhanced] error registrando view de video:",
                  e
                );
              }
              break;
            }
          }
        })();
      }, 0);
    },
    [postId, isNews, isVideoPost]
  );

  // ======================================================
  // 🎥 Media (imágenes, videos, YouTube)
  // ======================================================
  const renderMedia = () => {
    const isPostMedia = !isNews;
    const imageResizeMode = "cover";

    const addBuster = (url: string | null | undefined) => {
      if (!url) return null;
      const sep = url.includes("?") ? "&" : "?";
      return `${url}${sep}r=${mediaRetry}`;
    };

    // manifest relativo; QuickPlayVideo se encarga de añadir dominio
    const manifestUrl =
      isPostMedia && postId ? `/posts/${postId}/video-manifest` : undefined;

    // ===========================
    // 📌 Galería de imágenes (posts de usuarios)
    // ===========================
    if (
      isPostMedia &&
      gallery.length > 1 &&
      gallery.every((m: any) => m.type === "image")
    ) {
      return (
        <View style={{ position: "relative" }}>
          <ScrollView
            horizontal
            pagingEnabled
            snapToInterval={CAROUSEL_ITEM_WIDTH + CAROUSEL_GAP}
            snapToAlignment="center"
            decelerationRate="fast"
            showsHorizontalScrollIndicator={false}
            style={styles.carousel}
            contentContainerStyle={styles.carouselContent}
            onScroll={(e) => {
              const x = e.nativeEvent.contentOffset.x;
              const w = CAROUSEL_ITEM_WIDTH + CAROUSEL_GAP;
              const i = Math.round(x / w);
              if (i !== galleryIndex) setGalleryIndex(i);
            }}
            scrollEventThrottle={16}
          >
            {gallery.map((m: any, i: number) => {
              const uri = addBuster(m.thumb || m.url);
              const orientation =
                (m.orientation as ImageOrientation | undefined) || "unknown";

              const aspectRatio =
                typeof m.aspectRatio === "number" && m.aspectRatio > 0
                  ? m.aspectRatio
                  : m.width && m.height && m.width > 0 && m.height > 0
                  ? m.width / m.height
                  : 1;

              const maxWidth = SCREEN_WIDTH - 44;
              const verticalWidth = SCREEN_WIDTH * 0.7;
              const width =
                orientation === "vertical" ? verticalWidth : maxWidth;
              const height = width / aspectRatio;

              const imageStyles = [
                styles.imageAdaptive,
                styles.carouselMedia,
                {
                  width,
                  height,
                } as any,
              ];

              return (
                <View
                  key={`${postId}-gallery-${i}`}
                  style={[
                    styles.carouselItem,
                    i === gallery.length - 1 && { marginRight: 0 },
                  ]}
                >
                  <TouchableOpacity
                    onPress={openPostOrNews}
                    style={[
                      styles.carouselImageWrapper,
                      styles.mediaDepth,
                      { width, height } as any,
                    ]}
                  >
                    <Image
                      source={{ uri: uri || undefined }}
                      style={imageStyles}
                      resizeMode={imageResizeMode}
                      onError={() => {
                        setMediaRetry((prev) =>
                          prev < 3 ? prev + 1 : prev
                        );
                        onMediaError?.(cachedItem || item);
                      }}
                    />
                    {i === galleryIndex && (
                      <>
                        <View style={[styles.viewerCounter, styles.viewerCounterInset]}>
                          <Text style={styles.viewerCounterText}>
                            {galleryIndex + 1}/{gallery.length}
                          </Text>
                        </View>

                        {showDots && (
                          <View
                            style={[
                              styles.dotsContainer,
                              styles.dotsContainerInset,
                            ]}
                          >
                            {gallery.map((_: any, idx: number) => (
                              <View
                                key={`dot-${postId}-${idx}`}
                                style={[
                                  styles.dot,
                                  idx === galleryIndex && styles.dotActive,
                                ]}
                              />
                            ))}
                          </View>
                        )}
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              );
            })}
          </ScrollView>
        </View>
      );
    }

    // ===========================
    // 🖼 Imagen simple
    // ===========================
    if (media.type === "image") {
      const fallbackRaw =
        item?.image ||
        item?.imageUrl ||
        item?.thumbnail ||
        item?.thumbUrl ||
        item?.previewUrl ||
        item?.mediaUrl;

      const raw = media.thumb || media.url || resolveImage(fallbackRaw);
      if (!raw) return null;

      const imageUri = addBuster(raw);
      const orientation = mainImageOrientation;

      const aspectRatio =
        typeof mainAspectRatio === "number" && mainAspectRatio > 0
          ? mainAspectRatio
          : typeof mediaAspectRatio === "number" && mediaAspectRatio > 0
          ? mediaAspectRatio
          : 1;

      const maxWidth = SCREEN_WIDTH - 44;
      const verticalWidth = SCREEN_WIDTH * 0.7;
      const width =
        orientation === "vertical" ? verticalWidth : maxWidth;

      const imageStyle = [
        styles.imageAdaptive,
        {
          width: "100%",
          height: undefined,
          aspectRatio,
        } as any,
      ];

      return (
        <TouchableOpacity
          onPress={openPostOrNews}
          style={[styles.singleImageWrapper, styles.mediaDepth, { width } as any]}
        >
          <Image
            source={{ uri: imageUri || undefined }}
            style={imageStyle}
            resizeMode={imageResizeMode}
            onError={() => {
              setMediaRetry((prev) => (prev < 3 ? prev + 1 : prev));
              onMediaError?.(cachedItem || item);
            }}
          />
        </TouchableOpacity>
      );
    }

    // ===========================
    // 🎬 VIDEO (archivo subido)
    // ===========================
    if (media.type === "video" && media.url) {
      let effectiveThumb: string | null = media.thumb || videoThumb || null;

      if (!effectiveThumb) {
        const derived = deriveVideoThumbFromUrl(media.url);
        if (derived) {
          effectiveThumb = derived;
        }
      }

      const qualityLabel: string | undefined =
        (media.quality &&
          String(media.quality).trim().toUpperCase()) ||
        guessQualityFromUrl(media.url) ||
        undefined;

      const baseDuration: number | null =
        typeof media.duration === "number"
          ? media.duration
          : typeof item?.duration === "number"
          ? item.duration
          : typeof item?.videoDuration === "number"
          ? item.videoDuration
          : null;

      const durationLabel =
        baseDuration !== null ? formatDuration(baseDuration) : null;

      const remainingLabel = durationLabel ? `-${durationLabel}` : null;

      const badgeText =
        qualityLabel && remainingLabel
          ? `${qualityLabel} · ${remainingLabel}`
          : remainingLabel || qualityLabel || null;

      // PREVIEW → miniatura con overlay y badge
      if (!isVisible) {
        if (!effectiveThumb) {
          return (
            <TouchableOpacity onPress={openPostOrNews}>
              <View style={[styles.mediaBox, { justifyContent: "center" }]}>
                <View
                  style={[
                    StyleSheet.absoluteFillObject,
                    { backgroundColor: "#000" },
                  ]}
                />
                <View style={styles.videoOverlay}>
                  <Play size={40} color="#fff" />
                </View>

                {badgeText && (
                  <View style={styles.durationBadge}>
                    <Text style={styles.durationText}>{badgeText}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          );
        }

        const thumbUri = addBuster(effectiveThumb);
        return (
          <TouchableOpacity onPress={openPostOrNews}>
            <View style={[styles.mediaBox, { justifyContent: "center" }]}>
              <Image
                source={{ uri: thumbUri || undefined }}
                style={[styles.mediaBox, StyleSheet.absoluteFillObject]}
                resizeMode="cover"
                onError={() => {
                  setMediaRetry((prev) => (prev < 3 ? prev + 1 : prev));
                  onMediaError?.(cachedItem || item);
                }}
              />
              <View style={styles.videoOverlay}>
                <Play size={40} color="#fff" />
              </View>

              {badgeText && (
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>{badgeText}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      }

      // VISIBLE → QuickPlayVideo
      return (
        <View style={{ marginVertical: 10 }}>
          <QuickPlayVideo
            uri={media.url}
            thumbnail={effectiveThumb || undefined}
            autoPlay={!!isVisible}
            isVisible={!!isVisible}
            loop
            style={styles.mediaBox}
            qualityLabel={qualityLabel}
            manifestUrl={manifestUrl}
            onView={handleVideoView}
          />
        </View>
      );
    }

    // ===========================
    // 🎥 YOUTUBE
    // ===========================
    if (media.type === "youtube" && media.videoId) {
      const ytThumb =
        media.thumb ||
        `https://img.youtube.com/vi/${media.videoId}/hqdefault.jpg`;

      if (!isVisible) {
        return (
          <TouchableOpacity onPress={openPostOrNews}>
            <Image
              source={{ uri: ytThumb }}
              style={styles.mediaBox}
              resizeMode="cover"
              onError={() => onMediaError?.(cachedItem || item)}
            />
          </TouchableOpacity>
        );
      }

      return (
        <View style={styles.mediaBox}>
          {/* YoutubePlayer opcional */}
        </View>
      );
    }

    return null;
  };

  // ======================================================
  // 🧱 Render principal
  // ======================================================
  return (
    <View style={styles.post}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() => {
            if (isNews) return openPostOrNews();
            if (!authorId) return;

            if (user && String(user._id || user.id) === String(authorId)) {
              router.push("/(tabs)/profile");
            } else {
              router.push(`/profile/${authorId}`);
            }
          }}
        >
          {!isNews && (
            <Image
              source={avatarSource}
              style={styles.avatar}
              onError={() => setAvatarError(true)}
            />
          )}

          <View>
            <Text style={styles.username}>{username}</Text>

            {isNews ? (
              absolutePublishedAtStr ? (
                <Text style={styles.timeText}>{absolutePublishedAtStr}</Text>
              ) : null
            ) : relativeTime ? (
              <Text style={styles.timeText}>{relativeTime}</Text>
            ) : null}
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={openMenu}>
          <MoreHorizontal size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {renderContent()}
      {renderMedia()}

      <RepostModal
        visible={showRepostModal}
        onClose={() => setShowRepostModal(false)}
        onConfirm={handleConfirmRepost}
        previewUri={effectiveRepostPreview || null}
        comment={repostComment}
        onChangeComment={setRepostComment}
        loading={reposting}
      />

      {/* Acciones */}
      <View style={styles.actions}>
        {/* Likes */}
        <TouchableOpacity onPress={handleLike} style={styles.likeWrapper}>
          <Heart
            size={24}
            color={liked ? "#000" : "#666"}
            fill={liked ? "#000" : "transparent"}
          />
          {likesCount > 0 && (
            <Text style={styles.likeCount}>{likesCount}</Text>
          )}
        </TouchableOpacity>

        {/* Views 👁 SOLO para VIDEO (no imágenes) */}
        {!isNews && isVideoPost && (
          <View style={styles.viewsWrapper}>
            <Eye size={22} color="#555" />
            {viewsCount > 0 && (
              <Text style={styles.viewsCount}>{viewsCount}</Text>
            )}
          </View>
        )}

        {/* Comentarios */}
        {!isNews && (
          <TouchableOpacity
            onPress={() =>
              postId && router.push(`/post/${postId}?focus=comments`)
            }
          >
            <View style={styles.commentBadgeContainer}>
              <MessageCircle size={24} color="#555" />
              {commentsCount > 0 && (
                <View style={styles.commentBadge}>
                  <Text style={styles.commentBadgeText}>
                    {commentsCount}
                  </Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        )}

        {/* Repost (flechas ↑↓) */}
        <TouchableOpacity
          onPress={openRepostModal}
          style={styles.repostWrapper}
        >
          <ArrowUpDown size={23} color={reposted ? "#000" : "#555"} />
          {repostsCount > 0 && (
            <Text style={styles.repostCount}>{repostsCount}</Text>
          )}
        </TouchableOpacity>

        {/* Eliminar (solo dueño) */}
        {isOwner && !isNews && (
          <TouchableOpacity
            onPress={handleDelete}
            style={{ marginLeft: "auto" }}
          >
            <Trash2 size={20} color="#d00" />
          </TouchableOpacity>
        )}
      </View>

      {/* Modal noticia completa — SIN CAMBIOS de lógica */}
      {isNews && (
        <Modal
          visible={showNewsModal}
          animationType="slide"
          transparent
          onRequestClose={() => setShowNewsModal(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <ScrollView
                contentContainerStyle={styles.modalScrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.modalTitle}>
                  {item?.title || "Noticia"}
                </Text>

                {!!absolutePublishedAtStr && (
                  <Text style={styles.modalMeta}>
                    {newsSourceName ? `${newsSourceName} • ` : ""}
                    {absolutePublishedAtStr}
                  </Text>
                )}

                {media.type === "image" && media.url && (
                  <Image
                    source={{ uri: media.url }}
                    style={styles.modalImage}
                    resizeMode="cover"
                    onError={() => onMediaError?.(cachedItem || item)}
                  />
                )}

                {!!item?.description && (
                  <Text style={styles.modalBody}>
                    {item.description}
                  </Text>
                )}

                {!!item?.url && (
                  <TouchableOpacity
                    style={styles.modalLinkButton}
                    onPress={() =>
                      Linking.openURL(item.url).catch((e) =>
                        console.warn("No se pudo abrir la noticia:", e)
                      )
                    }
                  >
                    <Text style={styles.modalLinkText}>
                      Ver noticia completa
                    </Text>
                  </TouchableOpacity>
                )}
              </ScrollView>

              <TouchableOpacity
                onPress={() => setShowNewsModal(false)}
                style={styles.modalCloseButton}
              >
                <Text style={styles.modalCloseText}>Cerrar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

export default memo(FeedItemEnhanced);

// ======================================================
// 🪄 Modal Repost
// ======================================================
function RepostModal({
  visible,
  onClose,
  onConfirm,
  previewUri,
  comment,
  onChangeComment,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  previewUri: string | null;
  comment: string;
  onChangeComment: (text: string) => void;
  loading?: boolean;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.repostBackdrop}>
        <View style={styles.repostCard}>
          <Text style={styles.repostTitle}>Repostear</Text>

          <TextInput
            placeholder="Agrega un comentario opcional"
            placeholderTextColor="#999"
            multiline
            value={comment}
            onChangeText={onChangeComment}
            style={styles.repostInput}
          />

          {previewUri ? (
            <Image
              source={{ uri: previewUri }}
              style={styles.repostPreview}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.repostPreview, styles.repostPreviewFallback]}>
              <Text style={{ color: "#666" }}>Sin vista previa</Text>
            </View>
          )}

          <View style={styles.repostActionsRow}>
            <TouchableOpacity
              onPress={onClose}
              style={[styles.repostButton, styles.repostButtonGhost]}
              disabled={loading}
            >
              <Text style={styles.repostButtonGhostText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              disabled={loading}
              style={[
                styles.repostButton,
                styles.repostButtonPrimary,
                loading && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.repostButtonPrimaryText}>
                {loading ? "Reposteando..." : "Repostear"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ======================================================
// 💅 Estilos
// ======================================================
const SCREEN_WIDTH = Dimensions.get("window").width;
const CAROUSEL_HORIZONTAL_PADDING = 1;
const CAROUSEL_GAP = 8;
const CAROUSEL_ITEM_WIDTH = SCREEN_WIDTH;
const MEDIA_BORDER_RADIUS = 18;

const styles = StyleSheet.create({
  post: {
    paddingHorizontal: 0,
    paddingTop: 8,
    marginTop: 22,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e6e6e6",
    paddingBottom: 14,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 2,
    paddingHorizontal: 8,
  },

  userInfo: { flexDirection: "row", alignItems: "center", gap: 5 },

  avatar: {
    width: 52,
    height: 52,
    borderRadius: 11,
    backgroundColor: "#ddd",
  },

  username: { fontSize: 15, fontWeight: "700", color: "#111" },
  timeText: { fontSize: 13, color: "#777", marginTop: 1 },

  content: { fontSize: 16, color: "#111", lineHeight: 21 },
  contentWrapper: {
    paddingHorizontal: 30,
    marginBottom: 6,
  },

  newsContent: { fontSize: 15, fontWeight: "500" },

  fadeGradient: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 50,
  },

  readMore: {
    color: "#007bff",
    fontWeight: "600",
    fontSize: 15,
    marginTop: 14,
  },

  carousel: { marginTop: 1, marginBottom: 1 },
  carouselContent: {
    paddingHorizontal: CAROUSEL_HORIZONTAL_PADDING,
    alignItems: "center",
  },

  carouselItem: {
    width: CAROUSEL_ITEM_WIDTH,
    marginRight: CAROUSEL_GAP,
    alignItems: "center",
  },

  carouselImageWrapper: {
    borderRadius: MEDIA_BORDER_RADIUS,
    alignSelf: "center",
    position: "relative",
  },

  singleImageWrapper: {
    alignSelf: "center",
    borderRadius: MEDIA_BORDER_RADIUS,
  },

  carouselMedia: {
    marginTop: 0,
    marginBottom: 0,
  },

  mediaDepth: {
    backgroundColor: "#f7f8fb",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },

  // Caja fija para VÍDEOS
  mediaBox: {
    width: SCREEN_WIDTH - 44,
    alignSelf: "center",
    height: 340,
    borderRadius: MEDIA_BORDER_RADIUS,
    backgroundColor: "#000",
    marginTop: 0,
    marginBottom: 0,
  },

  // Caja adaptable para IMÁGENES (usa aspectRatio dinámico)
  imageAdaptive: {
    alignSelf: "center",
    borderRadius: MEDIA_BORDER_RADIUS,
    marginTop: 0,
    marginBottom: 0,
  },

  // Los siguientes estilos se mantienen para compat / noticias, etc.
  imageHorizontal: {
    width: SCREEN_WIDTH - 26,
    height: 260,
  },

  imageVertical: {
    width: SCREEN_WIDTH * 0.7,
    height: 380,
  },

  imageSquare: {
    width: SCREEN_WIDTH - 26,
    height: SCREEN_WIDTH - 26,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 22,
    marginTop: 12,
    paddingHorizontal: 12,
  },

  likeWrapper: { flexDirection: "row", alignItems: "center", gap: 6 },
  likeCount: { fontSize: 15, fontWeight: "600" },

  repostWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  repostCount: { fontSize: 15, fontWeight: "600" },

  viewsWrapper: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewsCount: {
    fontSize: 14,
    fontWeight: "500",
    color: "#555",
  },

  commentBadgeContainer: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },

  commentBadge: {
    position: "absolute",
    right: -10,
    top: -5,
    backgroundColor: "#ff2e63",
    borderRadius: 12,
    paddingHorizontal: 5,
    paddingVertical: 1,
    minWidth: 18,
    justifyContent: "center",
    alignItems: "center",
  },

  commentBadgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },

  modalCard: {
    width: "100%",
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },

  modalScrollContent: { paddingBottom: 16 },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },

  modalMeta: {
    fontSize: 12,
    color: "#666",
    marginBottom: 10,
  },

  modalImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    marginBottom: 12,
  },

  modalBody: { fontSize: 15, color: "#333", lineHeight: 21, marginBottom: 12 },

  modalLinkButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#007bff",
    marginBottom: 8,
  },

  modalLinkText: { color: "#fff", fontWeight: "600", fontSize: 14 },

  modalCloseButton: {
    alignSelf: "center",
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },

  modalCloseText: { fontSize: 15, fontWeight: "600", color: "#007bff" },

  viewerCounter: {
    position: "absolute",
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 14,
  },

  viewerCounterInset: {
    right: 12,
    top: 12,
  },

  viewerCounterText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },

  dotsContainer: {
    position: "absolute",
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 12,
  },

  dotsContainerInset: {
    alignSelf: "center",
    bottom: 12,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.6)",
  },

  dotActive: {
    width: 16,
    height: 6,
    backgroundColor: "#fff",
    borderRadius: 3,
  },

  // Repost modal
  repostBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  repostCard: {
    width: "100%",
    maxWidth: 520,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  repostTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },
  repostInput: {
    minHeight: 70,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    textAlignVertical: "top",
    fontSize: 15,
    color: "#111",
  },
  repostPreview: {
    width: "100%",
    height: 220,
    borderRadius: 14,
    backgroundColor: "#f2f2f2",
  },
  repostPreviewFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  repostActionsRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  repostButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  repostButtonGhost: {
    backgroundColor: "transparent",
  },
  repostButtonGhostText: {
    color: "#444",
    fontWeight: "600",
    fontSize: 15,
  },
  repostButtonPrimary: {
    backgroundColor: "#111",
  },
  repostButtonPrimaryText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },

  videoOverlay: {
    position: "absolute",
    alignSelf: "center",
    top: "40%",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 12,
    borderRadius: 50,
  },

  durationBadge: {
    position: "absolute",
    right: 8,
    bottom: 8,
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
});
