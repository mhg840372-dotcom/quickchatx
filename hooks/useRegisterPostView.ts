// hooks/useRegisterPostView.ts
import { useEffect, useRef, useState } from "react";
import { registerPostView } from "@/services/api";

// cache en memoria para no registrar 10 veces el mismo post en una sesión
const viewedPostsSession = new Set<string>();

type UseRegisterPostViewOptions = {
  enabled?: boolean;
  onUpdateViews?: (views: number) => void;
};

export function useRegisterPostView(
  postId: string | null | undefined,
  options: UseRegisterPostViewOptions = {}
) {
  const { enabled = true, onUpdateViews } = options;
  const [hasSent, setHasSent] = useState(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!postId || !enabled) return;

    if (viewedPostsSession.has(postId)) {
      setHasSent(true);
      return;
    }

    let cancelled = false;

    const send = async () => {
      try {
        viewedPostsSession.add(postId);
        setHasSent(true);

        const data = await registerPostView(postId);
        if (!data) return;

        if (!cancelled && isMountedRef.current && onUpdateViews) {
          const views =
            typeof data.viewsCount === "number" ? data.viewsCount : 0;
          onUpdateViews(views);
        }
      } catch (err) {
        console.warn("[useRegisterPostView] error:", err);
      }
    };

    send();

    return () => {
      cancelled = true;
    };
  }, [postId, enabled, onUpdateViews]);

  return { hasSent };
}
