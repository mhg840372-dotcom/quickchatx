// 📁 hooks/usePersonalizedFeed.ts

import { useEffect, useState, useCallback } from "react";
import {
  loadPersonalizedFeedFromCache,
  savePersonalizedFeedToCache,
  fetchPersonalizedFeedFromServer,
} from "../store/personalizedFeedStore";

export default function usePersonalizedFeed(limit: number = 20) {
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (opts: { fromRefresh?: boolean } = {}) => {
      const { fromRefresh = false } = opts;

      if (!fromRefresh) {
        // Cargar instantáneo desde cache
        const cache = await loadPersonalizedFeedFromCache();
        if (cache) {
          setFeed(cache);
        }
      }

      try {
        const fresh = await fetchPersonalizedFeedFromServer(limit);
        if (Array.isArray(fresh) && fresh.length > 0) {
          setFeed(fresh);
          savePersonalizedFeedToCache(fresh);
        }
      } catch (err) {
        console.warn("usePersonalizedFeed: error al obtener feed:", err);
      } finally {
        if (!fromRefresh) setLoading(false);
        else setRefreshing(false);
      }
    },
    [limit]
  );

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load({ fromRefresh: true });
  }, [load]);

  return { feed, loading, refreshing, refresh };
}
