// ======================================================
// 📄 app/post/[id].tsx — Post Detail + Comentarios
// ------------------------------------------------------
// - Pantalla principal de detalle del post
// - Incluye CommentsSection debajo del post
// - Respeta el header global del stack /post
// ======================================================

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import { api } from "@/services/api";
import CommentsSection from "@/components/comments/CommentsSection";
import PostDetailView from "@/components/post/PostDetailView";
import { GLOBAL_HEADER_HEIGHT } from "@/components/GlobalHeader";

export default function PostDetailScreen() {
  const { id, focus } = useLocalSearchParams<{
    id?: string | string[];
    focus?: string | string[];
  }>();

  const resolvedId = Array.isArray(id) ? id[0] : id;
  const focusParam = Array.isArray(focus) ? focus[0] : focus;
  const insets = useSafeAreaInsets();

  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCommentEvent, setNewCommentEvent] = useState<{
    data: any;
    ts: number;
  } | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const startFadeIn = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const retryRef = useRef(0);

  const loadPost = useCallback(async () => {
    if (!resolvedId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await api.get(`/posts/${resolvedId}`);
      setPost(res.data?.data || null);
      startFadeIn();
    } catch (err: any) {
      console.error("❌ Error cargando post:", err);
      const status = err?.response?.status;
      if (status === 429 && retryRef.current < 1) {
        retryRef.current += 1;
        setTimeout(loadPost, 800);
        return;
      }
      setError(
        status === 429
          ? "Demasiadas peticiones. Intenta de nuevo en unos segundos."
          : "No se pudo cargar la publicación."
      );
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [resolvedId, startFadeIn]);

  useEffect(() => {
    loadPost();
  }, [loadPost]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.center}>
        <Text>{error || "No se encontró el post."}</Text>
        <TouchableOpacity
          style={{ marginTop: 12 }}
          onPress={() => {
            retryRef.current = 0;
            loadPost();
          }}
        >
          <Text style={{ color: "#007bff", fontWeight: "700" }}>
            Reintentar
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  const headerOffset = insets.top + GLOBAL_HEADER_HEIGHT;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerOffset : 0}
    >
      <Animated.View
        style={[
          styles.container,
          { opacity: fadeAnim, paddingTop: headerOffset },
        ]}
      >
        <CommentsSection
          targetId={post.id}
          targetType="post"
          externalNewComment={newCommentEvent}
          ListHeaderComponent={
            <>
              <PostDetailView
                post={post}
                onCommentSent={(created, meta) => {
                  let nextCount = post.commentsCount ?? 0;
                  if (typeof meta === "number") {
                    nextCount = meta;
                  } else if (
                    meta &&
                    typeof (meta as any).totalCount === "number"
                  ) {
                    nextCount = (meta as any).totalCount;
                  } else if (
                    meta &&
                    typeof (meta as any).delta === "number"
                  ) {
                    nextCount = nextCount + (meta as any).delta;
                  }

                  setPost((prev: any) =>
                    prev ? { ...prev, commentsCount: nextCount } : prev
                  );

                  setNewCommentEvent({
                    data: created,
                    ts: Date.now(),
                  });
                }}
              />
              <View style={styles.separator} />
              <Text style={styles.commentTitle}>
                Comentarios ({post.commentsCount ?? 0})
              </Text>
            </>
          }
        />
      </Animated.View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  separator: {
    height: 1,
    backgroundColor: "#e5e5e5",
    marginVertical: 10,
  },
  commentTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    color: "#111",
  },
});
