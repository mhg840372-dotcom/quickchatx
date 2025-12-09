// ======================================================
// ⚡ FeedScreen — QuickChatX v11.5-STABLE (2025)
// Ultra Stable / Anti-502 / Anti-429 / Auto-Recovery
// 🎥 Integrado con QuickPlayVideo vía FeedItemEnhanced
// 🔗 Usando feed mixto (posts + news) vía getUnifiedFeed
// 🕒 SIEMPRE ordena por contenido más reciente (posts + news)
// 🔁 Usa /api/feed/refresh para traer SOLO contenido nuevo
// 🆔 Keys únicas por __baseId (sin warnings de FlatList)
// 🔔 Escucha feedEvents → actualiza likes/comments/views/perfil en caliente
// ✅ Refetch al volver a la pestaña
// ✅ Refresh silencioso + banner tipo Twitter para nuevos posts
// ✅ Autoplay seguro: solo 1 índice activo + pre-carga 3–4 posts
// ======================================================

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Animated,
  ActivityIndicator,
  Alert,
  View,
  TouchableOpacity,
  NativeSyntheticEvent,
  NativeScrollEvent,
  StyleSheet,
  Platform,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import LottieView from "lottie-react-native";

import FeedItemEnhanced from "../../components/FeedItemEnhanced";
import { ThemedText, ThemedView } from "../../theme/themed-view";
import { useAuth } from "../../hooks/useAuth";
import { useScrollContext } from "../../contexts/ScrollContext";
import { api, getUnifiedFeed, refreshUnifiedFeed } from "../../services/api";

// Cache / backoff helpers
import {
  readFeedCache,
  writeFeedCache,
  shouldWaitForBackoff,
  register429Backoff,
  resetBackoff,
} from "../../utils/feedCache";

// 🔔 Bus de eventos para sincronizar likes/comments/views/perfil
import { subscribeToFeedUpdates } from "../../utils/feedEvents";

let savedFeedOffset = 0;
const mediaRevalidateCache = new Map<string, number>();

// ======================================================
// 🧠 Helpers de ordenación — “Newest First Always”
// ======================================================

function computeSortTime(item: any): number {
  const rawDate =
    item?.createdAt ||
    item?.publishedAt ||
    item?.date ||
    item?.timestamp ||
    item?.updatedAt ||
    null;

  if (!rawDate) return 0;

  const t = new Date(rawDate).getTime();
  return Number.isFinite(t) ? t : 0;
}

// ID estable que usamos para keys del FlatList
function getBaseId(item: any, fallbackIndex?: number): string {
  if (item?.__baseId) return String(item.__baseId);

  const raw =
    item?._id ||
    item?.id ||
    item?.postId ||
    item?.newsId ||
    (typeof fallbackIndex === "number"
      ? `idx-${fallbackIndex}`
      : `tmp-${Math.random().toString(36).slice(2)}`);

  return String(raw);
}

// 🔁 Deduplicar por __baseId / _id / id / newsId
function dedupeByBaseId(items: any[]): any[] {
  const seen = new Set<string>();
  const result: any[] = [];

  items.forEach((item, index) => {
    const key = getBaseId(item, index);
    if (seen.has(key)) return;
    seen.add(key);

    result.push({
      ...item,
      __baseId: item.__baseId || key,
    });
  });

  return result;
}

// 🔀 Normalizar + mezclar + ordenar por fecha DESC
function normalizeAndSort(items: any[]): any[] {
  const deduped = dedupeByBaseId(Array.isArray(items) ? items : []);

  return deduped
    .map((p: any) => {
      const sortTimeFromField = computeSortTime(p);

      return {
        ...p,
        // Respetamos type si viene, si no inferimos
        type: p.type || (p.media ? "post" : "news"),
        // Si ya trae _sortTime del backend lo respetamos; si no, lo calculamos
        _sortTime:
          typeof p._sortTime === "number" && Number.isFinite(p._sortTime)
            ? p._sortTime
            : sortTimeFromField,
      };
    })
    .sort((a, b) => {
      const ta =
        typeof a._sortTime === "number" ? a._sortTime : computeSortTime(a);
      const tb =
        typeof b._sortTime === "number" ? b._sortTime : computeSortTime(b);
      // MÁS RECIENTE PRIMERO → mezcla posts + news solo por fecha
      return tb - ta;
    });
}

const BANNER_HEIGHT = 16;
const BANNER_MARGIN = 10;

// ======================================================
// 🎯 Helper para revalidar media al hacerse visible
// ======================================================
const pickPrimaryMediaUrl = (item: any): string | null => {
  const mediaArr = Array.isArray(item?.media) ? item.media : [];
  if (mediaArr.length) {
    const m = mediaArr[0] || {};
    const url =
      m.url || m.path || m.imageUrl || m.videoUrl || m.thumbnailUrl;
    return url ? String(url) : null;
  }

  if (item?.videoId) return null;

  const fallbacks = [
    item?.video,
    item?.videoUrl,
    item?.image,
    item?.imageUrl,
    item?.thumbnail,
  ];
  const found = fallbacks.find(Boolean);
  return found ? String(found) : null;
};

const buildAbsoluteUrl = (url?: string | null): string | null => {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  const apiBase =
    (api?.defaults?.baseURL || "")
      .replace(/\/+$/, "")
      .replace(/\/api$/, "") || process.env.EXPO_PUBLIC_API_BASE_URL;
  const base = apiBase || "https://api.quickchatx.com";
  const normalized = url.startsWith("/")
    ? url
    : url.startsWith("uploads")
    ? `/${url}`
    : `/${url}`;
  return `${base}${normalized}`;
};

// ======================================================
// 🔥 FeedScreen principal
// ======================================================
export default function FeedScreen() {
  const [feed, setFeed] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [refreshing, setRefreshing] = useState(false); // semántico

  // 🧠 Índice del ítem activo (solo este reproduce video)
  const [activeIndex, setActiveIndex] = useState(0);

  // 🆕 Nuevos ítems pendientes (para banner tipo Twitter)
  const [pendingNewItems, setPendingNewItems] = useState<any[]>([]);

  const { token, logout, loading } = useAuth();
  const { onScrollDirectionChange, scrollToTop, refreshFeed } =
    useScrollContext();

  const router = useRouter();

  const flatListRef = useRef<Animated.FlatList<any> | null>(null);
  const scrollY = useRef(new Animated.Value(0)).current;
  const prevScrollY = useRef(0);
  const lastScrollOffset = useRef(savedFeedOffset);
  const restoredScrollRef = useRef(false);
  const scrollDirection = useRef<"up" | "down">("up");
  const lottieRef = useRef<LottieView>(null);

  const isFetchingRef = useRef(false);
  const lastFetchTimeRef = useRef(0);
  const retryRef = useRef(0);

  // 🕒 último timestamp visto (para /feed/refresh)
  const lastFeedTimestampRef = useRef<string | null>(null);

  const computeLatestTimestamp = useCallback((items: any[]): string | null => {
    if (!items || !items.length) return null;
    let max = 0;

    for (const item of items) {
      const raw =
        item?.createdAt ||
        item?.publishedAt ||
        item?.date ||
        item?.timestamp ||
        item?.updatedAt;
      if (!raw) continue;
      const t = new Date(raw).getTime();
      if (Number.isFinite(t) && t > max) max = t;
    }

    return max ? new Date(max).toISOString() : null;
  }, []);

  // ======================================================
  // 1️⃣ Cargar cache local SIEMPRE ordenado por fecha
  // ======================================================
  useEffect(() => {
    (async () => {
      try {
        const cached = await readFeedCache();
        if (cached?.items?.length) {
          console.log(
            "🗂️ Feed cache cargado:",
            cached.items.length,
            "items"
          );

          const sortedCached = normalizeAndSort(cached.items);
          setFeed(sortedCached);
          lastFeedTimestampRef.current =
            computeLatestTimestamp(sortedCached);
          setPage(cached.meta?.page || 1);
          setHasMore(true);
        }
      } catch (err) {
        console.warn("⚠️ Error al cargar cache:", err);
      }
    })();
  }, [computeLatestTimestamp]);

  // ======================================================
  // 2️⃣ Fetch feed mixto (posts + news) con retry + backoff + cache
  // ======================================================
  const fetchFeed = useCallback(
    async (pageToLoad = 1, isRefresh = false) => {
      if (!token) return;

      const now = Date.now();
      if (now - lastFetchTimeRef.current < 900) return;
      lastFetchTimeRef.current = now;

      // ⚠️ De momento el backend no pagina /feed, así que solo cargamos page 1
      if (pageToLoad > 1) return;

      if (await shouldWaitForBackoff()) {
        console.log("⏳ Backoff activo — usando cache local");
        const cached = await readFeedCache();
        if (cached?.items?.length) {
          const sorted = normalizeAndSort(cached.items);
          setFeed(sorted);
          lastFeedTimestampRef.current =
            computeLatestTimestamp(sorted);
        }
        return;
      }

      if (isFetchingRef.current) return;
      isFetchingRef.current = true;

      try {
        if (pageToLoad === 1 && !isRefresh) setLoadingFeed(true);
        if (isRefresh) setRefreshing(true);

        const response = await getUnifiedFeed(20);
        const items = Array.isArray(response.data)
          ? response.data
          : [];

        console.log(
          "📥 [FeedScreen] getUnifiedFeed →",
          Array.isArray(items) ? items.length : 0,
          "items"
        );

        retryRef.current = 0;
        await resetBackoff();

        const arr = normalizeAndSort(items);

        setFeed(() => {
          writeFeedCache(arr, 1);
          lastFeedTimestampRef.current =
            computeLatestTimestamp(arr);
          setPendingNewItems([]);
          return arr;
        });

        setHasMore(false);
        setPage(1);
      } catch (err: any) {
        const status = err?.response?.status;

        if (status === 429) {
          console.warn("⚠️ 429 — activando backoff");
          await register429Backoff();
          const cached = await readFeedCache();
          if (cached?.items?.length) {
            const sorted = normalizeAndSort(cached.items);
            setFeed(sorted);
            lastFeedTimestampRef.current =
              computeLatestTimestamp(sorted);
          }
          return;
        }

        if ([500, 502, 503, 504].includes(status)) {
          console.warn("❌ Server error", status, "→ retry...");
          retryRef.current++;
          if (retryRef.current <= 3) {
            const delay = retryRef.current * 600;
            await new Promise((r) => setTimeout(r, delay));
            isFetchingRef.current = false;
            return fetchFeed(pageToLoad, isRefresh);
          }
          const cached = await readFeedCache();
          if (cached?.items?.length) {
            const sorted = normalizeAndSort(cached.items);
            setFeed(sorted);
            lastFeedTimestampRef.current =
              computeLatestTimestamp(sorted);
          }
          return;
        }

        if (status === 401) {
          Alert.alert(
            "Sesión expirada",
            "Vuelve a iniciar sesión."
          );
          await logout();
          return;
        }

        console.error(
          "❌ Error fetching unified feed (axios):",
          err?.message || err
        );
      } finally {
        isFetchingRef.current = false;
        setLoadingFeed(false);
        setRefreshing(false);
      }
    },
    [token, logout, computeLatestTimestamp]
  );

  // ======================================================
  // 🔁 Pedir SOLO contenido nuevo con /feed/refresh
  //    → Lo metemos en pendingNewItems para mostrar banner
  // ======================================================
  const refreshOnlyNew = useCallback(async () => {
    if (!token) return;

    const since =
      lastFeedTimestampRef.current || computeLatestTimestamp(feed);
    if (!since) return;

    try {
      const response = await refreshUnifiedFeed(since, 20);
      const newItems = Array.isArray(response.data)
        ? response.data
        : [];

      console.log(
        "📥 [FeedScreen] refreshUnifiedFeed → nuevos:",
        Array.isArray(newItems) ? newItems.length : 0
      );

      if (!newItems.length) return;

      const normalizedNew = normalizeAndSort(newItems);

      setPendingNewItems((prevPending) => {
        // Evitar duplicados entre feed + ya pendientes
        const existingIds = new Set<string>([
          ...feed.map((it, idx) => String(it.__baseId || getBaseId(it, idx))),
          ...prevPending.map((it, idx) =>
            String(it.__baseId || getBaseId(it, idx))
          ),
        ]);

        const fresh = normalizedNew.filter((it, idx) => {
          const id = String(it.__baseId || getBaseId(it, idx));
          if (existingIds.has(id)) return false;
          existingIds.add(id);
          return true;
        });

        if (!fresh.length) return prevPending;

        const mergedPending = normalizeAndSort([...fresh, ...prevPending]);

        // ⏱ Actualizamos el último timestamp visto usando feed + pendientes
        lastFeedTimestampRef.current = computeLatestTimestamp([
          ...mergedPending,
          ...feed,
        ]);

        return mergedPending;
      });
    } catch (err: any) {
      console.warn(
        "❌ Error al refrescar feed (refreshOnlyNew):",
        err?.message || err
      );
    }
  }, [token, feed, computeLatestTimestamp]);

  // ======================================================
  // 🆕 Handler para mostrar los nuevos posts
  // ======================================================
  const handleShowNewPosts = useCallback(() => {
    if (!pendingNewItems.length) return;

    setFeed((prev) => {
      const combined = [...pendingNewItems, ...prev];
      const merged = normalizeAndSort(combined);
      writeFeedCache(merged, 1);
      lastFeedTimestampRef.current = computeLatestTimestamp(merged);
      return merged;
    });

    setPendingNewItems([]);

    flatListRef.current?.scrollToOffset({
      offset: 0,
      animated: true,
    });
  }, [pendingNewItems, computeLatestTimestamp]);

  // ======================================================
  // 🔔 Escuchar cambios desde PostDetailView / EditProfile / views de video
  //    (setState diferido para evitar "Cannot update a component while rendering")
// ======================================================
  useEffect(() => {
    let isMounted = true;

    const safeSetFeed = (updater: (prev: any[]) => any[]) => {
      // Diferimos al siguiente tick para no actualizar durante el render
      setTimeout(() => {
        if (!isMounted) return;
        setFeed((prev) => updater(prev));
      }, 0);
    };

    const unsubscribe = subscribeToFeedUpdates((update: any) => {
      if (update.type === "deletedPost" && update.postId) {
        const { postId } = update;
        safeSetFeed((prev) => {
          const next = prev.filter(
            (it) => getBaseId(it) !== String(postId)
          );
          writeFeedCache(next, 1);
          return next;
        });
        return;
      }

      // 1) Actualizaciones de perfil de usuario (username / avatar / nombre)
      if (update.type === "userProfile" && update.userId) {
        const { userId } = update;
        // Compat: aceptamos tanto update.data.{...} como payload plano
        const data = (update as any).data || update;

        safeSetFeed((prev) => {
          if (!prev || !prev.length) return prev;

          let changed = false;

          const next = prev.map((item) => {
            const ids = [
              item?.authorId,
              item?.userId,
              item?.user?._id,
              item?.user?.id,
              item?.ownerId,
              item?.owner?._id,
              item?.author?._id,
              item?.createdBy?._id,
            ].filter(Boolean);

            const matches = ids.some(
              (id: any) => String(id) === String(userId)
            );
            if (!matches) return item;

            changed = true;
            const patched: any = { ...item };

            // username
            if (data.username) {
              patched.authorUsername = data.username;
              if (patched.user) {
                patched.user = {
                  ...patched.user,
                  username: data.username,
                };
              }
              if (patched.author) {
                patched.author = {
                  ...patched.author,
                  username: data.username,
                };
              }
              if (patched.owner) {
                patched.owner = {
                  ...patched.owner,
                  username: data.username,
                };
              }
              if (patched.createdBy) {
                patched.createdBy = {
                  ...patched.createdBy,
                  username: data.username,
                };
              }
            }

            // avatarUrl (legacy)
            if (data.avatarUrl) {
              patched.avatarUrl = data.avatarUrl;
              if (patched.user) {
                patched.user = {
                  ...patched.user,
                  avatarUrl: data.avatarUrl,
                  avatar: data.avatarUrl,
                  photoUrl: data.avatarUrl,
                };
              }
              if (patched.author) {
                patched.author = {
                  ...patched.author,
                  avatarUrl: data.avatarUrl,
                  avatar: data.avatarUrl,
                  photoUrl: data.avatarUrl,
                };
              }
              if (patched.owner) {
                patched.owner = {
                  ...patched.owner,
                  avatarUrl: data.avatarUrl,
                  avatar: data.avatarUrl,
                  photoUrl: data.avatarUrl,
                };
              }
              if (patched.createdBy) {
                patched.createdBy = {
                  ...patched.createdBy,
                  avatarUrl: data.avatarUrl,
                  avatar: data.avatarUrl,
                  photoUrl: data.avatarUrl,
                };
              }
            }

            // safeAvatar (nuevo backend)
            if (data.safeAvatar) {
              patched.safeAvatar = data.safeAvatar;
              if (patched.user) {
                patched.user = {
                  ...patched.user,
                  safeAvatar: data.safeAvatar,
                };
              }
              if (patched.author) {
                patched.author = {
                  ...patched.author,
                  safeAvatar: data.safeAvatar,
                };
              }
              if (patched.owner) {
                patched.owner = {
                  ...patched.owner,
                  safeAvatar: data.safeAvatar,
                };
              }
              if (patched.createdBy) {
                patched.createdBy = {
                  ...patched.createdBy,
                  safeAvatar: data.safeAvatar,
                };
              }
            }

            // nombre completo
            if (data.firstName || data.lastName) {
              const nextFirst =
                data.firstName ?? patched.firstName ?? patched.user?.firstName;
              const nextLast =
                data.lastName ?? patched.lastName ?? patched.user?.lastName;
              const full = `${nextFirst || ""} ${
                nextLast || ""
              }`.trim();

              if (nextFirst) patched.firstName = nextFirst;
              if (nextLast) patched.lastName = nextLast;
              if (full) patched.name = full;

              if (patched.user) {
                patched.user = {
                  ...patched.user,
                  firstName: nextFirst ?? patched.user.firstName,
                  lastName: nextLast ?? patched.user.lastName,
                  name: full || patched.user.name,
                };
              }
              if (patched.author) {
                patched.author = {
                  ...patched.author,
                  firstName:
                    nextFirst ?? patched.author.firstName,
                  lastName: nextLast ?? patched.author.lastName,
                  name: full || patched.author.name,
                };
              }
              if (patched.owner) {
                patched.owner = {
                  ...patched.owner,
                  firstName:
                    nextFirst ?? patched.owner.firstName,
                  lastName: nextLast ?? patched.owner.lastName,
                  name: full || patched.owner.name,
                };
              }
              if (patched.createdBy) {
                patched.createdBy = {
                  ...patched.createdBy,
                  firstName:
                    nextFirst ?? patched.createdBy.firstName,
                  lastName:
                    nextLast ?? patched.createdBy.lastName,
                  name: full || patched.createdBy.name,
                };
              }
            }

            return patched;
          });

          if (changed) {
            writeFeedCache(next, 1);
            return next;
          }
          return prev;
        });

        return;
      }

      // 2) Views de video (detalle → feed)
      if (update.type === "videoViews" && update.postId) {
        safeSetFeed((prev) => {
          if (!prev || !prev.length) return prev;

          const idx = prev.findIndex((item) => {
            const baseId = item.__baseId || getBaseId(item);
            return String(baseId) === String(update.postId);
          });

          if (idx === -1) return prev;

          const next = [...prev];
          const target: any = { ...next[idx] };

          const incoming =
            typeof update.viewsCount === "number"
              ? update.viewsCount
              : undefined;

          if (typeof incoming !== "number") return prev;

          const current =
            typeof target.viewsCount === "number"
              ? target.viewsCount
              : typeof target.videoViews === "number"
              ? target.videoViews
              : typeof target.stats?.views === "number"
              ? target.stats.views
              : typeof target.stats?.videoViews === "number"
              ? target.stats.videoViews
              : 0;

          // 🔒 Nunca bajar el contador, solo subir
          const final = incoming > current ? incoming : current;

          target.viewsCount = final;
          target.videoViews = final;
          if (target.stats && typeof target.stats === "object") {
            target.stats = {
              ...target.stats,
              views: final,
              videoViews: final,
            };
          }

          next[idx] = target;
          writeFeedCache(next, 1);
          return next;
        });

        return;
      }

      // 3) Comentarios / likes por post (lógica original)
      if (update.type === "commentsCount" || update.type === "likes") {
        safeSetFeed((prev) => {
          if (!prev || !prev.length) return prev;

          const idx = prev.findIndex((item) => {
            const baseId = item.__baseId || getBaseId(item);
            return String(baseId) === String(update.postId);
          });

          if (idx === -1) return prev;

          const next = [...prev];
          const target: any = { ...next[idx] };

          if (update.type === "commentsCount") {
            if (typeof update.value === "number") {
              target.commentsCount = update.value;
            } else {
              const base =
                typeof target.commentsCount === "number"
                  ? target.commentsCount
                  : 0;
              const delta =
                typeof update.delta === "number"
                  ? update.delta
                  : 1;
              target.commentsCount = base + delta;
            }
          } else if (update.type === "likes") {
            target.likedByUser = update.liked;
            target.liked = update.liked;
            target.likesCount = update.likesCount;
          }

          next[idx] = target;
          writeFeedCache(next, 1);
          return next;
        });
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // ======================================================
  // Primera carga después del estado de auth
  // ======================================================
  useEffect(() => {
    if (!loading && token) fetchFeed(1, true);
  }, [loading, token, fetchFeed]);

  // ======================================================
  // Pull-to-refresh silencioso
  // → si hay feed, sólo trae nuevos y los manda al banner
  // ======================================================
  const handleRefresh = useCallback(
    () => (feed.length ? refreshOnlyNew() : fetchFeed(1, true)),
    [feed.length, fetchFeed, refreshOnlyNew]
  );

  // ======================================================
  // ✅ Revalidar media al hacerse visible (SUAVE, sin 429 extra)
  // ======================================================
  const revalidateMediaIfNeeded = useCallback(
    async (item: any) => {
      if (!item) return;

      // Solo revalidamos POSTS de usuarios, nunca noticias
      const type = item?.type || (item?.media ? "post" : "news");
      if (type !== "post") return;

      const rawUrl = pickPrimaryMediaUrl(item);
      if (!rawUrl) return;

      const baseId = item?.__baseId || getBaseId(item);
      const now = Date.now();

      // Evitar spam por ítem (5 minutos)
      const last = mediaRevalidateCache.get(baseId);
      if (last && now - last < 5 * 60 * 1000) return;

      const mediaUrl = buildAbsoluteUrl(rawUrl);
      if (!mediaUrl) return;

      mediaRevalidateCache.set(baseId, now);

      const busterUrl = `${mediaUrl}${
        mediaUrl.includes("?") ? "&" : "?"
      }r=${now}`;

      try {
        await Image.prefetch(busterUrl);
      } catch {
        // silencioso
      }
    },
    []
  );

  // ======================================================
  // Auto-refresh cada 60s (silencioso → banner)
  // ======================================================
  useEffect(() => {
    const interval = setInterval(() => {
      refreshOnlyNew();
    }, 60000);
    return () => clearInterval(interval);
  }, [refreshOnlyNew]);

  // ======================================================
  // Integración scrollToTop
  // ======================================================
  useEffect(() => {
    if (scrollToTop)
      scrollToTop(() =>
        flatListRef.current?.scrollToOffset({
          offset: 0,
          animated: true,
        })
      );
    if (refreshFeed) refreshFeed(handleRefresh);
  }, [scrollToTop, refreshFeed, handleRefresh]);

  // ======================================================
  // Detectar dirección del scroll
  // ======================================================
  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    {
      useNativeDriver: true,
      listener: (
        event: NativeSyntheticEvent<NativeScrollEvent>
      ) => {
        const y = event.nativeEvent.contentOffset.y;
        lastScrollOffset.current = y;
        const diff = y - prevScrollY.current;
        if (Math.abs(diff) > 8) {
          const dir: "up" | "down" = diff > 0 ? "down" : "up";
          if (scrollDirection.current !== dir) {
            scrollDirection.current = dir;
            onScrollDirectionChange?.(dir);
          }
          prevScrollY.current = y;
        }
      },
    }
  );

  // ======================================================
  // Detectar item visible para autoplay seguro (por índice)
  // ======================================================
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: any[] }) => {
      if (viewableItems && viewableItems.length > 0) {
        const middle =
          viewableItems[Math.floor(viewableItems.length / 2)];
        if (
          middle &&
          typeof middle.index === "number" &&
          middle.index >= 0
        ) {
          setActiveIndex(middle.index);
        }
      }

      // Revalidar media de todos los visibles
      viewableItems.forEach((v) => {
        if (v?.item) revalidateMediaIfNeeded(v.item);
      });
    }
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 70,
    minimumViewTime: 200,
  }).current;

  // ======================================================
  // Restaurar posición de scroll al montar (si venimos de detalle)
  // ======================================================
  useEffect(() => {
    if (restoredScrollRef.current) return;
    if (!feed.length) return;
    restoredScrollRef.current = true;
    if (savedFeedOffset > 0 && flatListRef.current) {
      requestAnimationFrame(() => {
        flatListRef.current?.scrollToOffset({
          offset: savedFeedOffset,
          animated: false,
        });
      });
    }
  }, [feed.length]);

  // Guardar posición al desmontar
  useEffect(() => {
    return () => {
      savedFeedOffset = lastScrollOffset.current;
    };
  }, []);

  // ======================================================
  // Loader inicial (solo si no hay nada que mostrar)
  // ======================================================
  if ((loading || loadingFeed) && feed.length === 0) {
    return (
      <ThemedView style={styles.center}>
        <ActivityIndicator size="large" />
        <ThemedText style={{ marginTop: 10 }}>
          Cargando contenido...
        </ThemedText>
      </ThemedView>
    );
  }

  const newCount = pendingNewItems.length;
  const showNewBanner = newCount > 0;
  const bannerTopOffset = 8;
  const listTopPadding = showNewBanner
    ? BANNER_HEIGHT + BANNER_MARGIN
    : 70;

  // ======================================================
  // Render principal
  // ======================================================
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["left", "right", "bottom"]}>
      <ThemedView style={{ flex: 1, paddingHorizontal: 10 }}>
        {/* 🆕 Banner tipo Twitter cuando hay nuevo contenido */}
        {showNewBanner && (
          <View
            pointerEvents="box-none"
            style={[
              styles.newPostsContainer,
              { top: bannerTopOffset },
            ]}
          >
            <TouchableOpacity
              style={styles.newPostsButton}
              activeOpacity={0.9}
              onPress={handleShowNewPosts}
            >
              <ThemedText style={styles.newPostsText}>
                {newCount === 1
                  ? "1 nuevo contenido"
                  : `${newCount} nuevos contenidos`}
              </ThemedText>
            </TouchableOpacity>
          </View>
        )}

        <Animated.FlatList
          ref={flatListRef}
          data={feed}
          keyExtractor={(item, index) =>
            item.__baseId || getBaseId(item, index)
          }
          renderItem={({ item, index }) => (
            <FeedItemEnhanced
              item={item}
              nextItem={feed[index + 1] || null}
              isVisible={index === activeIndex}
              onMediaError={(it: any) => revalidateMediaIfNeeded(it)}
              onDeleted={(deletedId: string) => {
                setFeed((prev) => {
                  const next = prev.filter((it) => {
                    const baseId =
                      it.__baseId || String(it._id || it.id || "");
                    return String(baseId) !== String(deletedId);
                  });
                  writeFeedCache(next, 1);
                  return next;
                });
              }}
            />
          )}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onEndReached={() => {
            if (!loadingFeed && hasMore) fetchFeed(page + 1);
          }}
          onEndReachedThreshold={0.25}
          contentContainerStyle={{
            paddingTop: listTopPadding,
            paddingBottom: 120,
          }}
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={9}
          removeClippedSubviews
          updateCellsBatchingPeriod={50}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />

        {/* Botón FAB */}
        <View style={styles.fabContainer}>
          <TouchableOpacity
            activeOpacity={0.9}
            style={styles.transparentFab}
            onPress={() => {
              lottieRef.current?.play?.();
              router.push("/post/create");
            }}
          >
            <LottieView
              ref={lottieRef}
              source={require("@/assets/lottie/Post button.json")}
              loop={false}
              style={{ width: 90, height: 90 }}
            />
          </TouchableOpacity>
        </View>
      </ThemedView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fabContainer: {
    position: "absolute",
    bottom: Platform.OS === "ios" ? 100 : 50,
    right: 20,
  },
  transparentFab: {
    backgroundColor: "transparent",
    width: 90,
    height: 90,
    alignItems: "center",
    justifyContent: "center",
  },
  // 🆕 Banner nuevos posts
  newPostsContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 40,
  },
  newPostsButton: {
    backgroundColor: "#1DA1F2",
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: BANNER_HEIGHT,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  newPostsText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 13,
  },
});
