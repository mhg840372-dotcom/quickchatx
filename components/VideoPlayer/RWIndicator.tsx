import { Animated, StyleSheet, Text } from "react-native";

export default function RWIndicator({ anim }) {
  return (
    <Animated.View style={[styles.container, { opacity: anim }]}>
      <Text style={styles.text}>⬅️ -10s</Text>
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
