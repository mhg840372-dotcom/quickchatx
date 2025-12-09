// ======================================================
// 🧠 feedCache.ts — QuickChatX v4.1-STABLE (2025)
// ------------------------------------------------------
// ✅ Caché local del feed (AsyncStorage)
// ✅ AtomicWrite seguro (anti-corrupción)
// ✅ TTL de 5 min (configurable)
// ✅ Backoff ante 429 con exponencial y autolimpieza
// ✅ Compatible con FeedScreen v10.0-STABLE
// ✅ v4.1: bump de claves (v2) para incluir commentsCount
// ======================================================

import AsyncStorage from "@react-native-async-storage/async-storage";

// 👇 BUMP de versión para invalidar cache viejo sin commentsCount
const FEED_CACHE_KEY = "qcxf_feed_cache_v2";
const FEED_CACHE_META_KEY = "qcxf_feed_meta_v2";
const TEMP_WRITE_KEY = "qcxf_feed_temp_write_v2";

const DEFAULT_TTL_MS = 1000 * 60 * 5; // 5 minutos
const MAX_BACKOFF_MS = 1000 * 60 * 10; // 10 min

// ======================================================
// 🧩 Tipos
// ======================================================
export type FeedCacheMeta = {
  updatedAt: number;
  page: number;
  ttl?: number;
  backoff?: {
    attempts: number;
    nextTryAt?: number;
  };
};

// ======================================================
// 🧠 Utilidad: parseo JSON seguro
// ======================================================
function safeJSONParse(data: string | null) {
  try {
    return data ? JSON.parse(data) : null;
  } catch (err) {
    console.warn("⚠️ JSON corrupto detectado en AsyncStorage:", err);
    return null;
  }
}

// ======================================================
// 💾 Atomic Write — evita corrupción si hay crash
// ======================================================
async function atomicWrite(pairs: [string, string][]) {
  try {
    // 1️⃣ Escribir versiones temporales
    await AsyncStorage.multiSet(
      pairs.map(([k, v]) => [`${TEMP_WRITE_KEY}_${k}`, v])
    );

    // 2️⃣ Copiar a las claves reales
    await AsyncStorage.multiSet(pairs);

    // 3️⃣ Borrar temporales
    await AsyncStorage.multiRemove(pairs.map(([k]) => `${TEMP_WRITE_KEY}_${k}`));
  } catch (err) {
    console.warn("⚠️ atomicWrite error:", err);
  }
}

// ======================================================
// 📖 Leer feed desde cache
// ======================================================
export const readFeedCache = async (): Promise<{
  items: any[];
  meta?: FeedCacheMeta;
} | null> => {
  try {
    const [itemsRaw, metaRaw] = await AsyncStorage.multiGet([
      FEED_CACHE_KEY,
      FEED_CACHE_META_KEY,
    ]);

    const items = safeJSONParse(itemsRaw?.[1] || null);
    const meta = safeJSONParse(metaRaw?.[1] || null);

    if (!items || !Array.isArray(items)) {
      console.warn("⚠️ Cache inválido detectado, limpiando...");
      await clearFeedCache();
      return null;
    }

    // TTL — eliminar si expiró
    const ttl = meta?.ttl ?? DEFAULT_TTL_MS;
    const expired = meta?.updatedAt ? Date.now() - meta.updatedAt > ttl : false;

    if (expired) {
      console.log("⏰ Feed cache expirado, será recargado...");
      await clearFeedCache();
      return null;
    }

    return { items, meta };
  } catch (err) {
    console.warn("⚠️ readFeedCache error:", err);
    return null;
  }
};

// ======================================================
// 💾 Guardar feed en cache
// ======================================================
export const writeFeedCache = async (
  items: any[],
  page = 1,
  ttl = DEFAULT_TTL_MS
) => {
  try {
    const meta: FeedCacheMeta = {
      updatedAt: Date.now(),
      page,
      ttl,
      backoff: { attempts: 0, nextTryAt: undefined },
    };

    await atomicWrite([
      [FEED_CACHE_KEY, JSON.stringify(items)], // 👈 guardamos el objeto completo (incluye commentsCount)
      [FEED_CACHE_META_KEY, JSON.stringify(meta)],
    ]);

    console.log("💾 Feed cache actualizado:", items.length, "items");
  } catch (err) {
    console.warn("⚠️ writeFeedCache error:", err);
  }
};

// ======================================================
// 🧩 Actualizar solo metadatos del cache
// ======================================================
export const updateFeedCacheMeta = async (
  updater: (m?: FeedCacheMeta) => FeedCacheMeta
) => {
  try {
    const meta = safeJSONParse(await AsyncStorage.getItem(FEED_CACHE_META_KEY));
    const next = updater(meta || undefined);
    await atomicWrite([[FEED_CACHE_META_KEY, JSON.stringify(next)]]);
  } catch (err) {
    console.warn("⚠️ updateFeedCacheMeta error:", err);
  }
};

// ======================================================
// 🧹 Limpiar cache completo
// ======================================================
export const clearFeedCache = async () => {
  try {
    await AsyncStorage.multiRemove([FEED_CACHE_KEY, FEED_CACHE_META_KEY]);
    console.log("🧹 Caché del feed limpiado");
  } catch (err) {
    console.warn("⚠️ clearFeedCache error:", err);
  }
};

// ======================================================
// ⏳ Backoff ante HTTP 429 — con exponencial y límite
// ======================================================
export const register429Backoff = async () => {
  try {
    const meta: FeedCacheMeta =
      safeJSONParse(await AsyncStorage.getItem(FEED_CACHE_META_KEY)) || {
        updatedAt: Date.now(),
        page: 1,
        ttl: DEFAULT_TTL_MS,
        backoff: { attempts: 0 },
      };

    const attempts = (meta.backoff?.attempts || 0) + 1;
    const delay = Math.min(1000 * Math.pow(2, attempts), MAX_BACKOFF_MS);

    meta.backoff = {
      attempts,
      nextTryAt: Date.now() + delay,
    };

    await atomicWrite([[FEED_CACHE_META_KEY, JSON.stringify(meta)]]);

    console.log("⚠️ 429 recibido → backoff activado por", delay / 1000, "s");
  } catch (err) {
    console.warn("⚠️ register429Backoff error:", err);
  }
};

export const shouldWaitForBackoff = async (): Promise<boolean> => {
  try {
    const meta = safeJSONParse(await AsyncStorage.getItem(FEED_CACHE_META_KEY));
    const nextTryAt = meta?.backoff?.nextTryAt;

    if (!nextTryAt) return false;

    const remaining = nextTryAt - Date.now();

    if (remaining > 0) {
      console.log("⏳ Backoff activo — espera", Math.round(remaining / 1000), "s");
      return true;
    } else {
      // Limpia si el backoff expiró
      await resetBackoff();
      return false;
    }
  } catch (err) {
    console.warn("⚠️ shouldWaitForBackoff error:", err);
    return false;
  }
};

export const resetBackoff = async () => {
  try {
    await updateFeedCacheMeta((meta) => {
      const m = meta || {
        updatedAt: Date.now(),
        page: 1,
        ttl: DEFAULT_TTL_MS,
        backoff: { attempts: 0 },
      };
      m.backoff = { attempts: 0, nextTryAt: undefined };
      return m;
    });

    console.log("🔄 Backoff reseteado");
  } catch (err) {
    console.warn("⚠️ resetBackoff error:", err);
  }
};
