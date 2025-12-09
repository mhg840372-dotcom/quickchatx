// 📁 hooks/useComments.ts — QuickChatX 2025 (TypeScript)

import { useState, useEffect, useCallback } from "react";
import { api } from "@/services/api"; // 👈 tu axios base

// Tipo básico de comentario (puedes afinarlo si tienes el modelo real)
export interface Comment {
  _id: string;
  [key: string]: any;
}

export type TargetType = string;

export interface UseCommentsReturn {
  comments: Comment[];
  loading: boolean;
  addComment: (content: string) => Promise<void>;
  toggleLike: (commentId: string) => Promise<void>;
  deleteComment: (commentId: string) => Promise<void>;
  reload: () => Promise<void>;
}

export function useComments(
  targetId: string,
  targetType: TargetType
): UseCommentsReturn {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);

  const loadComments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/comments/${targetId}?type=${targetType}`);
      const list =
        (res.data?.comments as Comment[]) ||
        (res.data as Comment[]) ||
        [];
      setComments(list);
    } catch (err: any) {
      console.log(
        "Error cargando comentarios:",
        err?.message || String(err)
      );
    }
    setLoading(false);
  }, [targetId, targetType]);

  const addComment = async (content: string) => {
    try {
      const res = await api.post("/comments", {
        targetType,
        targetId,
        content,
      });

      const newComment: Comment =
        res.data?.comment || res.data || ({} as Comment);

      setComments((prev) => [newComment, ...prev]);
    } catch (err: any) {
      console.log(
        "Error creando comentario:",
        err?.message || String(err)
      );
    }
  };

  const toggleLike = async (commentId: string) => {
    try {
      const res = await api.post(`/comments/like/${commentId}`);
      const updated: Comment =
        res.data?.comment || res.data || ({} as Comment);

      setComments((prev) =>
        prev.map((c) => (c._id === commentId ? updated : c))
      );
    } catch (err: any) {
      console.log("Error en like:", err?.message || String(err));
    }
  };

  const deleteComment = async (commentId: string) => {
    try {
      await api.delete(`/comments/${commentId}`);
      setComments((prev) => prev.filter((c) => c._id !== commentId));
    } catch (err: any) {
      console.log(
        "Error eliminando comentario:",
        err?.message || String(err)
      );
    }
  };

  useEffect(() => {
    loadComments();
  }, [loadComments]);

  return {
    comments,
    loading,
    addComment,
    toggleLike,
    deleteComment,
    reload: loadComments,
  };
}
