// ======================================================
// 📄 app/post/[id].tsx — Post Detail PRO (IG / Twitter Style)
// Post fijo + Comments scroll + Header automático
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/services/api";
import { useLocalSearchParams } from "expo-router";

import CommentsSection from "../../components/comments/CommentsSection";
import PostDetailView from "../../components/post/PostDetailView";
import GlobalHeader, { GLOBAL_HEADER_HEIGHT } from "../../components/GlobalHeader";

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [post, setPost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newCommentEvent, setNewCommentEvent] = useState<{
    data: any;
    ts: number;
  } | null>(null);

  // ✨ Animación suave al abrir
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const startFadeIn = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  // ============================
  // 🔄 Cargar post
  // ============================
  const loadPost = useCallback(async () => {
    try {
      const res = await api.get(`/posts/${id}`);
      setPost(res.data?.data || null);
      startFadeIn();
    } catch (err) {
      console.error("❌ Error cargando post:", err);
      setPost(null);
    } finally {
      setLoading(false);
    }
  }, [id, startFadeIn]);

  useEffect(() => {
    if (id) loadPost();
  }, [id, loadPost]);

  // ============================
  // ⏳ Loading
  // ============================
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
        <Text>No se encontró el post.</Text>
      </View>
    );
  }

  // ======================================================
  // Diseño: un solo scroll (FlatList de CommentsSection) con el post como header
  // ======================================================

  const headerOffset = insets.top + GLOBAL_HEADER_HEIGHT;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: "#fff" }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? headerOffset : 0}
    >
      <GlobalHeader />

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
                onCommentSent={(created, nextCount) => {
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
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  // Separador IG
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
