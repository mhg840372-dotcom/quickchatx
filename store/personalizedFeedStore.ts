// 📁 store/personalizedFeedStore.ts

import AsyncStorage from "@react-native-async-storage/async-storage";
import { getPersonalizedFeed } from "../services/api";

// ===============================
// CONFIG
// ===============================

// 24h de vida del cache
const CACHE_KEY = "feedCache_personalized_v1";
const CACHE_TTL = 1000 * 60 * 60 * 24;

// Manejo de 429
const BACKOFF_KEY = "feedCache_personalized_backoff_v1";

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

// Lectura segura con expiración
export async function loadPersonalizedFeedFromCache() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    const data = safeParse(raw);

    if (!data || !data.timestamp || !data.feed) return null;

    const isExpired = Date.now() - data.timestamp > CACHE_TTL;
    if (isExpired) return null;

    return data.feed;
  } catch {
    return null;
  }
}

// Escritura atómica
export async function savePersonalizedFeedToCache(feed: any[]) {
  try {
    const payload = JSON.stringify({
      timestamp: Date.now(),
      feed,
    });

    await AsyncStorage.setItem(CACHE_KEY, payload);
  } catch (err) {
    console.warn("savePersonalizedFeedToCache error:", err);
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

  console.log(`⚠️ Personalized feed backoff activado: ${delay / 1000}s`);
}

async function resetBackoff() {
  await AsyncStorage.setItem(
    BACKOFF_KEY,
    JSON.stringify({ attempts: 0, nextTryAt: null })
  );
}

// ===============================
// Fetch real del feed personalizado (via /api/feed/personalized)
// ===============================

export async function fetchPersonalizedFeedFromServer(
  limit: number = 20
): Promise<any[]> {
  try {
    const backoff = await getBackoff();

    if (backoff.nextTryAt && Date.now() < backoff.nextTryAt) {
      console.log("⏳ Saltando fetch personalizado por backoff 429");
      return [];
    }

    const payload = await getPersonalizedFeed(limit);

    // OK → reset backoff
    await resetBackoff();

    const feed = Array.isArray(payload.data) ? payload.data : [];
    return feed;
  } catch (err: any) {
    if (err?.response?.status === 429) {
      await registerBackoff();
      return [];
    }

    console.warn("fetchPersonalizedFeedFromServer error:", err);
    return [];
  }
}
