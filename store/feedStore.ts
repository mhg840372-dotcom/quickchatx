// 📁 store/feedStore.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getUnifiedFeed } from "../services/api"; // ⬅️ usamos el cliente axios central
import {
  type FeedUpdateEvent,
  type UserProfileUpdatePayload,
} from "../utils/feedEvents";

// ===============================
// CONFIG
// ===============================

// 24h de vida del cache
const CACHE_KEY = "feedCache_v2"; // 👈 bump v2
const CACHE_TTL = 1000 * 60 * 60 * 24;

// Manejo de 429
const BACKOFF_KEY = "feedCache_backoff_v2"; // 👈 bump v2

const MAX_BACKOFF = 1000 * 60 * 10; // 10 min máx

// ===============================
// Utils
// ===============================

function safeParse(json: string | null) {
  try {
    return json ? JSON.parse(json) : null;
  } catch {
    return null;
  }
}

// Type guard to ensure profile updates always include userId
const isUserProfileUpdate = (
  update: FeedUpdateEvent
): update is UserProfileUpdatePayload & { type: "userProfile" } =>
  update?.type === "userProfile" && (update as any).userId != null;

// Lectura segura con expiración
export async function loadFeedFromCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const data = safeParse(raw);

    if (!data || !data.timestamp || !Array.isArray(data.feed)) return null;

    const isExpired = Date.now() - data.timestamp > CACHE_TTL;
    if (isExpired) return null;

    return data.feed; // 👈 feed completo, con commentsCount si existe
  } catch {
    return null;
  }
}

// Escritura atómica (full feed)
export async function saveFeedToCache(feed: any[]) {
  try {
    const payload = JSON.stringify({
      timestamp: Date.now(),
      feed, // guardamos todos los campos
    });

    await AsyncStorage.setItem(CACHE_KEY, payload);
    console.log("💾 FeedStore cache actualizado:", feed.length, "items");
  } catch (err) {
    console.warn("saveFeedToCache error:", err);
  }
}

// ===============================
// Helpers de actualización local
// ===============================

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

  return ids.some(
    (v) => v != null && String(v) === String(postId)
  );
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

// Aplica un FeedUpdateEvent a un array de feed
const applyFeedUpdateToArray = (
  prevFeed: any[],
  update: FeedUpdateEvent
): any[] => {
  if (!Array.isArray(prevFeed) || prevFeed.length === 0) return prevFeed;

  // Eventos de perfil de usuario (no dependen de postId)
  if (isUserProfileUpdate(update)) {
    return prevFeed.map((item) => applyUserProfilePatchToItem(item, update));
  }

  // El resto de eventos esperan un postId
  const postId = (update as any).postId;
  if (!postId) return prevFeed;

  return prevFeed.map((item) => {
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

      case "videoViews": {
        const nextViews =
          typeof (update as any).viewsCount === "number"
            ? (update as any).viewsCount
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
        return item;
    }
  });
};

// ✅ Nuevo: función opcional para parchear el cache con eventos del feed
export async function patchFeedCache(update: FeedUpdateEvent) {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const data = safeParse(raw);
    if (!data || !Array.isArray(data.feed)) return;

    const patchedFeed = applyFeedUpdateToArray(data.feed, update);

    const payload = JSON.stringify({
      timestamp: data.timestamp || Date.now(),
      feed: patchedFeed,
    });

    await AsyncStorage.setItem(CACHE_KEY, payload);
  } catch (err) {
    console.warn("patchFeedCache error:", err);
  }
}

// ===============================
// Backoff 429
// ===============================

async function getBackoff() {
  const raw = await AsyncStorage.getItem(BACKOFF_KEY);
  const data = safeParse(raw);
  return data || { attempts: 0, nextTryAt: null };
}

async function registerBackoff() {
  const prev = await getBackoff();
  const attempts = prev.attempts + 1;

  const delay = Math.min(1000 * Math.pow(2, attempts), MAX_BACKOFF);
  const nextTryAt = Date.now() + delay;

  await AsyncStorage.setItem(
    BACKOFF_KEY,
    JSON.stringify({ attempts, nextTryAt })
  );

  console.log(`⚠️ Feed backoff activado: ${delay / 1000}s`);
}

async function resetBackoff() {
  await AsyncStorage.setItem(
    BACKOFF_KEY,
    JSON.stringify({ attempts: 0, nextTryAt: null })
  );
}

// ===============================
// Fetch real del feed (via API nueva /api/feed)
// ===============================

export async function fetchFeedFromServer(
  limit: number = 20
): Promise<any[]> {
  try {
    const backoff = await getBackoff();

    if (backoff.nextTryAt && Date.now() < backoff.nextTryAt) {
      console.log("⏳ Saltando fetch por backoff 429");
      return [];
    }

    // 🔥 Usamos el cliente axios con JWT y normalización de media
    const payload = await getUnifiedFeed(limit);

    // OK → reset backoff
    await resetBackoff();

    const feed = Array.isArray(payload.data) ? payload.data : [];
    return feed;
  } catch (err: any) {
    // Si el backend devuelve 429
    if (err?.response?.status === 429) {
      await registerBackoff();
      return [];
    }

    console.warn("fetchFeedFromServer error:", err);
    return [];
  }
}
