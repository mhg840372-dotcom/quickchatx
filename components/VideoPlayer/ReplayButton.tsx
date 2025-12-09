import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function ReplayButton({ visible, onPress }) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={onPress} style={styles.btn}>
        <Text style={styles.icon}>⟳</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignSelf: "center",
    top: "42%",
  },
  btn: {
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 22,
    borderRadius: 50,
  },
  icon: {
    color: "#fff",
    fontSize: 34,
    fontWeight: "bold",
  },
});
