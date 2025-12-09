// ======================================================
// 📄 app/(tabs)/profile/EditProfile.tsx — v15.1 FULL SYNC (2025)
// ------------------------------------------------------
// ✔ Compatible con api.ts v15.0 (URL + DOMINIO, avatarData/backgroundData)
// ✔ updateUserProfile(data, avatarData?, backgroundData?)
// ✔ Solo sube imagen si la URI es local (file:// / content://)
// ✔ avatarUrl + backgroundUrl se actualizan desde la respuesta de la API
// ✔ Sin MediaTypeOptions (no hay warning en expo-image-picker)
// ✔ EMITE evento global userProfileUpdated → feed se actualiza en caliente
// ======================================================

import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { ImagePickerAsset, ImagePickerOptions } from "expo-image-picker";
import { useRouter } from "expo-router";
import { updateUserProfile } from "@/services/api";
import { useUser } from "../../contexts/AuthContext";
import { emitUserProfileUpdated } from "../../utils/feedEvents";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import GlobalHeader, { GLOBAL_HEADER_HEIGHT } from "@/components/GlobalHeader";

// 🔧 Helper: mediaTypes solo IMÁGENES con la API nueva de expo-image-picker
// - Usa ImagePicker.MediaType.image cuando existe
// - En SDKs viejos deja undefined para que use el default
// - IMPORTANTE: NO usa MediaTypeOptions para evitar el warning
const getImageMediaType = () => {
  const anyPicker: any = ImagePicker;
  return anyPicker.MediaType?.image ?? undefined;
};

export default function EditProfile() {
  const router = useRouter();
  const { user, updateUser } = useUser();
  const insets = useSafeAreaInsets();
  const headerOffset = insets.top + GLOBAL_HEADER_HEIGHT;

  // ======================================================
  // 🧠 Estados iniciales sincronizados con el usuario
  // ======================================================
  const [firstName, setFirstName] = useState(user?.firstName || "");
  const [lastName, setLastName] = useState(user?.lastName || "");
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");

  const [avatar, setAvatar] = useState<string | null>(user?.avatarUrl || null);
  const [background, setBackground] = useState<string | null>(
    user?.backgroundUrl || null
  );

  const [saving, setSaving] = useState(false);

  // ======================================================
  // 📸 Seleccionar imagen (avatar o background)
  //   - Sin MediaTypeOptions → no hay warning
  // ======================================================
  const pickImage = async (type: "avatar" | "background") => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "Permisos requeridos",
          "Activa el acceso a la galería en los ajustes del dispositivo."
        );
        return;
      }

      const mediaType = getImageMediaType();

      const options: ImagePickerOptions = {
        allowsEditing: true,
        quality: 0.9,
      };

      if (mediaType) {
        // solo lo seteamos si existe → evita crasheos/warnings en SDKs viejos
        (options as any).mediaTypes = mediaType;
      }

      const result = await ImagePicker.launchImageLibraryAsync(
        options as any
      );

      if (result.canceled || !result.assets?.length) return;

      const asset: ImagePickerAsset = result.assets[0];
      const uri = asset.uri;
      console.log("📷 EditProfile pickImage asset:", {
        type,
        uri,
        assetType: asset.type,
      });

      if (!uri) {
        Alert.alert("Error", "No se obtuvo la URI de la imagen seleccionada.");
        return;
      }

      if (type === "avatar") setAvatar(uri);
      else setBackground(uri);
    } catch (err) {
      console.log("❌ Error al seleccionar imagen:", err);
      Alert.alert("Error", "No se pudo seleccionar la imagen.");
    }
  };

  // ======================================================
  // 💾 Guardar cambios
  // ======================================================
  const handleSave = async () => {
    if (!username.trim()) {
      return Alert.alert("Error", "El nombre de usuario es obligatorio.");
    }

    try {
      setSaving(true);

      // 👤 Payload coherente con api.ts v15.0
      const data = {
        firstName: firstName || "",
        lastName: lastName || "",
        username: username.trim(),
        bio: bio || "",
      };

      // Solo enviar archivo si es NUEVO (uri local: file:// o content://)
      const avatarData =
        avatar &&
        (avatar.startsWith("file://") || avatar.startsWith("content://"))
          ? { uri: avatar, name: "avatar.jpg", type: "image/jpeg" }
          : undefined;

      const backgroundData =
        background &&
        (background.startsWith("file://") || background.startsWith("content://"))
          ? { uri: background, name: "background.jpg", type: "image/jpeg" }
          : undefined;

      const avatarChanged = Boolean(avatarData);
      const backgroundChanged = Boolean(backgroundData);

      console.log("💾 EditProfile → enviando a updateUserProfile:", {
        data,
        avatarData,
        backgroundData,
      });

      const res = await updateUserProfile(data, avatarData, backgroundData);

      // api.ts ya normaliza avatarUrl / backgroundUrl con resolveImage(BASE_URL)
      const updated = res.user || res.data?.user || res;

      const nextAvatar = avatarChanged
        ? updated.avatarUrl ?? user?.avatarUrl ?? avatar ?? null
        : user?.avatarUrl ?? avatar ?? updated.avatarUrl ?? null;

      const nextBackground = backgroundChanged
        ? updated.backgroundUrl ?? user?.backgroundUrl ?? background ?? null
        : user?.backgroundUrl ?? background ?? updated.backgroundUrl ?? null;

      // ======================================================
      // 🧠 Sincronizar AuthContext con lo que devuelve la API
      // ======================================================
      updateUser({
        ...(user || {}),
        firstName: updated.firstName,
        lastName: updated.lastName,
        username: updated.username,
        bio: updated.bio,
        avatarUrl: nextAvatar,
        backgroundUrl: nextBackground,
      });

      emitUserProfileUpdated({
        userId: String(updated._id || updated.id || user?._id || user?.id || ""),
        username: updated.username,
        avatarUrl: nextAvatar || undefined,
      });

      // ======================================================
      // 📡 Avisar al Feed que el perfil cambió (avatar/nombre)
      // ======================================================
      const userId =
        String(updated._id || updated.id || user?._id || user?.id || "");

      if (userId) {
        const fullName =
          (updated.firstName || updated.lastName) &&
          `${updated.firstName || ""} ${updated.lastName || ""}`.trim();

        emitUserProfileUpdated({
          userId,
          username: updated.username || username.trim(),
          name: fullName || undefined,
          avatarUrl: nextAvatar || undefined,
        });
      }

      Alert.alert("Perfil actualizado", "Tus cambios fueron guardados.");
      router.back();
    } catch (err) {
      console.log("❌ updateProfile error:", err);
      Alert.alert("Error", "No se pudo actualizar el perfil.");
    } finally {
      setSaving(false);
    }
  };

  // ======================================================
  // 🧱 Render UI
  // ======================================================
  return (
    <View style={{ flex: 1, backgroundColor: "#fff" }}>
      <GlobalHeader />
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingTop: headerOffset, paddingBottom: 40 }}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => pickImage("background")}>
            <Image
              source={{
                uri: background || "https://picsum.photos/600/200",
              }}
              style={styles.background}
            />
            <Text style={styles.changeBackground}>Cambiar fondo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={() => pickImage("avatar")}
          >
            <Image
              source={{
                uri:
                  avatar ||
                  "https://cdn-icons-png.flaticon.com/512/1077/1077012.png",
              }}
              style={styles.avatar}
            />
            <Text style={styles.changeAvatar}>Cambiar foto</Text>
          </TouchableOpacity>
        </View>

        {/* FORM */}
        <View style={styles.form}>
          <Text style={styles.label}>Nombre</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Tu nombre"
          />

          <Text style={styles.label}>Apellido</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Tu apellido"
          />

          <Text style={styles.label}>Nombre de usuario</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            placeholder="@usuario"
            autoCapitalize="none"
          />

          <Text style={styles.label}>Biografía</Text>
          <TextInput
            style={[styles.input, { height: 80 }]}
            value={bio}
            onChangeText={setBio}
            multiline
            placeholder="Cuenta algo sobre ti..."
          />

          <TouchableOpacity
            style={[styles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Guardar cambios</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ======================================================
// 💅 Styles
// ======================================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { position: "relative", marginBottom: 60 },
  background: { width: "100%", height: 260 },
  changeBackground: {
    position: "absolute",
    right: 12,
    bottom: 8,
    backgroundColor: "rgba(0,0,0,0.6)",
    color: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    fontSize: 13,
  },
  avatarWrapper: {
    position: "absolute",
    bottom: -15,
    left: 20,
    alignItems: "center",
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: "#fff",
  },
  changeAvatar: {
    marginTop: 6,
    fontSize: 13,
    color: "#007bff",
    fontWeight: "500",
  },
  form: { paddingHorizontal: 20, marginTop: 10 },
  label: { fontWeight: "700", marginTop: 14, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
    backgroundColor: "#fafafa",
  },
  saveBtn: {
    marginTop: 30,
    backgroundColor: "#007bff",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontSize: 17, fontWeight: "700" },
});
