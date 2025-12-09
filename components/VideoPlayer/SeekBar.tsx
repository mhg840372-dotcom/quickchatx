import { memo } from "react";
import { StyleSheet, TouchableWithoutFeedback, View } from "react-native";

function SeekBarComponent({ duration, position, onSeek, onSeekLayout }) {
  const progress = duration > 0 ? position / duration : 0;

  return (
    <TouchableWithoutFeedback onPress={onSeek}>
      <View style={styles.wrapper} onLayout={onSeekLayout}>
        {/* Background bar */}
        <View style={styles.bg} />

        {/* Progress bar */}
        <View
          style={[
            styles.progress,
            { width: `${progress * 100}%` },
          ]}
        />

        {/* Thumb */}
        <View
          style={[
            styles.thumb,
            { left: `${progress * 100}%` },
          ]}
        />
      </View>
    </TouchableWithoutFeedback>
  );
}

export default memo(SeekBarComponent);

const styles = StyleSheet.create({
  wrapper: {
    height: 26,
    justifyContent: "center",
  },
  bg: {
    height: 5,
    borderRadius: 6,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  progress: {
    position: "absolute",
    left: 0,
    height: 5,
    borderRadius: 6,
    backgroundColor: "#fff",
  },
  thumb: {
    position: "absolute",
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#fff",
    top: -5,
    marginLeft: -7,
  },
});
