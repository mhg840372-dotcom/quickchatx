// ======================================================
// 📌 components/comments/CommentsSection.tsx — v26.0
// - Avatar unificado con Feed (API_URL centralizada)
// - Mini-post embebido: avatar + media original (img/video)
// - Comentarios y respuestas pueden adjuntar multimedia (📎)
// - Comentarios con media se refrescan desde backend tras enviar
// - targetType también se envía en el payload JSON (no solo multipart)
// - DEDUPE de media embebida vs media del comentario (no más imágenes duplicadas)
// - DEDUPE de comentarios raíz por id (por si el backend repite)
// - NUEVO: onCommentSent(comment, meta) → { type, totalCount, delta }
//   * "sync": al cargar desde backend
//   * "add": al añadir comentario/respuesta
//   * "delete": al eliminar
//   * totalCount = total de comentarios (incluye replies)
// ======================================================

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  api,
  API_URL,
  getComments,
  deleteComment,
  toggleCommentLike,
} from "@/services/api";
import { useRouter } from "expo-router";
import { useUser } from "@/contexts/AuthContext";
import { subscribeToUserProfileUpdates } from "../../utils/feedEvents";

// ======================================================
// 🌐 Base URL imágenes/media (mismo host que FeedItem)
// ======================================================
const RAW_BASE =
  (api?.defaults?.baseURL as string | undefined) ||
  API_URL ||
  "https://api.quickchatx.com/api";

const TRIMMED_API_BASE_URL = RAW_BASE.replace(/\/+$/, "");
const IMAGE_BASE_URL = TRIMMED_API_BASE_URL.replace(/\/api$/i, "");

// Normaliza URLs relativas a absolutas (avatars/media)
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

// Avatares = mismas reglas que imágenes
const resolveAvatar = (url?: string | null): string | null => {
  return resolveImage(url);
};

const formatDateTime = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString();
};

// ======================================================
// 🔑 Normalización canónica de media (para DEDUPE)
// ======================================================
const normalizeMediaPath = (url?: string | null): string | null => {
  if (!url) return null;
  try {
    let u = url.trim();
    const noQuery = u.split("?")[0];
    const noHost = noQuery.replace(/^https?:\/\/[^/]+/i, "");
    const noApi = noHost.replace(/^\/api(\/|$)/i, "/");
    return noApi;
  } catch {
    return url;
  }
};

// Mini estructura para el "post" embebido dentro del comentario
type EmbeddedPost = {
  id: string;
  author: string;
  text: string;
  mediaUrl?: string | null;
  thumbUrl?: string | null;
  mediaType?: "image" | "video" | null;
  avatarUrl?: string | null;
};

type UIComment = {
  id: string;
  author: string;
  text: string;
  likes: number;
  likedByUser: boolean;
  authorId?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
  parentId?: string | null;
  replies?: UIComment[];
  repliesCount?: number;
  embeddedPost?: EmbeddedPost | null;
  mediaUrl?: string | null;
};

// Media seleccionada desde el dispositivo
type SelectedMedia = {
  uri: string;
  type: "image" | "video";
  mimeType?: string;
  fileName?: string;
};

type CommentMeta = {
  type?: "add" | "delete" | "sync";
  totalCount?: number;
  delta?: number;
};

type CommentsSectionProps = {
  targetId: string;
  targetType?: "post" | "news" | "youtube";
  onCommentSent?: (comment?: any, meta?: CommentMeta) => void;
  externalNewComment?: { data: any; ts: number } | null;
  ListHeaderComponent?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
};

// ======================================================
// 🧠 Cache global de avatares (por userId)
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

// Avatar del usuario autenticado
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
// 📦 Extraer media del "post" embebido (original / target)
// ======================================================
const extractEmbeddedMedia = (rawEmbedded: any): {
  mediaUrl: string | null;
  thumbUrl: string | null;
  mediaType: "image" | "video" | null;
} => {
  if (!rawEmbedded) {
    return { mediaUrl: null, thumbUrl: null, mediaType: null };
  }

  const candidate =
    rawEmbedded.originalPost || rawEmbedded.targetPost || rawEmbedded;

  const firstMedia = Array.isArray(candidate.media)
    ? candidate.media[0]
    : null;

  const mediaTypeFromMeta: "image" | "video" | null = firstMedia
    ? (() => {
        const t = String(firstMedia.type || "").toLowerCase();
        const mime = String(
          firstMedia.mime || firstMedia.mimetype || ""
        ).toLowerCase();
        if (t === "video" || mime.startsWith("video")) return "video";
        if (t === "image" || mime.startsWith("image")) return "image";
        return null;
      })()
    : null;

  const mediaUrl =
    resolveImage(
      firstMedia?.url ||
        firstMedia?.path ||
        firstMedia?.secure_url ||
        candidate.image ||
        candidate.imageUrl ||
        candidate.videoUrl ||
        candidate.thumbnail
    ) || null;

  const thumbUrl =
    resolveImage(
      firstMedia?.thumbUrl ||
        firstMedia?.thumbnailUrl ||
        candidate.thumbUrl ||
        candidate.thumbnail
    ) || mediaUrl;

  let mediaType: "image" | "video" | null = mediaTypeFromMeta;

  if (!mediaType && mediaUrl) {
    const lower = mediaUrl.toLowerCase();
    if (lower.endsWith(".mp4") || lower.includes("/video/")) {
      mediaType = "video";
    } else {
      mediaType = "image";
    }
  }

  return { mediaUrl, thumbUrl, mediaType };
};

// 🔢 Cuenta total de comentarios (incluyendo replies)
const countCommentsTree = (list: UIComment[]): number =>
  list.reduce(
    (acc, c) => acc + 1 + (c.replies ? countCommentsTree(c.replies) : 0),
    0
  );

export default function CommentsSection({
  targetId,
  targetType = "post",
  onCommentSent,
  externalNewComment,
  ListHeaderComponent,
  refreshing = false,
  onRefresh,
}: CommentsSectionProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [comments, setComments] = useState<UIComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; user: string } | null>(
    null
  );
  const [replyContext, setReplyContext] = useState<UIComment | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<SelectedMedia | null>(
    null
  );
  const router = useRouter();
  const { user: currentUser } = useUser();

  const inputRef = useRef<TextInput>(null);
  const listRef = useRef<FlatList<UIComment>>(null);
  const cacheKey = `comments_${targetId}`;

  // 👉 IDs de comentarios que tienen sus respuestas desplegadas
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleRepliesVisibility = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const findCommentById = useCallback(
    (id: string, list: UIComment[]): UIComment | null => {
      for (const c of list) {
        if (c.id === id) return c;
        const found = findCommentById(id, (c.replies as UIComment[]) || []);
        if (found) return found;
      }
      return null;
    },
    []
  );

  useEffect(() => {
    if (replyTo?.id) {
      const ctx = findCommentById(replyTo.id, comments);
      setReplyContext(ctx || null);
    } else {
      setReplyContext(null);
    }
  }, [replyTo, comments, findCommentById]);

  // 🔔 Escuchar updates de perfil para refrescar avatar en comentarios/replies
  useEffect(() => {
    const unsub = subscribeToUserProfileUpdates((payload) => {
      setComments((prev) => {
        const patch = (arr: UIComment[]): UIComment[] =>
          arr.map((c) => {
            const isTarget =
              (c.authorId &&
                String(c.authorId) === String(payload.userId)) ||
              (!c.authorId &&
                c.author &&
                payload.username &&
                c.author.toLowerCase() ===
                  payload.username.toLowerCase());

            const rawAvatar = payload.safeAvatar || payload.avatarUrl;
            const resolved = resolveAvatar(rawAvatar);

            const next: UIComment = {
              ...c,
              avatarUrl: isTarget && resolved ? resolved : c.avatarUrl,
              author:
                isTarget && payload.username ? payload.username : c.author,
              replies: patch(c.replies || []),
            };

            if (isTarget && resolved) {
              setAvatarInCache(payload.userId, resolved);
            }

            return next;
          });
        return patch(prev);
      });
    });
    return unsub;
  }, []);

  // ======================================================
  // Normalizador
  // ======================================================
  const normalize = useCallback(
    (c: any): UIComment => {
      const fallbackId = `tmp-${Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`;

      const fallbackAuthor = "Usuario";
      const fallbackAvatar =
        resolveAvatar("/uploads/default-avatar.png") ||
        "https://api.quickchatx.com/uploads/default-avatar.png";
      const fallbackCreatedAt = new Date().toISOString();

      if (!c) {
        return {
          id: fallbackId,
          author: "Usuario",
          text: "",
          likes: 0,
          likedByUser: false,
          createdAt: fallbackCreatedAt,
          parentId: null,
          replies: [],
          repliesCount: 0,
          embeddedPost: null,
          mediaUrl: null,
        };
      }

      const rawAuthor =
        (typeof c.author === "object" && c.author) ||
        (typeof c.user === "object" && c.user) ||
        (typeof c.createdBy === "object" && c.createdBy) ||
        null;

      const rawEmbedded =
        c.embeddedPost || c.post || c.targetPost || c.sharedPost || null;

      const {
        mediaUrl: embeddedMediaUrl,
        thumbUrl,
        mediaType,
      } = extractEmbeddedMedia(rawEmbedded);

      const embeddedRawAuthor =
        (rawEmbedded &&
          typeof rawEmbedded.author === "object" &&
          rawEmbedded.author) ||
        rawEmbedded?.user ||
        rawEmbedded?.createdBy ||
        null;

      const embeddedAvatarCandidate =
        rawEmbedded?.safeAvatar ||
        rawEmbedded?.avatarUrl ||
        embeddedRawAuthor?.safeAvatar ||
        embeddedRawAuthor?.avatarUrl ||
        embeddedRawAuthor?.profilePhoto ||
        embeddedRawAuthor?.image ||
        embeddedRawAuthor?.photoUrl ||
        embeddedRawAuthor?.picture ||
        null;

      const embeddedAvatar = resolveAvatar(embeddedAvatarCandidate);

      const embeddedPost: EmbeddedPost | null = rawEmbedded
        ? {
            id: String(rawEmbedded.id || rawEmbedded._id || ""),
            author:
              rawEmbedded.author ||
              rawEmbedded.authorUsername ||
              rawEmbedded.username ||
              embeddedRawAuthor?.username ||
              embeddedRawAuthor?.name ||
              "Usuario",
            text:
              rawEmbedded.text ||
              rawEmbedded.content ||
              rawEmbedded.caption ||
              "",
            mediaUrl: embeddedMediaUrl,
            thumbUrl,
            mediaType,
            avatarUrl: embeddedAvatar,
          }
        : null;

      const replies: UIComment[] = Array.isArray(c.replies)
        ? c.replies.map((r: any) => normalize(r))
        : [];

      const repliesCount =
        typeof c.repliesCount === "number" ? c.repliesCount : replies.length;

      const author =
        c.authorUsername ||
        c.username ||
        (typeof c.author === "string" ? c.author : null) ||
        rawAuthor?.username ||
        rawAuthor?.name ||
        c.authorName ||
        fallbackAuthor;

      const authorId =
        c.userId ||
        c.authorId ||
        rawAuthor?.userId ||
        rawAuthor?._id ||
        rawAuthor?.id ||
        null;

      const createdAt =
        c.createdAt ||
        c.created_at ||
        c.updatedAt ||
        c.timestamp ||
        fallbackCreatedAt;

      const id =
        c.id ||
        c._id ||
        c.commentId ||
        c.commentID ||
        c.comment_id ||
        fallbackId;

      const baseAvatarSrc =
        c.safeAvatar ||
        c.avatarUrl ||
        c.authorAvatar ||
        c.authorImage ||
        rawAuthor?.safeAvatar ||
        rawAuthor?.avatarUrl ||
        rawAuthor?.avatar ||
        rawAuthor?.image ||
        null;

      const matchesCurrentUser =
        !!currentUser &&
        ((authorId &&
          String(currentUser._id || currentUser.id) === String(authorId)) ||
          (author &&
            currentUser.username &&
            author.toLowerCase() ===
              currentUser.username.toLowerCase()));

      const overrideAvatar = matchesCurrentUser
        ? getAuthUserAvatar(currentUser)
        : null;

      const fromCache = getAvatarFromCache(authorId);

      const fromItem = resolveAvatar(baseAvatarSrc);

      const { url: fromRelations } = resolveAvatarFromRelations(
        currentUser,
        authorId
      );

      const finalAvatar =
        overrideAvatar ||
        fromCache ||
        fromItem ||
        fromRelations ||
        fallbackAvatar;

      if (authorId && finalAvatar && finalAvatar !== fromCache) {
        setAvatarInCache(authorId, finalAvatar);
      }

      const rawMediaUrl =
        c.media?.[0]?.url ||
        c.media?.[0]?.path ||
        c.media?.[0]?.thumbnail ||
        c.media?.[0]?.preview ||
        c.media?.[0]?.secure_url ||
        c.mediaUrl ||
        c.media_path ||
        c.mediaPath ||
        c.thumbnail ||
        c.previewUrl ||
        null;

      let mediaUrl = resolveImage(rawMediaUrl);

      if (mediaUrl && embeddedMediaUrl) {
        const c1 = normalizeMediaPath(mediaUrl);
        const c2 = normalizeMediaPath(embeddedMediaUrl);
        if (c1 && c2 && c1 === c2) {
          mediaUrl = null;
        }
      }

      const parentId =
        c.parentId ||
        c.parent_id ||
        c.parentCommentId ||
        c.parent?.id ||
        c.parent?._id ||
        null;

      const likesCount =
        typeof c.likes === "number"
          ? c.likes
          : typeof c.likeCount === "number"
          ? c.likeCount
          : Array.isArray(c.likes)
          ? c.likes.length
          : 0;

      const likedByUser =
        typeof c.likedByUser === "boolean"
          ? c.likedByUser
          : typeof c.liked === "boolean"
          ? c.liked
          : false;

      return {
        id: String(id),
        author,
        authorId: authorId ? String(authorId) : null,
        text: c.text || c.content || "",
        avatarUrl: finalAvatar,
        createdAt,
        likes: likesCount,
        likedByUser,
        parentId: parentId ? String(parentId) : null,
        replies,
        repliesCount,
        embeddedPost,
        mediaUrl,
      };
    },
    [currentUser]
  );

  // ======================================================
  // Cargar con caché + fetch desde API (con DEDUPE por id)
// ======================================================
  const fetchComments = useCallback(async () => {
    try {
      setLoading(true);

      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) setComments(parsed);
      }

      const raw = await getComments(targetId as string);
      const listSource = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
        ? raw.data
        : [];

      const normalizedList: UIComment[] = listSource.map((c: any) =>
        normalize(c)
      );

      const seen = new Set<string>();
      const list: UIComment[] = [];
      for (const c of normalizedList) {
        if (!c.id) {
          list.push(c);
          continue;
        }
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        list.push(c);
      }

      setComments(list);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(list));

      setExpandedIds(new Set());

      const total = countCommentsTree(list);
      onCommentSent?.(undefined, { type: "sync", totalCount: total });
    } catch (err) {
      console.log("❌ Error cargando comentarios:", err);
    } finally {
      setLoading(false);
    }
  }, [cacheKey, normalize, targetId, onCommentSent]);

  useEffect(() => {
    if (targetId) fetchComments();
  }, [targetId, fetchComments]);

  // ======================================================
  // Inyección externa de un comentario recién creado
  // ======================================================
  useEffect(() => {
    if (!externalNewComment?.data) return;
    const normalized = normalize(externalNewComment.data);

    const existsInTree = (arr: UIComment[], targetId: string): boolean => {
      for (const c of arr) {
        if (c.id === targetId) return true;
        if (c.replies?.length && existsInTree(c.replies, targetId)) return true;
      }
      return false;
    };

    const insertReply = (arr: UIComment[]): UIComment[] =>
      arr.map((c) => {
        if (c.id === normalized.parentId) {
          const newReplies = [...(c.replies || []), normalized];
          return {
            ...c,
            replies: newReplies,
            repliesCount: newReplies.length,
          };
        }
        const nestedReplies = insertReply(c.replies || []);
        return {
          ...c,
          replies: nestedReplies,
          repliesCount:
            typeof c.repliesCount === "number"
              ? c.repliesCount
              : nestedReplies.length,
        };
      });

    setComments((prev) => {
      if (!normalized?.id) return prev;
      const exists = existsInTree(prev, normalized.id);
      if (exists) return prev;

      const updated = normalized.parentId
        ? insertReply(prev)
        : [...prev, normalized];
      AsyncStorage.setItem(cacheKey, JSON.stringify(updated));

      const total = countCommentsTree(updated);
      onCommentSent?.(normalized, { type: "sync", totalCount: total });

      if (normalized.parentId) {
        setExpandedIds((prevSet) => {
          const next = new Set(prevSet);
          next.add(String(normalized.parentId));
          return next;
        });
      }

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 50);

      return updated;
    });
  }, [
    externalNewComment?.ts,
    externalNewComment?.data,
    cacheKey,
    normalize,
    onCommentSent,
  ]);

  // ======================================================
  // Picker de media (imagen / GIF / video)
// ======================================================
  const handlePickMedia = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        console.log("⚠️ Permiso de galería denegado");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        quality: 0.9,
      });

      if (result.canceled) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      const type: "image" | "video" =
        asset.type === "video" ? "video" : "image";

      const fileName =
        asset.fileName ||
        (asset.uri ? asset.uri.split("/").pop() || "media" : "media");

      const mimeType =
        asset.mimeType ||
        (type === "video" ? "video/mp4" : "image/jpeg");

      const rawUri = String(asset.uri);
      const safeUri =
        rawUri.startsWith("file://") || rawUri.startsWith("content://")
          ? rawUri
          : `file://${rawUri}`;

      setSelectedMedia({
        uri: safeUri,
        type,
        fileName,
        mimeType,
      });
    } catch (err) {
      console.log("❌ Error seleccionando media:", err);
    }
  };

  const clearSelectedMedia = () => {
    setSelectedMedia(null);
  };

  // ======================================================
  // Enviar comentario / respuesta (texto + media opcional)
// ======================================================
  const handleSend = async () => {
    const hasText = !!newComment.trim();
    const hasMedia = !!selectedMedia;

    if (!hasText && !hasMedia) return;

    const parentId = replyTo?.id || null;
    const textToSend = newComment.trim();

    try {
      setSending(true);

      let createdRaw: any;

      if (selectedMedia) {
        const formData = new FormData();
        formData.append("targetId", String(targetId));
        formData.append("targetType", targetType);
        if (hasText) formData.append("content", textToSend);
        if (parentId) formData.append("parentId", String(parentId));

        formData.append(
          "media",
          {
            uri: selectedMedia.uri,
            name: selectedMedia.fileName || "comment-media",
            type:
              selectedMedia.mimeType ||
              (selectedMedia.type === "video"
                ? "video/mp4"
                : "image/jpeg"),
          } as any
        );

        const res = await api.post("/comments/add", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });
        createdRaw = res.data?.data ?? res.data;
      } else {
        const payload: any = {
          targetId,
          targetType,
          content: textToSend,
        };
        if (parentId) payload.parentId = parentId;

        const res = await api.post("/comments/add", payload);
        createdRaw = res.data?.data ?? res.data;
      }

      const fixed = normalize({
        ...createdRaw,
        createdAt: createdRaw?.createdAt || new Date().toISOString(),
      });

      if (!fixed.parentId && parentId) fixed.parentId = parentId;

      if (hasMedia) {
        setNewComment("");
        setReplyTo(null);
        setReplyContext(null);
        setSelectedMedia(null);

        await fetchComments();
        return;
      }

      let totalCountAfter = 0;

      const insertReply = (arr: UIComment[]): UIComment[] =>
        arr.map((c) => {
          if (c.id === fixed.parentId) {
            const newReplies = [...(c.replies || []), fixed];
            return {
              ...c,
              replies: newReplies,
              repliesCount: newReplies.length,
            };
          }
          const nestedReplies = insertReply(c.replies || []);
          return {
            ...c,
            replies: nestedReplies,
            repliesCount:
              typeof c.repliesCount === "number"
                ? c.repliesCount
                : nestedReplies.length,
          };
        });

      setComments((prev) => {
        const updated = fixed.parentId
          ? insertReply(prev)
          : [...prev, fixed];

        AsyncStorage.setItem(cacheKey, JSON.stringify(updated));

        totalCountAfter = countCommentsTree(updated);
        return updated;
      });

      setNewComment("");
      setReplyTo(null);
      setReplyContext(null);
      setSelectedMedia(null);

      onCommentSent?.(fixed, {
        type: "add",
        totalCount: totalCountAfter,
        delta: 1,
      });

      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 200);
    } catch (err) {
      console.log("❌ Error enviando comentario:", err);
    } finally {
      setSending(false);
    }
  };

  // ======================================================
  // Like / Delete
  // ======================================================
  const handleLike = async (id: string) => {
    try {
      const updatedRaw = await toggleCommentLike(id);
      const updated = normalize(updatedRaw?.data ?? updatedRaw);

      const updateRecursively = (arr: UIComment[]): UIComment[] =>
        arr.map((c) => {
          if (c.id === updated.id) {
            return {
              ...c,
              likes: updated.likes,
              likedByUser: updated.likedByUser,
            };
          }
          return {
            ...c,
            replies: updateRecursively(c.replies || []),
          };
        });

      setComments((prev) => {
        const newState = updateRecursively(prev);
        AsyncStorage.setItem(cacheKey, JSON.stringify(newState));
        return newState;
      });
    } catch (err) {
      console.log("❌ Error al dar like:", err);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteComment(id);

      const removeRecursively = (arr: UIComment[]): UIComment[] =>
        arr
          .filter((c) => c.id !== id)
          .map((c) => {
            const newReplies = removeRecursively(c.replies || []);
            return {
              ...c,
              replies: newReplies,
              repliesCount: newReplies.length,
            };
          });

      let totalCountAfter = 0;

      setComments((prev) => {
        const updated = removeRecursively(prev);
        AsyncStorage.setItem(cacheKey, JSON.stringify(updated));
        totalCountAfter = countCommentsTree(updated);
        return updated;
      });

      onCommentSent?.(undefined, {
        type: "delete",
        totalCount: totalCountAfter,
        delta: -1,
      });
    } catch (err) {
      console.log("❌ Error eliminando comentario:", err);
    }
  };

  const handleReply = (id: string, user: string) => {
    setReplyTo({ id, user });
    setReplyContext(findCommentById(id, comments));
    setTimeout(() => {
      inputRef.current?.focus();
      listRef.current?.scrollToEnd({ animated: true });
    }, 200);
  };

  // ======================================================
  // Mini Post embebido (post original comentado)
  // ======================================================
  const EmbeddedPostCard = ({ post }: { post: EmbeddedPost }) => {
    if (!post?.id) return null;

    const thumb = post.thumbUrl || post.mediaUrl || null;
    const isVideo = post.mediaType === "video";

    if (!thumb && !post.text) return null;

    return (
      <View style={styles.embeddedPost}>
        <View style={styles.embeddedHeaderRow}>
          {post.avatarUrl && (
            <Image
              source={{ uri: post.avatarUrl }}
              style={styles.embeddedAvatar}
            />
          )}
          <Text style={styles.embeddedAuthor}>{post.author}</Text>
        </View>

        {!!post.text && (
          <Text style={styles.embeddedText} numberOfLines={3}>
            {post.text}
          </Text>
        )}

        {thumb && (
          <View style={styles.embeddedMediaBox}>
            <Image
              source={{ uri: thumb }}
              style={styles.embeddedMediaImage}
              resizeMode="cover"
            />
            {isVideo && (
              <View style={styles.embeddedMediaPlayBadge}>
                <Text style={styles.embeddedMediaPlayText}>▶</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  // ======================================================
  // Item de comentario (incluye replies anidadas colapsables)
  // ======================================================
  const CommentItem = ({
    comment,
    level = 0,
    replyingTo,
  }: {
    comment: UIComment;
    level?: number;
    replyingTo?: string;
  }) => {
    const replyCount =
      typeof comment.repliesCount === "number"
        ? comment.repliesCount
        : comment.replies?.length || 0;

    const isExpanded = expandedIds.has(comment.id);

    const goToProfile = () => {
      const id = comment.authorId;
      if (!id) return;
      if (
        currentUser &&
        String(currentUser._id || currentUser.id) === String(id)
      ) {
        router.push("/(tabs)/profile");
      } else {
        router.push(`/profile/${id}`);
      }
    };

    return (
      <View
        style={[
          styles.commentWrapper,
          level > 0 && {
            marginLeft: 16,
            borderLeftWidth: 2,
            borderLeftColor: "#ddd",
            paddingLeft: 10,
          },
        ]}
      >
        {level > 0 && replyingTo && (
          <Text style={styles.inReplyToText}>
            ↳ En respuesta a @{replyingTo}
          </Text>
        )}

        <View style={styles.comment}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={goToProfile}
            style={styles.authorRow}
          >
            <Image
              source={{ uri: comment.avatarUrl || undefined }}
              style={styles.avatar}
            />
            <Text style={styles.author}>@{comment.author}</Text>
          </TouchableOpacity>

          {!!comment.text && <Text style={styles.text}>{comment.text}</Text>}

          {comment.mediaUrl && (
            <View style={styles.commentMediaBox}>
              <Image
                source={{ uri: comment.mediaUrl }}
                style={styles.commentMediaImage}
                resizeMode="cover"
              />
            </View>
          )}

          {comment.embeddedPost && (
            <EmbeddedPostCard post={comment.embeddedPost} />
          )}

          <View style={styles.actions}>
            <TouchableOpacity onPress={() => handleLike(comment.id)}>
              <Text
                style={[
                  styles.likeText,
                  comment.likedByUser && { color: "#e0245e" },
                ]}
              >
                ❤️ {comment.likes}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => handleReply(comment.id, comment.author)}
              style={styles.replyButtonWrapper}
            >
              <Text style={styles.replyBtn}>Responder</Text>
              {replyCount > 0 && (
                <Text style={styles.replyCountText}>
                  · {replyCount} respuesta{replyCount !== 1 ? "s" : ""}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleDelete(comment.id)}>
              <Text style={styles.deleteText}>Eliminar</Text>
            </TouchableOpacity>
          </View>

          {replyCount > 0 && (
            <TouchableOpacity
              onPress={() => toggleRepliesVisibility(comment.id)}
              style={styles.toggleRepliesRow}
            >
              <Text style={styles.toggleRepliesText}>
                {isExpanded
                  ? `Ocultar ${replyCount} respuesta${
                      replyCount !== 1 ? "s" : ""
                    }`
                  : `Ver ${replyCount} respuesta${
                      replyCount !== 1 ? "s" : ""
                    }`}
              </Text>
            </TouchableOpacity>
          )}

          {!!comment.createdAt && (
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>
                {formatDateTime(comment.createdAt)}
              </Text>
            </View>
          )}
        </View>

        {isExpanded &&
          (comment.replies?.length ?? 0) > 0 &&
          comment.replies!.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              level={level + 1}
              replyingTo={comment.author}
            />
          ))}
      </View>
    );
  };

  // ======================================================
  // Render principal
  // ======================================================
  if (loading && comments.length === 0) {
    return (
      <View style={[styles.container, styles.loadingCenter]}>
        <ActivityIndicator size="small" color="#007bff" />
      </View>
    );
  }

  const canSend = !!newComment.trim() || !!selectedMedia;

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        data={comments}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CommentItem comment={item} level={0} replyingTo={undefined} />
        )}
        ListHeaderComponent={
          <>
            {ListHeaderComponent ? (
              typeof ListHeaderComponent === "string" ? (
                <Text style={styles.header}>{ListHeaderComponent}</Text>
              ) : (
                ListHeaderComponent
              )
            ) : null}
            <Text style={styles.header}>Comentarios</Text>
          </>
        }
        ListEmptyComponent={
          <Text style={styles.empty}>No hay comentarios aún.</Text>
        }
        refreshing={!!refreshing}
        onRefresh={onRefresh}
        contentContainerStyle={{ paddingBottom: 110 }}
        keyboardShouldPersistTaps="handled"
      />

      {selectedMedia && (
        <View style={styles.mediaPreviewContainer}>
          <Image
            source={{ uri: selectedMedia.uri }}
            style={styles.mediaPreviewImage}
          />
          <TouchableOpacity
            onPress={clearSelectedMedia}
            style={styles.mediaPreviewRemove}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>×</Text>
          </TouchableOpacity>
        </View>
      )}

      <View
        style={[
          styles.inputRow,
          { paddingBottom: 10 + insets.bottom },
        ]}
      >
        <TouchableOpacity
          style={styles.clipButton}
          onPress={handlePickMedia}
        >
          <Text style={styles.clipIcon}>📎</Text>
        </TouchableOpacity>

        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={
            replyTo
              ? `En respuesta a @${replyTo.user}…`
              : "Escribe un comentario…"
          }
          value={newComment}
          onChangeText={setNewComment}
          multiline
        />

        <TouchableOpacity
          onPress={handleSend}
          disabled={sending || !canSend}
          style={[
            styles.button,
            (sending || !canSend) && { opacity: 0.4 },
          ]}
        >
          <Text style={styles.buttonText}>
            {sending ? "..." : "Enviar"}
          </Text>
        </TouchableOpacity>
      </View>

      {replyTo && (
        <View style={styles.replyInfoBox}>
          <View style={{ flex: 1 }}>
            <Text style={styles.replyInfoTitle}>
              En respuesta a @{replyTo.user}
            </Text>
            {replyContext?.text ? (
              <Text
                style={styles.replyInfoSnippet}
                numberOfLines={2}
                ellipsizeMode="tail"
              >
                {replyContext.text}
              </Text>
            ) : (
              <Text style={styles.replyInfoSnippet} numberOfLines={1}>
                Comentario sin texto
              </Text>
            )}
            {replyContext?.mediaUrl && (
              <Text style={styles.replyInfoMedia}>[Adjunto]</Text>
            )}
          </View>
          <TouchableOpacity
            onPress={() => {
              setReplyTo(null);
              setReplyContext(null);
            }}
          >
            <Text style={styles.replyCancel}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

// ======================================================
// Estilos
// ======================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingCenter: {
    justifyContent: "center",
    alignItems: "center",
  },

  header: {
    fontWeight: "700",
    fontSize: 20,
    marginTop: 10,
    marginBottom: 6,
    paddingHorizontal: 14,
  },
  empty: { textAlign: "center", color: "#777", marginTop: 10 },

  commentWrapper: {
    marginBottom: 16,
  },
  comment: {
    backgroundColor: "#fafafa",
    borderRadius: 20,
    padding: 6,
  },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
    flexWrap: "wrap",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#e5e5e5",
  },
  author: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1565c0",
    marginLeft: 8,
  },
  timeText: {
    fontSize: 11,
    color: "#888",
  },
  timeRow: {
    marginTop: 6,
    alignItems: "flex-end",
  },
  text: { fontSize: 15, marginTop: 4, marginBottom: 6 },

  inReplyToText: {
    fontSize: 12,
    color: "#888",
    marginBottom: 4,
    paddingLeft: 4,
  },

  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    marginTop: 6,
  },
  likeText: { fontWeight: "700" },
  replyBtn: { color: "#007bff", fontWeight: "700" },
  deleteText: { color: "#999" },

  replyButtonWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  replyCountText: {
    marginLeft: 4,
    fontSize: 12,
    color: "#555",
    fontWeight: "500",
  },

  toggleRepliesRow: {
    marginTop: 6,
  },
  toggleRepliesText: {
    fontSize: 12,
    color: "#555",
    fontWeight: "600",
  },

  commentMediaBox: {
    marginTop: 6,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ddd",
  },
  commentMediaImage: {
    width: "100%",
    height: 160,
  },

  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderTopWidth: 1,
    borderColor: "#eee",
    padding: 10,
    backgroundColor: "#fff",
  },
  clipButton: {
    marginRight: 8,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  clipIcon: {
    fontSize: 20,
  },
  input: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: "#f1f1f1",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    minHeight: 44,
    maxHeight: 150,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: "#007bff",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginLeft: 8,
    borderRadius: 18,
  },
  buttonText: { color: "#fff", fontWeight: "700" },

  replyInfoBox: {
    marginTop: -47,
    marginLeft: 12,
    marginRight: 12,
    padding: 10,
    backgroundColor: "#f4f4f5",
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  replyInfoTitle: { color: "#333", fontWeight: "700", marginBottom: 2 },
  replyInfoSnippet: { color: "#555", fontSize: 13 },
  replyInfoMedia: { color: "#007bff", fontSize: 12, marginTop: 2 },
  replyCancel: { color: "red", fontWeight: "600", paddingHorizontal: 8 },

  mediaPreviewContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingTop: 6,
    paddingBottom: 2,
    backgroundColor: "#fff",
  },
  mediaPreviewImage: {
    width: 54,
    height: 54,
    borderRadius: 10,
    backgroundColor: "#ddd",
  },
  mediaPreviewRemove: {
    marginLeft: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },

  embeddedPost: {
    marginTop: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#f0f2f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  embeddedHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  embeddedAvatar: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#ddd",
    marginRight: 6,
  },
  embeddedAuthor: {
    fontWeight: "700",
    fontSize: 13,
    color: "#111",
  },
  embeddedText: {
    fontSize: 13,
    color: "#333",
    marginTop: 2,
  },
  embeddedMediaBox: {
    marginTop: 8,
    height: 120,
    borderRadius: 10,
    backgroundColor: "#d8d8d8",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  embeddedMediaImage: {
    width: "100%",
    height: "100%",
  },
  embeddedMediaPlayBadge: {
    position: "absolute",
    alignSelf: "center",
    justifyContent: "center",
    alignItems: "center",
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  embeddedMediaPlayText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
});
