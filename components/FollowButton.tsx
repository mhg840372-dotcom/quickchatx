// 📁 src/components/FollowButton.tsx

import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useAuth } from "../hooks/useAuth";
import { followUser, getFollowState, unfollowUser } from "../services/api";

type FollowButtonProps = {
  targetUserId: string;
};

export default function FollowButton({ targetUserId }: FollowButtonProps) {
  const { token } = useAuth();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [counts, setCounts] = useState<{
    followersCount?: number;
    followingCount?: number;
  }>({});

  useEffect(() => {
    let mounted = true;
    const fetchState = async () => {
      if (!token || !targetUserId) {
        setInitialLoading(false);
        return;
      }
      try {
        const data = await getFollowState(targetUserId);
        if (!mounted) return;

        setFollowing(!!data.following);
        setCounts({
          followersCount: data.followersCount,
          followingCount: data.followingCount,
        });
      } catch (err) {
        console.warn("⚠️ Error al obtener follow-state:", err);
      } finally {
        if (mounted) setInitialLoading(false);
      }
    };

    fetchState();
    return () => {
      mounted = false;
    };
  }, [token, targetUserId]);

  const toggleFollow = async () => {
    if (!token || !targetUserId || loading) return;
    setLoading(true);

    try {
      if (following) {
        const res = await unfollowUser(targetUserId);
        setFollowing(false);
        if (typeof res.followersCount === "number") {
          setCounts((prev) => ({
            ...prev,
            followersCount: res.followersCount,
          }));
        }
      } else {
        const res = await followUser(targetUserId);
        setFollowing(true);
        if (typeof res.followersCount === "number") {
          setCounts((prev) => ({
            ...prev,
            followersCount: res.followersCount,
          }));
        }
      }
    } catch (err) {
      console.warn("⚠️ Error al cambiar follow:", err);
    } finally {
      setLoading(false);
    }
  };

  if (!token) return null; // si no hay sesión, no mostramos botón

  if (initialLoading) {
    return (
      <View style={styles.loadingPill}>
        <ActivityIndicator size="small" color="#000" />
      </View>
    );
  }

  // Si todavía no sabemos el estado, lo tratamos como no-following
  const isFollowing = !!following;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, isFollowing ? styles.buttonFollowing : styles.buttonFollow]}
        activeOpacity={0.8}
        onPress={toggleFollow}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color={isFollowing ? "#000" : "#fff"} />
        ) : (
          <Text style={[styles.text, isFollowing ? styles.textFollowing : styles.textFollow]}>
            {isFollowing ? "Siguiendo" : "Seguir"}
          </Text>
        )}
      </TouchableOpacity>

      {typeof counts.followersCount === "number" && (
        <Text style={styles.followersText}>
          {counts.followersCount} seguidores
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "flex-start",
    gap: 4,
  },
  loadingPill: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#eee",
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  buttonFollow: {
    backgroundColor: "#000",
    borderColor: "#000",
  },
  buttonFollowing: {
    backgroundColor: "#fff",
    borderColor: "#ccc",
  },
  text: {
    fontSize: 14,
    fontWeight: "600",
  },
  textFollow: {
    color: "#fff",
  },
  textFollowing: {
    color: "#000",
  },
  followersText: {
    fontSize: 12,
    color: "#666",
  },
});
