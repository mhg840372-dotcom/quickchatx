// hooks/useFeed.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import {
  loadFeedFromCache,
  saveFeedToCache,
  fetchFeedFromServer,
  patchFeedCache, // 👈 NUEVO: parchear también el cache
} from "../store/feedStore";

import {
  subscribeToFeedUpdates,
  type FeedUpdateEvent,
  type UserProfileUpdatePayload,
} from "../utils/feedEvents";

// 🕒 Intervalo por defecto: 20 minutos (en ms)
const DEFAULT_AUTO_REFRESH_MS = 20 * 60 * 1000; // 20 min

// Type guard so TS knows we actually have a userId when handling profile events
const isUserProfileUpdate = (
  update: FeedUpdateEvent
): update is UserProfileUpdatePayload & { type: "userProfile" } =>
  update?.type === "userProfile" && (update as any).userId != null;

// ======================================================
// 🔎 Helpers de sincronización local
// ======================================================

// Detectar si un item del feed corresponde a un postId concreto
const isSamePost = (item: any, postId: string) => {
  if (!item || !postId) return false;

  const ids = [
    item._id,
    item.id,
    item.postId,
    item.post_id,
    item.post?.id,
    item.post?._id,
    item.data?.post?.id,
    item.data?.post?._id,
    item.post?.postId,
    item.__baseId,
  ];

  return ids.some((v) => v != null && String(v) === String(postId));
};

// Aplica cambios de perfil de usuario sobre un item del feed
const applyUserProfilePatchToItem = (
  item: any,
  payload: UserProfileUpdatePayload
) => {
  if (!item) return item;

  const userId = String(payload.userId);

  const matchesAuthor =
    String(item.authorId || "") === userId ||
    String(item.userId || "") === userId ||
    String(item.user?._id || item.user?.id || "") === userId ||
    String(item.author?._id || item.author?.id || "") === userId ||
    String(item.createdBy?._id || item.createdBy?.id || "") === userId ||
    String(item.owner?._id || item.owner?.id || "") === userId;

  if (!matchesAuthor) return item;

  const patchFields: any = {};
  if (payload.username) patchFields.authorUsername = payload.username;
  if (payload.avatarUrl || payload.safeAvatar) {
    patchFields.avatarUrl = payload.safeAvatar || payload.avatarUrl;
  }

  return {
    ...item,
    ...patchFields,
    author: {
      ...(item.author || {}),
      username: payload.username || item.author?.username,
      safeAvatar: payload.safeAvatar ?? item.author?.safeAvatar,
      avatarUrl: payload.avatarUrl ?? item.author?.avatarUrl,
    },
    createdBy: {
      ...(item.createdBy || {}),
      username: payload.username || item.createdBy?.username,
      safeAvatar: payload.safeAvatar ?? item.createdBy?.safeAvatar,
      avatarUrl: payload.avatarUrl ?? item.createdBy?.avatarUrl,
    },
    user: {
      ...(item.user || {}),
      username: payload.username || item.user?.username,
      safeAvatar: payload.safeAvatar ?? item.user?.safeAvatar,
      avatarUrl: payload.avatarUrl ?? item.user?.avatarUrl,
    },
    owner: {
      ...(item.owner || {}),
      username: payload.username || item.owner?.username,
      safeAvatar: payload.safeAvatar ?? item.owner?.safeAvatar,
      avatarUrl: payload.avatarUrl ?? item.owner?.avatarUrl,
    },
  };
};

// Aplica un FeedUpdateEvent al array del feed
const applyFeedUpdate = (prevFeed: any[], update: FeedUpdateEvent): any[] => {
  if (!Array.isArray(prevFeed) || prevFeed.length === 0) return prevFeed;

  // Eventos de perfil de usuario (no dependen de postId)
  if (isUserProfileUpdate(update)) {
    return prevFeed.map((item) => applyUserProfilePatchToItem(item, update));
  }

  // El resto de eventos esperan un postId
  const postId = (update as any).postId;
  if (!postId) return prevFeed;

  return prevFeed.map((item) => {
    // No tocamos noticias u otros tipos si no matchean el post
    if (item?.type === "news") return item;
    if (!isSamePost(item, postId)) return item;

    switch (update.type) {
      case "commentsCount": {
        const current =
          typeof item.commentsCount === "number"
            ? item.commentsCount
            : Array.isArray(item.comments)
            ? item.comments.length
            : 0;

        const next =
          typeof update.value === "number"
            ? update.value
            : current + (update.delta ?? 1);

        return { ...item, commentsCount: next };
      }

      case "likes": {
        const nextLiked = !!update.liked;
        const nextCount =
          typeof update.likesCount === "number"
            ? update.likesCount
            : item.likesCount ?? 0;

        return {
          ...item,
          likedByUser: nextLiked,
          liked: nextLiked,
          likesCount: nextCount,
        };
      }

      // 👁️ Soporte opcional para eventos de views de video
      case "videoViews": {
        const u: any = update as any;
        const nextViews =
          typeof u.viewsCount === "number"
            ? u.viewsCount
            : item.viewsCount ?? 0;

        return {
          ...item,
          viewsCount: nextViews,
          stats: {
            ...(item.stats || {}),
            views: nextViews,
          },
        };
      }

      default:
        // Cualquier otro tipo custom no rompe nada
        return item;
    }
  });
};

// ======================================================
// 🧩 Hook principal
// ======================================================
export default function useFeed(
  autoRefreshMs: number = DEFAULT_AUTO_REFRESH_MS
) {
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const mountedRef = useRef(true);

  // 🔹 Carga inicial (cache + servidor)
  const loadInitial = useCallback(async () => {
    try {
      // 1) Cargar instantáneamente desde cache (si existe)
      const cache = await loadFeedFromCache();
      if (cache && mountedRef.current) {
        setFeed(cache);
      }

      // 2) Actualizar desde servidor (en background)
      let fresh: any[] = [];
      try {
        fresh = await fetchFeedFromServer();
      } catch (err) {
        console.warn("useFeed: error al obtener feed inicial:", err);
      }

      if (mountedRef.current && Array.isArray(fresh) && fresh.length > 0) {
        setFeed(fresh);
        saveFeedToCache(fresh);
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  // 🔄 Refresh manual (para botón / pull-to-refresh)
  const refresh = useCallback(async () => {
    if (refreshing) return; // evitar doble disparo

    setRefreshing(true);
    try {
      const fresh = await fetchFeedFromServer();
      if (mountedRef.current && Array.isArray(fresh) && fresh.length > 0) {
        setFeed(fresh);
        saveFeedToCache(fresh);
      }
    } catch (err) {
      console.warn("useFeed: error al refrescar feed:", err);
    } finally {
      if (mountedRef.current) setRefreshing(false);
    }
  }, [refreshing]);

  // 🔁 Efecto: carga inicial
  useEffect(() => {
    mountedRef.current = true;
    loadInitial();
    return () => {
      mountedRef.current = false;
    };
  }, [loadInitial]);

  // ⏱️ Efecto: auto-refresh cada X ms (por defecto 20 min)
  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs <= 0) return;

    const id = setInterval(() => {
      // No esperamos al usuario: traemos feed fresco
      refresh();
    }, autoRefreshMs);

    return () => clearInterval(id);
  }, [autoRefreshMs, refresh]);

  // 📡 Suscripción al bus de eventos del feed (likes, comments, views, perfil)
  useEffect(() => {
    const unsubscribe = subscribeToFeedUpdates((update) => {
      if (!mountedRef.current) return;

      // 1) parcheamos el feed en memoria
      setFeed((prev) => applyFeedUpdate(prev, update));

      // 2) opcional: parchear también el cache persistido
      patchFeedCache(update).catch((err) =>
        console.warn("useFeed: patchFeedCache error:", err)
      );
    });

    return unsubscribe;
  }, []);

  return { feed, loading, refreshing, refresh };
}
