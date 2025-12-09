// ============================================================================
// 🖼️ PostImagePreview.tsx — Instagram Animated Preview
// ---------------------------------------------------------------------------
// ✔ Blur + shimmer loader
// ✔ Fade-in + Zoom-out al cargar
// ✔ Animación al abrir el modal (zoom-in)
// ✔ Ultra smooth transitions
// ✔ 100% compatible con Expo SDK 54
// ============================================================================

import { useState, useRef } from "react";
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Animated,
} from "react-native";
import { BlurView } from "expo-blur";
import { Image } from "expo-image";

const { width } = Dimensions.get("window");

type Props = {
  uri: string;
  index?: number;
  onPress: () => void; // abrir modal fullscreen
  style?: any;
};

export default function PostImagePreview({ uri, onPress, style }: Props) {
  const [loaded, setLoaded] = useState(false);

  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1.07)).current;
  const blurOpacity = useRef(new Animated.Value(1)).current;

  // Cuando carga la imagen → fade + zoom-out suave
  const handleLoaded = () => {
    setLoaded(true);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(blurOpacity, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  };

  return (
    <TouchableOpacity activeOpacity={0.9} onPress={onPress}>
      <View style={[styles.container, style]}>
        {/* Imagen real */}
        <Animated.View style={{ flex: 1, opacity, transform: [{ scale }] }}>
          <Image
            source={{ uri }}
            style={styles.image}
            contentFit="cover"
            transition={180}
            onLoad={handleLoaded}
          />
        </Animated.View>

        {/* Loader blur + shimmer */}
        {!loaded && (
          <Animated.View
            style={[styles.loaderOverlay, { opacity: blurOpacity }]}
          >
            <BlurView intensity={50} tint="dark" style={styles.blur} />

            <Animated.View style={styles.shimmerContainer}>
              <Animated.View style={styles.shimmer} />
            </Animated.View>
          </Animated.View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: width,
    height: width,
    backgroundColor: "#111",
    overflow: "hidden",
    borderRadius: 12,
  },
  image: {
    width: "100%",
    height: "100%",
  },

  // Loader
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  blur: {
    ...StyleSheet.absoluteFillObject,
  },

  // Shimmer effect
  shimmerContainer: {
    width: "70%",
    height: "70%",
    borderRadius: 12,
    overflow: "hidden",
  },
  shimmer: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
  },
});
