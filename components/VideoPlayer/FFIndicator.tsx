import { Animated, Text, StyleSheet, type Animated as AnimatedType } from "react-native";

type Props = {
  anim: AnimatedType.Value | AnimatedType.AnimatedInterpolation<string | number>;
};

export default function FFIndicator({ anim }: Props) {
  return (
    <Animated.View style={[styles.container, { opacity: anim }]}>
      <Text style={styles.text}>+10s ➡️</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
  },
  text: {
    fontSize: 32,
    color: "#fff",
    fontWeight: "700",
  },
});
