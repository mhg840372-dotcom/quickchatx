// 📁 app/image-viewer.tsx (ejemplo)
import { View, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SnapImageScroller, type SnapImage as SnapImageScrollerType } from "@/components/SnapImageScroller";
import GlobalHeader, { GLOBAL_HEADER_HEIGHT } from "@/components/GlobalHeader";

const MOCK_IMAGES: SnapImageScrollerType[] = [
  {
    id: "1",
    uri: "https://picsum.photos/800/1200",
  },
  {
    id: "2",
    uri: "https://picsum.photos/900/1300",
  },
  {
    id: "3",
    uri: "https://picsum.photos/1000/800",
  },
];

export default function ImageViewerScreen() {
  const insets = useSafeAreaInsets();

  // 👇 tu header global ocupa insets.top + GLOBAL_HEADER_HEIGHT
  const headerHeight = insets.top + GLOBAL_HEADER_HEIGHT;
  // si tienes tab bar abajo en esta pantalla, puedes sumar algo en footerHeight

  return (
    <View style={styles.container}>
      <GlobalHeader />
      <View style={{ flex: 1, paddingTop: headerHeight }}>
        <SnapImageScroller
          images={MOCK_IMAGES}
          headerHeight={0}        // ya hemos aplicado paddingTop arriba
          footerHeight={0}        // aquí no tenemos tab bar
          onIndexChange={(i) => {
            // console.log("Página actual:", i);
          }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
});
