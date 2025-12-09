// ======================================================
// 📄 app/(tabs)/profile.tsx — v6.3 FINAL (2025) [429 friendly]
// ======================================================

import { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
  Modal,
  ScrollView,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useUser } from "../../contexts/AuthContext";
import { getUserProfile, followUser, unfollowUser, api } from "../../services/api";
import FeedItemEnhanced from "../../components/FeedItemEnhanced";

type BasicUserListItem = {
  _id?: string;
  id?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user, loading, logout, updateUser, syncUserProfile } = useUser();

  const [profileData, setProfileData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 🔹 Estado para el modal de seguidores
  const [followersModalVisible, setFollowersModalVisible] = useState(false);
  const [followersList, setFollowersList] = useState<any[]>([]);

  // 🔹 Estado para el modal de "Siguiendo"
  const [followingModalVisible, setFollowingModalVisible] = useState(false);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const isFetchingProfile = useRef(false);
  const lastProfileFetch = useRef(0);

  // 🔹 Estado para botón Seguir / Dejar de seguir (ambos modales)
  const [followLoadingId, setFollowLoadingId] = useState<string | null>(null);
  const [localFollowingIds, setLocalFollowingIds] = useState<string[]>([]);

  // Helper para sacar un número seguro de counts o arrays
  const getSafeCount = (raw: any, fallbackArray?: any[]): number => {
    if (typeof raw === "number" && !Number.isNaN(raw)) return raw;

    if (typeof raw === "string") {
      const n = Number(raw);
      if (!Number.isNaN(n)) return n;
    }

    if (Array.isArray(fallbackArray)) return fallbackArray.length;
    return 0;
  };

  const extractId = (u: any): string | null => {
    if (!u) return null;
    if (typeof u === "string") return u;
    return u._id || u.id || null;
  };

  // ======================================================
  // 📥 Cargar perfil + publicaciones del usuario (UPDATE)
  // ======================================================
  const fetchUserProfile = useCallback(async () => {
    if (!user) return;
    const now = Date.now();
    if (isFetchingProfile.current) return;
    if (now - lastProfileFetch.current < 2500) return;

    try {
      isFetchingProfile.current = true;
      setLoadingPosts(true);

      const res = await getUserProfile(); // sin id → /users/me
      const payload: any = res?.data || res;

      const userFromPayload =
        payload?.user || payload?.data?.user || null;
      const postsFromPayload =
        payload?.data?.posts ||
        payload?.posts ||
        (Array.isArray(payload) ? payload : []) ||
        [];

      console.log(
        "👤 [ProfileScreen] getUserProfile() payload:",
        JSON.stringify(payload, null, 2)
      );

      if (userFromPayload) {
        const mergedUser = user ? { ...user, ...userFromPayload } : userFromPayload;

        console.log(
          "👤 [ProfileScreen] mergedUser:",
          JSON.stringify(
            {
              id: mergedUser._id || mergedUser.id,
              username: mergedUser.username,
              postsCount: mergedUser.postsCount,
              followersCount: mergedUser.followersCount,
              followingCount: mergedUser.followingCount,
              followersLen: Array.isArray(mergedUser.followers)
                ? mergedUser.followers.length
                : null,
              followingLen: Array.isArray(mergedUser.following)
                ? mergedUser.following.length
                : null,
            },
            null,
            2
          )
        );

        setProfileData(mergedUser);
        updateUser(mergedUser);

        // 🔄 Sincronizamos IDs que el usuario actual está siguiendo
        const followingArray = Array.isArray(mergedUser.following)
          ? mergedUser.following
          : [];
        const initialFollowingIds = followingArray
          .map(extractId)
          .filter((v: string | null): v is string => Boolean(v));
        setLocalFollowingIds(initialFollowingIds);

        const userPosts = postsFromPayload;

        let finalPosts = Array.isArray(userPosts) ? userPosts : [];

        // Fallback: si viene vacío pero hay postsCount > 0, intenta /posts/user/me
        if ((!finalPosts || finalPosts.length === 0) && mergedUser?._id) {
          try {
            const postsRes = await api.get("/posts/user/me");
            const fallbackPosts = postsRes?.data?.data || postsRes?.data || [];
            if (Array.isArray(fallbackPosts) && fallbackPosts.length) {
              finalPosts = fallbackPosts;
            }
          } catch (e) {
            console.warn("⚠️ Fallback posts/me falló:", e);
          }
        }

        setPosts(finalPosts);
      } else {
        console.log(
          "⚠️ [ProfileScreen] getUserProfile() sin user en payload, usando contexto."
        );
        setProfileData(user);
        const fallbackPosts =
          Array.isArray(payload?.data?.posts)
            ? payload.data.posts
            : Array.isArray(payload?.posts)
            ? payload.posts
            : Array.isArray(payload)
            ? payload
            : [];
        setPosts(fallbackPosts);
        if (payload?.user) updateUser(payload.user);
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.message || "Error al obtener perfil";

      if (status === 429) {
        // ⛔ Nada de console.error ni Alert para 429 (rate limit controlado)
        console.warn(
          "⚠️ Rate limit al cargar perfil (429). Reintentando luego.",
          msg
        );
      } else {
        const isServerError = typeof status === "number" && status >= 500;
        const logFn = isServerError ? console.warn : console.error;

        logFn("❌ Error al obtener perfil:", msg, err?.response?.data);

        const alertMessage = isServerError
          ? "El servidor está en mantenimiento. Intenta de nuevo en unos minutos."
          : "No se pudo cargar tu perfil. Verifica tu conexión o sesión.";
        Alert.alert(
          "Error",
          alertMessage
        );
      }
    } finally {
      lastProfileFetch.current = Date.now();
      isFetchingProfile.current = false;
      setLoadingPosts(false);
    }
  }, [user, updateUser]);

  // Primera carga cuando ya tenemos user
  useEffect(() => {
    if (user) fetchUserProfile();
  }, [user, fetchUserProfile]);

  // 🔁 Refetch cada vez que esta pestaña vuelve a estar enfocada
  useFocusEffect(
    useCallback(() => {
      if (user) fetchUserProfile();
    }, [user, fetchUserProfile])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUserProfile();
    setRefreshing(false);
  };

  // ======================================================
  // 🚪 Logout
  // ======================================================
  const handleLogout = async () => {
    try {
      await logout();
    } catch (err) {
      console.error("❌ Error al cerrar sesión:", err);
    }
  };

  // ======================================================
  // ✏️ Editar perfil
  // ======================================================
  const handleEdit = () => {
    router.push("/profile/EditProfile"); // ✅ Ruta correcta
  };

  // ======================================================
  // 🔍 Abrir modal de seguidores
  // ======================================================
  const handleOpenFollowersModal = () => {
    const display = profileData || user;
    const rawFollowers = Array.isArray(display?.followers)
      ? display.followers
      : [];

    const normalized = rawFollowers
      .map((f: any): BasicUserListItem | null => {
        if (!f) return null;
        if (typeof f === "string") {
          return {
            _id: f,
            id: f,
            username: f,
            firstName: "",
            lastName: "",
            avatarUrl:
              "https://cdn-icons-png.flaticon.com/512/1077/1077012.png",
          };
        }
        return {
          _id: f._id || f.id,
          id: f._id || f.id,
          username: f.username || "",
          firstName: f.firstName || "",
          lastName: f.lastName || "",
          avatarUrl:
            f.avatarUrl ||
            "https://cdn-icons-png.flaticon.com/512/1077/1077012.png",
        };
      })
      .filter(
        (v: BasicUserListItem | null): v is BasicUserListItem =>
          Boolean(v)
      );

    setFollowersList(normalized);
    setFollowersModalVisible(true);
  };

  // ======================================================
  // 🔍 Abrir modal de "Siguiendo"
  // ======================================================
  const handleOpenFollowingModal = () => {
    const display = profileData || user;
    const rawFollowing = Array.isArray(display?.following)
      ? display.following
      : [];

    const normalized = rawFollowing
      .map((f: any): BasicUserListItem | null => {
        if (!f) return null;
        if (typeof f === "string") {
          return {
            _id: f,
            id: f,
            username: f,
            firstName: "",
            lastName: "",
            avatarUrl:
              "https://cdn-icons-png.flaticon.com/512/1077/1077012.png",
          };
        }
        return {
          _id: f._id || f.id,
          id: f._id || f.id,
          username: f.username || "",
          firstName: f.firstName || "",
          lastName: f.lastName || "",
          avatarUrl:
            f.avatarUrl ||
            "https://cdn-icons-png.flaticon.com/512/1077/1077012.png",
        };
      })
      .filter(
        (v: BasicUserListItem | null): v is BasicUserListItem =>
          Boolean(v)
      );

    setFollowingList(normalized);
    setFollowingModalVisible(true);
  };

  // ======================================================
  // 👤 Abrir perfil de un seguidor / seguido al tocar su nombre
  // ======================================================
  const handleOpenUserProfileFromModal = (u: any) => {
    const uid = extractId(u);
    if (!uid) return;

    setFollowersModalVisible(false);
    setFollowingModalVisible(false);

    router.push(`/profile/${uid}`);
  };

  // ======================================================
  // 🔁 Seguir / Dejar de seguir desde los modales
  // ======================================================
  const handleToggleFollow = async (target: any) => {
    const targetId = extractId(target);
    if (!targetId) return;

    try {
      setFollowLoadingId(targetId);

      const isFollowing = localFollowingIds.includes(targetId);

      if (isFollowing) {
        await unfollowUser(targetId);
      } else {
        await followUser(targetId);
      }

      setLocalFollowingIds((prev) => {
        const arr = prev || [];
        if (isFollowing) {
          return arr.filter((id) => id !== targetId);
        } else {
          if (arr.includes(targetId)) return arr;
          return [...arr, targetId];
        }
      });

      await fetchUserProfile();
      await syncUserProfile();
    } catch (err) {
      console.error("❌ Error al cambiar follow:", err);
      Alert.alert(
        "Error",
        "No se pudo actualizar el estado de seguimiento. Inténtalo de nuevo."
      );
    } finally {
      setFollowLoadingId(null);
    }
  };

  const handlePostDeleted = useCallback((deletedId: string) => {
    setPosts((prev) =>
      prev.filter((p) => {
        const pid =
          p.__baseId || p._id || p.id || p.postId || p.newsId || "";
        return String(pid) !== String(deletedId);
      })
    );

    setProfileData((prev: any) => {
      if (!prev) return prev;
      const currentCount = getSafeCount(prev.postsCount, posts);
      return {
        ...prev,
        postsCount: Math.max(currentCount - 1, 0),
      };
    });
  }, [posts]);

  // ======================================================
  // 🌀 Estado de carga global (auth o usuario)
  // ======================================================
  if (loading || !user) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  const display = profileData || user;

  // Valores seguros para stats:
  const postsCount = getSafeCount(display.postsCount, posts);
  const followersCount = getSafeCount(
    display.followersCount,
    display.followers
  );
  const followingCount = getSafeCount(
    display.followingCount,
    display.following
  );

  const renderFollowRow = (person: any) => {
    const pid = extractId(person);
    const isFollowing = pid ? localFollowingIds.includes(pid) : false;

    const displayName =
      person.firstName || person.lastName
        ? `${person.firstName || ""} ${person.lastName || ""}`.trim()
        : person.username || "Usuario";

    return (
      <View
        style={styles.followerItem}
        key={pid || person.username || Math.random().toString(36)}
      >
        <TouchableOpacity
          style={styles.followerInfo}
          onPress={() => handleOpenUserProfileFromModal(person)}
          activeOpacity={0.7}
        >
          <Image
            source={{
              uri:
                person.avatarUrl ||
                "https://cdn-icons-png.flaticon.com/512/1077/1077012.png",
            }}
            style={styles.followerAvatar}
          />
          <View>
            <Text style={styles.followerName}>{displayName}</Text>
            <Text style={styles.followerUsername}>
              @{person.username || pid}
            </Text>
          </View>
        </TouchableOpacity>

        {pid && pid !== (display._id || display.id) && (
          <TouchableOpacity
            style={[
              styles.followButton,
              isFollowing ? styles.followButtonActive : styles.followButtonInactive,
            ]}
            onPress={() => handleToggleFollow(person)}
            disabled={followLoadingId === pid}
          >
            {followLoadingId === pid ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.followButtonText}>
                {isFollowing ? "Dejar de seguir" : "Seguir"}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ======================================================
  // 🧱 Render principal
  // ======================================================
  return (
    <>
      <FlatList
        data={posts}
        keyExtractor={(item, index) =>
          String(item?._id || item?.id || `post-${index}`)
        }
        ListHeaderComponent={
          <>
            {/* PORTADA + AVATAR */}
            <View style={styles.header}>
              <Image
                source={{
                  uri:
                    display.backgroundUrl ||
                    "https://picsum.photos/800/300?blur=2",
                }}
                style={styles.background}
              />
              <View style={styles.avatarBox}>
                <Image
                  source={{
                    uri:
                      display.avatarUrl ||
                      "https://cdn-icons-png.flaticon.com/512/1077/1077012.png",
                  }}
                  style={styles.avatar}
                />
              </View>
            </View>

            {/* INFO PERFIL */}
            <View style={styles.infoBox}>
              <Text style={styles.name}>
                {display.firstName} {display.lastName}
              </Text>
              <Text style={styles.username}>@{display.username}</Text>

              {display.bio ? (
                <Text style={styles.bio}>{display.bio}</Text>
              ) : (
                <Text style={styles.bioEmpty}>Agrega una biografía 📝</Text>
              )}

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#007bff" }]}
                  onPress={handleEdit}
                >
                  <Text style={styles.btnText}>Editar perfil</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#f33" }]}
                  onPress={handleLogout}
                >
                  <Text style={styles.btnText}>Cerrar sesión</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ESTADÍSTICAS */}
            <View style={styles.statsBox}>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{postsCount}</Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>

              <TouchableOpacity
                style={styles.stat}
                onPress={handleOpenFollowersModal}
                activeOpacity={0.7}
              >
                <Text style={styles.statNumber}>{followersCount}</Text>
                <Text style={[styles.statLabel, styles.statLabelLink]}>
                  Seguidores
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stat}
                onPress={handleOpenFollowingModal}
                activeOpacity={0.7}
              >
                <Text style={styles.statNumber}>{followingCount}</Text>
                <Text style={[styles.statLabel, styles.statLabelLink]}>
                  Siguiendo
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Tus publicaciones</Text>
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <FeedItemEnhanced
            item={item}
            isVisible={true}
            nextItem={posts[index + 1]}
            onDeleted={handlePostDeleted}
          />
        )}
        ListEmptyComponent={
          loadingPosts ? (
            <ActivityIndicator
              size="large"
              color="#007bff"
              style={{ marginVertical: 50 }}
            />
          ) : (
            <Text style={styles.emptyPosts}>
              Aún no tienes publicaciones.
            </Text>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      {/* MODAL SEGUIDORES */}
      <Modal
        visible={followersModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFollowersModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Seguidores</Text>
              <TouchableOpacity
                onPress={() => setFollowersModalVisible(false)}
              >
                <Text style={styles.modalClose}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalList}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {followersList.length === 0 ? (
                <Text style={styles.modalEmpty}>
                  Aún no tienes seguidores.
                </Text>
              ) : (
                followersList.map(renderFollowRow)
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* MODAL SIGUIENDO */}
      <Modal
        visible={followingModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setFollowingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Siguiendo</Text>
              <TouchableOpacity
                onPress={() => setFollowingModalVisible(false)}
              >
                <Text style={styles.modalClose}>Cerrar</Text>
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalList}
              contentContainerStyle={{ paddingBottom: 24 }}
              keyboardShouldPersistTaps="handled"
            >
              {followingList.length === 0 ? (
                <Text style={styles.modalEmpty}>
                  Aún no sigues a nadie.
                </Text>
              ) : (
                followingList.map(renderFollowRow)
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ======================================================
// 💅 Estilos
// ======================================================
const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { position: "relative", marginBottom: 0 },
  background: { width: "100%", height: 420 },
  avatarBox: { position: "absolute", bottom: 10, left: 20 },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: "#fff",
  },
  infoBox: { marginTop: 0, paddingHorizontal: 20 },
  name: { fontSize: 22, fontWeight: "700", color: "#111" },
  username: { fontSize: 16, color: "#666", marginBottom: 20 },
  bio: { fontSize: 15, color: "#333", lineHeight: 20, marginBottom: 20 },
  bioEmpty: {
    fontSize: 15,
    color: "#999",
    fontStyle: "italic",
    marginBottom: 20,
  },
  actions: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 18,
    alignItems: "center",
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  statsBox: {
    flexDirection: "row",
    justifyContent: "space-around",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#eee",
    paddingVertical: 15,
    marginTop: 15,
  },
  stat: { alignItems: "center" },
  statNumber: { fontWeight: "700", fontSize: 18, color: "#111" },
  statLabel: { fontSize: 13, color: "#666" },
  statLabelLink: {
    textDecorationLine: "underline",
  },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 10 },
  sectionTitle: { fontWeight: "700", fontSize: 18, color: "#111" },
  emptyPosts: {
    textAlign: "center",
    color: "#999",
    fontSize: 15,
    marginTop: 40,
  },

  // ---------- Modal seguidores / siguiendo ----------
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: "75%",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 64,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111",
  },
  modalClose: {
    fontSize: 15,
    color: "#007bff",
    fontWeight: "600",
  },
  modalList: {
    marginTop: 14,
  },
  modalEmpty: {
    textAlign: "center",
    color: "#999",
    marginTop: 20,
    fontSize: 14,
  },
  followerItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#eee",
  },
  followerInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  followerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  followerName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111",
  },
  followerUsername: {
    fontSize: 13,
    color: "#666",
  },
  followButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  followButtonActive: {
    backgroundColor: "#e53935",
  },
  followButtonInactive: {
    backgroundColor: "#007bff",
  },
  followButtonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
