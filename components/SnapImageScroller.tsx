// 📁 components/SnapImageScroller.tsx
import { useRef } from "react";
import {
    FlatList,
    Image,
    NativeScrollEvent,
    NativeSyntheticEvent,
    StyleSheet,
    useWindowDimensions,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type SnapImage = {
  id: string;
  uri: string;
};

type Props = {
  images: SnapImage[];
  /** Altura total ocupada por headers (por ejemplo tu header animado) */
  headerHeight?: number;
  /** Altura del tab bar u otra cosa fija abajo */
  footerHeight?: number;
  /** Callback opcional al cambiar de índice */
  onIndexChange?: (index: number) => void;
};

export const SnapImageScroller: React.FC<Props> = ({
  images,
  headerHeight = 0,
  footerHeight = 0,
  onIndexChange,
}) => {
  const insets = useSafeAreaInsets();
  const { height: screenHeight, width: screenWidth } = useWindowDimensions();
  const currentIndexRef = useRef(0);

  // Altura real disponible de “página”
  const pageHeight =
    screenHeight - insets.top - insets.bottom - headerHeight - footerHeight;

  const handleMomentumEnd = (
    e: NativeSyntheticEvent<NativeScrollEvent>
  ) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    const index = Math.round(offsetY / pageHeight);

    if (index !== currentIndexRef.current) {
      currentIndexRef.current = index;
      onIndexChange?.(index);
    }
  };

  return (
    <FlatList
      data={images}
      keyExtractor={(item) => item.id}
      pagingEnabled
      snapToInterval={pageHeight}
      decelerationRate="fast"
      snapToAlignment="start"
      showsVerticalScrollIndicator={false}
      onMomentumScrollEnd={handleMomentumEnd}
      getItemLayout={(_, index) => ({
        length: pageHeight,
        offset: pageHeight * index,
        index,
      })}
      renderItem={({ item }) => (
        <View style={[styles.page, { height: pageHeight }]}>
          <Image
            source={{ uri: item.uri }}
            style={{
              width: screenWidth,
              height: pageHeight,
              resizeMode: "contain", // 🔥 importante para que no se “salga”
            }}
          />
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  page: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000", // como visor, tipo Reddit/Instagram
  },
});

export default SnapImageScroller;
