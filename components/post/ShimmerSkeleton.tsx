// app/post/ShimmerSkeleton.tsx
import { useRef, useEffect } from "react";
import {
  View,
  Animated,
  StyleSheet,
  StyleProp,
  ViewStyle,
} from "react-native";

type Props = {
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export default function ShimmerSkeleton({ height = 16, style }: Props) {
  const translateX = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );

    anim.start();

    return () => {
      anim.stop();
    };
  }, [translateX]);

  const inputRange = [-1, 0, 1];
  const outputRange = [-200, 0, 200];
  const translate = translateX.interpolate({ inputRange, outputRange });

  return (
    <View style={[styles.wrapper, { height }, style]}>
      <View style={styles.base} />
      <Animated.View
        style={[
          styles.shimmer,
          {
            transform: [{ translateX: translate }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "#eee",
    overflow: "hidden",
    borderRadius: 8,
  },
  base: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#eee",
  },
  shimmer: {
    position: "absolute",
    left: -200,
    top: 0,
    bottom: 0,
    width: 200,
    backgroundColor: "rgba(255,255,255,0.6)",
  },
});
