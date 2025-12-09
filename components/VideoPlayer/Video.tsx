import { Heart } from "lucide-react-native";
import { ComponentType } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, TouchableWithoutFeedback, View } from "react-native";
import VideoRN from "react-native-video";

export default function VideoPlayer({
  refVideo,
  fade,
  heart,
  FFAnim,
  RWAnim,
  buffering,
  ended,
  playing,
  muted,
  loop,
  speed,
  source,
  onLoad,
  onProgress,
  onBuffer,
  onTap,
  replay,
  panHandlers,
  showControls,
  ControlsComponent,
  isFullscreen,
}: {
  refVideo: any;
  fade: Animated.Value;
  heart: Animated.Value;
  FFAnim: Animated.Value;
  RWAnim: Animated.Value;
  buffering: boolean;
  ended: boolean;
  playing: boolean;
  muted: boolean;
  loop: boolean;
  speed: number;
  source: string;
  onLoad: (data: any) => void;
  onProgress: (data: any) => void;
  onBuffer: (data: any) => void;
  onTap: () => void;
  replay: () => void;
  panHandlers: any;
  showControls: boolean;
  ControlsComponent: ComponentType;
  isFullscreen: boolean;
}) {
  return (
    <TouchableWithoutFeedback onPress={onTap} {...panHandlers}>
      <Animated.View
        style={[
          styles.videoWrapper,
          isFullscreen && styles.fullscreenVideo,
          { opacity: fade },
        ]}
      >
        {/* REPRODUCTOR */}
        <VideoRN
          ref={refVideo}
          source={{ uri: source }}
          style={StyleSheet.absoluteFill}
          resizeMode={isFullscreen ? "contain" : "cover"}
          paused={!playing}
          muted={muted}
          repeat={loop}
          rate={speed}
          onLoad={onLoad}
          onProgress={onProgress}
          onBuffer={onBuffer}
          pictureInPicture={true}
        />

        {/* BUFFERING */}
        {buffering && (
          <View style={styles.bufferOverlay}>
            <ActivityIndicator size="large" color="#fff" />
          </View>
        )}

        {/* LIKE (corazón) */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.heart,
            { transform: [{ scale: heart }] },
          ]}
        >
          <Heart size={100} color="#ff0050" fill="#ff0050" />
        </Animated.View>

        {/* FF +10s */}
        <Animated.View style={[styles.ffrw, { opacity: FFAnim }]}>
          <Text style={styles.ffrwText}>+10s ➡️</Text>
        </Animated.View>

        {/* RW -10s */}
        <Animated.View style={[styles.ffrw, { opacity: RWAnim }]}>
          <Text style={styles.ffrwText}>⬅️ -10s</Text>
        </Animated.View>

        {/* CONTROLES */}
        {showControls && <ControlsComponent />}

        {/* REPLAY */}
        {ended && (
          <TouchableWithoutFeedback onPress={replay}>
            <View style={styles.replayBtn}>
              <Text style={{ color: "#fff", fontSize: 28 }}>⟳</Text>
            </View>
          </TouchableWithoutFeedback>
        )}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  videoWrapper: {
    flex: 1,
  },
  fullscreenVideo: {
    backgroundColor: "#000",
  },

  bufferOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },

  heart: {
    position: "absolute",
    top: "40%",
    alignSelf: "center",
  },

  ffrw: {
    position: "absolute",
    top: "45%",
    alignSelf: "center",
  },
  ffrwText: {
    color: "#fff",
    fontSize: 32,
    fontWeight: "bold",
  },

  replayBtn: {
    position: "absolute",
    top: "42%",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    padding: 22,
    borderRadius: 50,
  },
});
