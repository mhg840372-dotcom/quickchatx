// src/contexts/PostScrollContext.tsx
import { createContext, useContext, useRef } from "react";

const PostScrollContext = createContext({
  onScroll: (_: number) => {},
});

export function PostScrollProvider({ children, onDirection }: any) {
  const lastY = useRef(0);

  const onScroll = (y: number) => {
    if (y > lastY.current) {
      onDirection?.("down");
    } else if (y < lastY.current) {
      onDirection?.("up");
    }
    lastY.current = y;
  };

  return (
    <PostScrollContext.Provider value={{ onScroll }}>
      {children}
    </PostScrollContext.Provider>
  );
}

export const usePostScroll = () => useContext(PostScrollContext);
