import { View, TouchableOpacity, Text, StyleSheet, type GestureResponderEvent, type LayoutChangeEvent } from "react-native";
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, SlidersHorizontal } from "lucide-react-native";
import SeekBar from "./SeekBar";

type Props = {
  playing: boolean;
  onPlayPause: () => void;
  muted: boolean;
  onToggleMute: () => void;
  speed: number;
  onChangeSpeed: () => void;
  onOpenQuality: () => void;
  fullscreen: boolean;
  onToggleFullscreen: () => void;
  duration: number;
  position: number;
  onSeek: (event: GestureResponderEvent) => void;
  onSeekLayout?: (event: LayoutChangeEvent) => void;
};

export default function Controls({
  playing,
  onPlayPause,
  muted,
  onToggleMute,
  speed,
  onChangeSpeed,
  onOpenQuality,
  fullscreen,
  onToggleFullscreen,
  duration,
  position,
  onSeek,
  onSeekLayout,
}: Props) {
  return (
    <View style={styles.wrapper}>
      {/* SEEK BAR */}
      <SeekBar
        duration={duration}
        position={position}
        onSeek={onSeek}
        onSeekLayout={onSeekLayout}
      />

      {/* CONTROLS ROW */}
      <View style={styles.row}>
        {/* PLAY / PAUSE */}
        <TouchableOpacity onPress={onPlayPause}>
          {playing ? (
            <Pause size={28} color="#fff" />
          ) : (
            <Play size={28} color="#fff" />
          )}
        </TouchableOpacity>

        {/* MUTE */}
        <TouchableOpacity onPress={onToggleMute}>
          {muted ? (
            <VolumeX size={26} color="#fff" />
          ) : (
            <Volume2 size={26} color="#fff" />
          )}
        </TouchableOpacity>

        {/* SPEED */}
        <TouchableOpacity onPress={onChangeSpeed}>
          <Text style={styles.speedText}>{speed}x</Text>
        </TouchableOpacity>

        {/* QUALITY MENU */}
        <TouchableOpacity onPress={onOpenQuality}>
          <SlidersHorizontal size={26} color="#fff" />
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {/* FULLSCREEN */}
        <TouchableOpacity onPress={onToggleFullscreen}>
          {fullscreen ? (
            <Minimize2 size={28} color="#fff" />
          ) : (
            <Maximize2 size={28} color="#fff" />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 20,
  },

  row: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },

  speedText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
