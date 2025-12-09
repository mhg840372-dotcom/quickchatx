// components/FeedVideoItem.tsx
import React from "react";
import { View, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Video, ResizeMode } from "expo-av"; // expo-video no expone Video; usamos expo-av

type Props = {
  uri: string;
  thumbnail?: string | null;  // miniatura si la tienes
  isVisible: boolean;         // viene del FlatList (viewability)
};

export const FeedVideoItem: React.FC<Props> = ({ uri, thumbnail, isVisible }) => {
  const [isBuffering, setIsBuffering] = React.useState(true);
  const [isPlaying, setIsPlaying] = React.useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setIsPlaying((prev) => !prev)}
      >
        <Video
          source={{ uri }}
          style={styles.video}
          resizeMode={ResizeMode.COVER}
          useNativeControls={false}
          shouldPlay={isVisible && isPlaying}   // 🔑 solo si visible y el usuario dio play
          isMuted={false}
          isLooping
          posterSource={thumbnail ? { uri: thumbnail } : undefined}
          usePoster={!!thumbnail}              // 🔑 muestra miniatura mientras carga
          onLoadStart={() => setIsBuffering(true)}
          onReadyForDisplay={() => setIsBuffering(false)}
        />
        {isBuffering && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    aspectRatio: 9 / 16, // o el que uses
    backgroundColor: "#000",
    borderRadius: 16,
    overflow: "hidden",
  },
  video: { width: "100%", height: "100%" },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
});
