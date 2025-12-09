import type { ReactNode } from "react";
import {
    createContext,
    useContext,
    useEffect,
    useRef,
} from "react";

type ScrollDirection = "up" | "down";

// Replaced the previous type alias with an interface and added a props interface
interface ScrollContextType {
  /** 🔼 Notifica cambios de dirección del scroll */
  onScrollDirectionChange?: (direction: ScrollDirection) => void;
  /** ⬆️ Guarda función global para volver arriba */
  scrollToTop?: (fn: () => void) => void;
  /** ♻️ Guarda función global para refrescar el feed */
  refreshFeed?: (fn: () => void) => void;
}

interface ScrollProviderProps {
  children: ReactNode;
  onScrollDirectionChange?: (direction: ScrollDirection) => void;
  scrollToTop?: (fn: () => void) => void;
  refreshFeed?: (fn: () => void) => void;
}

const ScrollContext = createContext<ScrollContextType>({});

/** 🪄 Hook de acceso */
export const useScrollContext = (): ScrollContextType => useContext(ScrollContext);

/** 🧠 ScrollProvider: Maneja el contexto global de scroll y auto-refresh */
export const ScrollProvider = ({
  children,
  onScrollDirectionChange,
  scrollToTop,
  refreshFeed,
}: ScrollProviderProps): JSX.Element => {
  // Typed refs (nullable) for stored functions
  const scrollToTopRef = useRef<(() => void) | null>(null);
  const refreshFeedRef = useRef<(() => void) | null>(null);
  const directionHandlerRef = useRef<((dir: ScrollDirection) => void) | null>(null);

  // Permite a componentes hijos registrar handlers
  useEffect(() => {
    if (onScrollDirectionChange) directionHandlerRef.current = onScrollDirectionChange;
    if (scrollToTop) scrollToTop((fn) => (scrollToTopRef.current = fn));
    if (refreshFeed) refreshFeed((fn) => (refreshFeedRef.current = fn));
  }, [onScrollDirectionChange, scrollToTop, refreshFeed]);

  /** ♻️ Auto-refresco cada 60s */
  useEffect(() => {
    const interval = setInterval(() => {
      refreshFeedRef.current?.();
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // Build a typed context value to pass to the provider
  const contextValue: ScrollContextType = {
    onScrollDirectionChange: (dir: ScrollDirection) => directionHandlerRef.current?.(dir),
    scrollToTop: (fn: () => void) => {
      scrollToTopRef.current = fn;
    },
    refreshFeed: (fn: () => void) => {
      refreshFeedRef.current = fn;
    },
  };

  return (
    <ScrollContext.Provider value={contextValue}>
      {children}
    </ScrollContext.Provider>
  );
};
