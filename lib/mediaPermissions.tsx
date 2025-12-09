// src/lib/mediaPermissions.ts
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export async function ensureMediaPermissions() {
  if (Platform.OS !== 'android') {
    // En iOS, ImagePicker pedirá permisos solo si hace falta
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === ImagePicker.PermissionStatus.GRANTED;
  }

  // ANDROID
  // Pide permiso a la librería de fotos/vídeos (Expo maneja Android 13+ internamente)
  const lib = await ImagePicker.requestMediaLibraryPermissionsAsync();
  // Si también usas cámara:
  const cam = await ImagePicker.requestCameraPermissionsAsync();

  // Con que la librería esté concedida basta para elegir imágenes/videos
  return (
    lib.status === ImagePicker.PermissionStatus.GRANTED ||
    cam.status === ImagePicker.PermissionStatus.GRANTED
  );
}
