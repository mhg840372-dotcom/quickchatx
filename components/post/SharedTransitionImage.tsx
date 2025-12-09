// ============================================================================
// 🔥 SharedTransitionImage.tsx — Ultra Smooth Shared Element Animation (IG style)
// ----------------------------------------------------------------------------
// ✔ Miniatura → fullscreen (zoom + position interpolation)
// ✔ Fullscreen → miniatura (reverse animation)
// ✔ Reanimated 3 + Expo 54 OpenGL safe
// ✔ No dependencias externas, ultra estable
// ============================================================================

import { useState } from "react";
import { StyleSheet, TouchableOpacity, Dimensions, Modal, Pressable } from "react-native";
import { Image } from "expo-image";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
} from "react-native-reanimated";

const screen = Dimensions.get("window");

type Props = {
  uri: string;
  style?: any;
};

export default function SharedTransitionImage({ uri, style }: Props) {
  // Miniatura → fullscreen states
  const [open, setOpen] = useState(false);
  const [imageLayout, setImageLayout] = useState(null as any);

  const progress = useSharedValue(0);

  const animatedStyles = useAnimatedStyle(() => {
    if (!imageLayout) return {};

    const w = interpolate(progress.value, [0, 1], [imageLayout.width, screen.width]);
    const h = interpolate(progress.value, [0, 1], [imageLayout.height, screen.height]);
    const x = interpolate(progress.value, [0, 1], [imageLayout.x, 0]);
    const y = interpolate(progress.value, [0, 1], [imageLayout.y, 0]);

    return {
      width: w,
      height: h,
      position: "absolute",
      left: x,
      top: y,
      borderRadius: interpolate(progress.value, [0, 1], [16, 0]),
    };
  });

  const openViewer = () => {
    progress.value = 0;
    setOpen(true);

    requestAnimationFrame(() => {
      progress.value = withTiming(1, { duration: 320 });
    });
  };

  const closeViewer = () => {
    progress.value = withTiming(0, { duration: 320 }, () => {
      setOpen(false);
    });
  };

  return (
    <>
      {/* Thumbnail */}

      <TouchableOpacity
        activeOpacity={0.9}
        onPress={openViewer}
        style={style}
        onLayout={(e) => {
          setImageLayout(e.nativeEvent.layout);
        }}
      >
        <Image
          source={{ uri }}
          style={[styles.thumbnail]}
          contentFit="cover"
        />
      </TouchableOpacity>

      {/* Fullscreen Shared Transition */}
      <Modal visible={open} transparent>
        <Pressable style={styles.modalBg} onPress={closeViewer}>

          {/* Dark fade background */}
          <Animated.View
            style={[
              styles.backdrop,
              {
                opacity: progress.value,
              },
            ]}
          />

          {/* Shared element image */}
          {imageLayout && (
            <Animated.View style={animatedStyles}>
              <Image
                source={{ uri }}
                style={styles.fullImage}
                contentFit="cover"
              />
            </Animated.View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumbnail: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
    backgroundColor: "#111",
  },
  modalBg: {
    flex: 1,
    backgroundColor: "transparent",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "black",
  },
  fullImage: {
    width: "100%",
    height: "100%",
  },
});
