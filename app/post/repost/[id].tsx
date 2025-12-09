// ======================================================
// 📄 app/post/repost/[id].tsx — Repost Screen v1 (movido)
// ------------------------------------------------------
// - Usa repostPost() y getPostById() de services/api
// - Preview ligera del post original (texto + autor)
// - Nota opcional de quote-repost
// - Mantiene el stack /post sin romper el detalle del post
// ======================================================

import { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GLOBAL_HEADER_HEIGHT } from "@/components/GlobalHeader";
import { getPostById, repostPost } from "@/services/api";

type Post = any; // si tienes tipo Post en /types, puedes reemplazarlo

export default function RepostScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();

  const id =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : undefined;

  const [post, setPost] = useState<Post | null>(null);
  const [loadingPost, setLoadingPost] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [reposting, setReposting] = useState(false);

  const loadPost = useCallback(async () => {
    if (!id) return;
    try {
      setLoadingPost(true);
      setError(null);
      const data = await getPostById(String(id));
      setPost(data);
    } catch (e: any) {
      console.log("[RepostScreen] error cargando post:", e?.message);
      setError("No se pudo cargar la publicación.");
    } finally {
      setLoadingPost(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    loadPost();
  }, [id, loadPost]);

  const handleRepost = async () => {
    if (!id || reposting) return;

    try {
      setReposting(true);

      const noteTrimmed = note.trim() || undefined;
      await repostPost(String(id), noteTrimmed);

      Alert.alert("Listo ✨", "Tu repost se publicó correctamente.", [
        {
          text: "OK",
          onPress: () => {
            if (router.canGoBack()) router.back();
            else router.replace(`/post/${String(id)}`);
          },
        },
      ]);
    } catch (e: any) {
      console.log("[RepostScreen] error haciendo repost:", e);
      const backendMsg =
        e?.response?.data?.error ||
        e?.response?.data?.message ||
        e?.message ||
        "No se pudo hacer el repost. Intenta de nuevo.";
      Alert.alert("Ups", backendMsg);
    } finally {
      setReposting(false);
    }
  };

  if (!id) {
    return (
      <View style={styles.center}>
        <Text>ID de publicación inválido</Text>
      </View>
    );
  }

  const headerOffset = insets.top + GLOBAL_HEADER_HEIGHT;

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? headerOffset : 0}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.contentContainer,
            { paddingTop: headerOffset },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>Repostear</Text>

          <Text style={styles.subtitle}>
            Añade un comentario opcional. Si lo dejas vacío, será un repost
            simple.
          </Text>

          {/* Nota opcional */}
          <TextInput
            placeholder="Agrega un comentario (opcional)…"
            placeholderTextColor="#999"
            multiline
            value={note}
            onChangeText={setNote}
            style={styles.noteInput}
          />

          {/* Preview ligera del post */}
          <View style={styles.previewCard}>
            {loadingPost ? (
              <View style={styles.previewCenter}>
                <ActivityIndicator />
                <Text style={styles.previewLoadingText}>
                  Cargando publicación…
                </Text>
              </View>
            ) : error ? (
              <View style={styles.previewCenter}>
                <Text style={styles.previewError}>{error}</Text>
              </View>
            ) : post ? (
              <>
                <Text style={styles.previewAuthor}>
                  @{post.authorUsername ||
                    post.user?.username ||
                    post.author?.username ||
                    "Usuario"}
                </Text>
                {post.content ? (
                  <Text
                    style={styles.previewContent}
                    numberOfLines={5}
                    ellipsizeMode="tail"
                  >
                    {post.content}
                  </Text>
                ) : (
                  <Text style={styles.previewContentMuted}>
                    (Publicación sin texto)
                  </Text>
                )}
              </>
            ) : (
              <View style={styles.previewCenter}>
                <Text style={styles.previewError}>
                  No se encontró la publicación.
                </Text>
              </View>
            )}
          </View>

          {/* Botones */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={() => router.back()}
              disabled={reposting}
              style={[styles.actionButton, styles.cancelButton]}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRepost}
              disabled={reposting}
              style={[
                styles.actionButton,
                styles.primaryButton,
                reposting && { opacity: 0.7 },
              ]}
            >
              {reposting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryText}>Repostear</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
    marginBottom: 8,
  },
  subtitle: {
    color: "#555",
    fontSize: 15,
    marginBottom: 16,
  },
  noteInput: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111",
    minHeight: 80,
    marginBottom: 16,
  },
  previewCard: {
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fafafa",
    minHeight: 120,
  },
  previewCenter: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
  },
  previewLoadingText: { marginTop: 6, color: "#555" },
  previewError: { color: "#d00" },
  previewAuthor: { fontWeight: "700", color: "#111", marginBottom: 6 },
  previewContent: { color: "#222", lineHeight: 20 },
  previewContentMuted: { color: "#777", fontStyle: "italic" },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 18,
  },
  actionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  cancelButton: {
    backgroundColor: "#f2f2f2",
  },
  primaryButton: {
    backgroundColor: "#111",
  },
  cancelText: { color: "#444", fontWeight: "600" },
  primaryText: { color: "#fff", fontWeight: "700" },
});
