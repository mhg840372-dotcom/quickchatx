// ======================================================
// 📄 app/profile/[id].tsx — v5.0 STABLE (2025)
// ------------------------------------------------------
// 👤 Perfil público de otro usuario (no editable)
// ✅ Carga perfil real desde /api/posts/user/:id o /users/:id (api.ts)
// ✅ Muestra posts del usuario
// ✅ Diseño igual al perfil personal
// ✅ Compatibilidad total con getUserProfile v13.8
// ✅ Integrado con sistema FOLLOW (getFollowState / follow / unfollow)
// ======================================================

import { useEffect, useState, useCallback } from "react";
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
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  getUserProfile,
  getFollowState,
  followUser as followUserApi,
  unfollowUser as unfollowUserApi,
} from "@/services/api";
import FeedItemEnhanced from "@/components/FeedItemEnhanced";
import { useUser } from "@/contexts/AuthContext";
import GlobalHeader, { GLOBAL_HEADER_HEIGHT } from "@/components/GlobalHeader";
import { resolveAvatarUrl } from "@/utils/avatar";

export default function PublicProfileScreen() {
  const params = useLocalSearchParams();
  const { user: currentUser } = useUser();
  const insets = useSafeAreaInsets();

  // 🔧 Normalizar ID de la ruta (string | string[] → string | undefined)
  const profileId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
      ? params.id[0]
      : undefined;

  const isOwnProfile =
    !!currentUser &&
    profileId &&
    (String(currentUser._id || currentUser.id) === String(profileId));

  const [profileData, setProfileData] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // 👥 estados de follow
  const [isFollowing, setIsFollowing] = useState<boolean | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [followingCount, setFollowingCount] = useState<number | null>(null);

  // ======================================================
  // 📥 Cargar perfil del usuario por ID
  // ======================================================
  const fetchProfile = useCallback(async () => {
    if (!profileId) return;
    try {
      setLoadingProfile(true);

      const res = await getUserProfile(String(profileId));
      const data = (res as any)?.data || res;

      let userObj: any;
      let userPosts: any[] = [];

      if (data?.user) {
        userObj = data.user;
        userPosts = data.data?.posts || data.posts || [];
      } else {
        userObj = data;
        userPosts = data.data || data.posts || [];
      }

      setProfileData(userObj);
      setPosts(Array.isArray(userPosts) ? userPosts : []);

      // Inferir contadores si vienen en el user o como arrays
      const inferredFollowers =
        typeof userObj.followersCount === "number"
          ? userObj.followersCount
          : Array.isArray(userObj.followers)
          ? userObj.followers.length
          : null;

      const inferredFollowing =
        typeof userObj.followingCount === "number"
          ? userObj.followingCount
          : Array.isArray(userObj.following)
          ? userObj.following.length
          : null;

      setFollowersCount(inferredFollowers);
      setFollowingCount(inferredFollowing);

      // Si el backend ya manda isFollowing, lo usamos como hint inicial
      if (typeof userObj.isFollowing === "boolean") {
        setIsFollowing(userObj.isFollowing);
      }
    } catch (err) {
      console.error("❌ Error al obtener perfil:", err);
      Alert.alert(
        "Error",
        "No se pudo cargar el perfil. Verifica tu conexión o que el usuario exista."
      );
    } finally {
      setLoadingProfile(false);
    }
  }, [profileId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // ======================================================
  // 🔁 Cargar estado de follow desde /users/:id/follow-state
  // ======================================================
  const loadFollowState = useCallback(async () => {
    if (!profileId || !currentUser || isOwnProfile) return;

    try {
      const res = await getFollowState(String(profileId));
      const payload: any = (res as any)?.data || res || {};

      const followingVal =
        typeof payload.following === "boolean"
          ? payload.following
          : typeof payload.isFollowing === "boolean"
          ? payload.isFollowing
          : null;

      if (followingVal !== null) setIsFollowing(followingVal);

      // Followers
      let newFollowers: number | null = followersCount;
      if (typeof payload.followersCount === "number") {
        newFollowers = payload.followersCount;
      } else if (
        payload.target &&
        (typeof payload.target.followersCount === "number" ||
          Array.isArray(payload.target.followers))
      ) {
        if (typeof payload.target.followersCount === "number") {
          newFollowers = payload.target.followersCount;
        } else if (Array.isArray(payload.target.followers)) {
          newFollowers = payload.target.followers.length;
        }
      }
      if (typeof newFollowers === "number") {
        setFollowersCount(newFollowers);
      }

      // Following (del usuario actual)
      let newFollowing: number | null = followingCount;
      if (typeof payload.followingCount === "number") {
        newFollowing = payload.followingCount;
      } else if (
        payload.me &&
        (typeof payload.me.followingCount === "number" ||
          Array.isArray(payload.me.following))
      ) {
        if (typeof payload.me.followingCount === "number") {
          newFollowing = payload.me.followingCount;
        } else if (Array.isArray(payload.me.following)) {
          newFollowing = payload.me.following.length;
        }
      }
      if (typeof newFollowing === "number") {
        setFollowingCount(newFollowing);
      }
    } catch (err: any) {
      console.warn(
        "⚠️ No se pudo cargar follow-state:",
        err?.message || err
      );
      // no rompemos nada si falla
    }
  }, [profileId, currentUser, isOwnProfile, followersCount, followingCount]);

  useEffect(() => {
    if (!profileId || !currentUser || isOwnProfile) return;
    loadFollowState();
  }, [profileId, currentUser, isOwnProfile, loadFollowState]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProfile();
    await loadFollowState();
    setRefreshing(false);
  };

  // ======================================================
  // 👥 Handler seguir / dejar de seguir
  // ======================================================
  const handleToggleFollow = async () => {
    if (!profileId || !currentUser || followLoading) return;
    if (isOwnProfile) return;

    try {
      setFollowLoading(true);
      const currentlyFollowing = !!isFollowing;

      if (!currentlyFollowing) {
        // 👉 SEGUIR
        const res = await followUserApi(String(profileId));
        const payload: any = (res as any)?.data || res || {};

        const followingVal =
          typeof payload.following === "boolean"
            ? payload.following
            : true;
        setIsFollowing(followingVal);

        let newFollowers: number | null = followersCount;
        if (typeof payload.followersCount === "number") {
          newFollowers = payload.followersCount;
        } else if (
          payload.target &&
          (typeof payload.target.followersCount === "number" ||
            Array.isArray(payload.target.followers))
        ) {
          if (typeof payload.target.followersCount === "number") {
            newFollowers = payload.target.followersCount;
          } else if (Array.isArray(payload.target.followers)) {
            newFollowers = payload.target.followers.length;
          }
        } else if (typeof followersCount === "number") {
          newFollowers = followersCount + 1;
        }
        if (typeof newFollowers === "number") {
          setFollowersCount(newFollowers);
        }
      } else {
        // 👉 DEJAR DE SEGUIR
        const res = await unfollowUserApi(String(profileId));
        const payload: any = (res as any)?.data || res || {};

        const followingVal =
          typeof payload.following === "boolean"
            ? payload.following
            : false;
        setIsFollowing(followingVal);

        let newFollowers: number | null = followersCount;
        if (typeof payload.followersCount === "number") {
          newFollowers = payload.followersCount;
        } else if (
          payload.target &&
          (typeof payload.target.followersCount === "number" ||
            Array.isArray(payload.target.followers))
        ) {
          if (typeof payload.target.followersCount === "number") {
            newFollowers = payload.target.followersCount;
          } else if (Array.isArray(payload.target.followers)) {
            newFollowers = payload.target.followers.length;
          }
        } else if (typeof followersCount === "number") {
          newFollowers = Math.max(0, followersCount - 1);
        }
        if (typeof newFollowers === "number") {
          setFollowersCount(newFollowers);
        }
      }
    } catch (err: any) {
      console.error("❌ Error en follow/unfollow:", err);
      Alert.alert(
        "Error",
        "No se pudo actualizar el estado de seguimiento en este momento."
      );
    } finally {
      setFollowLoading(false);
    }
  };

  // ======================================================
  // 🌀 Estados de carga / error
  // ======================================================
  if (loadingProfile && !profileData) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  if (!profileData) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: "#666" }}>Perfil no encontrado ❌</Text>
      </View>
    );
  }

  // ======================================================
  // 🧱 Render principal
  // ======================================================
  const finalFollowers =
    followersCount ??
    profileData.followersCount ??
    (Array.isArray(profileData.followers)
      ? profileData.followers.length
      : 0);

  const finalFollowing =
    followingCount ??
    profileData.followingCount ??
    (Array.isArray(profileData.following)
      ? profileData.following.length
      : 0);

  const headerOffset = insets.top + GLOBAL_HEADER_HEIGHT;
  const defaultAvatar = "https://cdn-icons-png.flaticon.com/512/1077/1077012.png";
  const avatarUri = resolveAvatarUrl(
    profileData.avatarUrl ||
      profileData.avatar ||
      (profileData as any)?.profilePhoto ||
      profileData.image ||
      profileData.imageUrl,
    defaultAvatar
  ) || defaultAvatar;
  const backgroundUri =
    profileData.backgroundUrl ||
    profileData.background ||
    profileData.coverUrl ||
    profileData.cover ||
    "https://picsum.photos/800/300?blur=2";

  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <GlobalHeader />
      <FlatList
        data={posts}
        keyExtractor={(item) =>
          String(item._id || item.id || `${item.createdAt || Math.random()}`)
        }
        ListHeaderComponent={
          <>
            {/* ========================= */}
            {/*     PORTADA + AVATAR      */}
            {/* ========================= */}
            <View style={styles.header}>
              <Image
                source={{
                  uri: backgroundUri,
                }}
                style={styles.background}
              />
              <View style={styles.avatarBox}>
                <Image
                  source={{
                    uri: avatarUri,
                  }}
                  style={styles.avatar}
                />
              </View>
            </View>

            {/* ========================= */}
            {/*       INFO PERFIL         */}
            {/* ========================= */}
            <View style={styles.infoBox}>
              <Text style={styles.name}>
                {profileData.firstName} {profileData.lastName}
              </Text>
              <Text style={styles.username}>@{profileData.username}</Text>

              {profileData.bio ? (
                <Text style={styles.bio}>{profileData.bio}</Text>
              ) : (
                <Text style={styles.bioEmpty}>Sin biografía 📝</Text>
              )}

              {/* Botón seguir solo si NO es tu perfil */}
              {!isOwnProfile && (
                <TouchableOpacity
                  style={[
                    styles.btn,
                    {
                      backgroundColor: isFollowing ? "#fff" : "#007bff",
                      borderWidth: 1,
                      borderColor: "#007bff",
                      marginTop: 10,
                    },
                  ]}
                  onPress={handleToggleFollow}
                  disabled={followLoading}
                >
                  <Text
                    style={[
                      styles.btnText,
                      { color: isFollowing ? "#007bff" : "#fff" },
                    ]}
                  >
                    {followLoading
                      ? "..."
                      : isFollowing
                      ? "Siguiendo"
                      : "Seguir"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* ========================= */}
            {/*     ESTADÍSTICAS (OPC)    */}
            {/* ========================= */}
            <View style={styles.statsBox}>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>
                  {profileData.postsCount ?? posts.length}
                </Text>
                <Text style={styles.statLabel}>Posts</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{finalFollowers}</Text>
                <Text style={styles.statLabel}>Seguidores</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNumber}>{finalFollowing}</Text>
                <Text style={styles.statLabel}>Siguiendo</Text>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Publicaciones de {profileData.firstName || "usuario"}
              </Text>
            </View>
          </>
        }
        renderItem={({ item, index }) => (
          <View style={styles.postWrapper}>
            <FeedItemEnhanced
              item={item}
              isVisible={true}
              nextItem={posts[index + 1]}
            />
          </View>
        )}
        ListEmptyComponent={
          loadingProfile ? (
            <ActivityIndicator
              size="large"
              color="#007bff"
              style={{ marginVertical: 50 }}
            />
          ) : (
            <Text style={styles.emptyPosts}>Aún no tiene publicaciones.</Text>
          )
        }
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          paddingBottom: 100,
          paddingTop: headerOffset,
        }}
      />
    </View>
  );
}

// ======================================================
// 💅 Estilos
// ======================================================
const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    position: "relative",
    marginBottom: 0,
  },
  background: {
    width: "100%",
    height: 280,
  },
  avatarBox: {
    position: "absolute",
    bottom: 10,
    left: 20,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 15,
    borderWidth: 3,
    borderColor: "#fff",
  },
  infoBox: {
    marginTop: 0,
    paddingHorizontal: 20,
  },
  name: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111",
  },
  username: {
    fontSize: 16,
    color: "#666",
    marginBottom: 8,
  },
  bio: {
    fontSize: 15,
    color: "#333",
    lineHeight: 20,
    marginBottom: 20,
  },
  bioEmpty: {
    fontSize: 15,
    color: "#999",
    fontStyle: "italic",
    marginBottom: 20,
  },
  btn: {
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  btnText: {
    fontWeight: "700",
    fontSize: 15,
  },
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
  sectionHeader: {
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontWeight: "700",
    fontSize: 18,
    color: "#111",
  },
  // 🔹 wrapper para separar los posts de los bordes de pantalla
  postWrapper: {
    paddingHorizontal: 6,
    marginBottom: 2,
  },
  emptyPosts: {
    textAlign: "center",
    color: "#999",
    fontSize: 15,
    marginTop: 40,
    marginHorizontal: 20,
  },
});
