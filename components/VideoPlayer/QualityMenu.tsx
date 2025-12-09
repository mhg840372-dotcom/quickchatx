import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  TouchableWithoutFeedback,
} from "react-native";

export type VideoSourceQuality = {
  quality: string;
  uri: string;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  sources: VideoSourceQuality[];
  currentQuality: string | null;
  onSelectQuality: (source: VideoSourceQuality) => void;
};

export default function QualityMenu({
  visible,
  onClose,
  sources,
  currentQuality,
  onSelectQuality,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      {/* Fondo oscuro */}
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      {/* Caja inferior */}
      <View style={styles.container}>
        <Text style={styles.title}>Calidad del video</Text>

        {sources.map((s) => (
          <TouchableOpacity
            key={s.quality}
            style={styles.item}
            onPress={() => {
              onSelectQuality(s);
              onClose();
            }}
          >
            <Text style={styles.itemText}>{s.quality}</Text>

            {currentQuality === s.quality && (
              <Text style={styles.check}>✓</Text>
            )}
          </TouchableOpacity>
        ))}

        {/* Botón cerrar */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={{ color: "#fff", fontSize: 16 }}>Cerrar</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
  },

  container: {
    backgroundColor: "#1b1b1b",
    padding: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },

  title: {
    color: "#fff",
    fontSize: 18,
    marginBottom: 16,
    fontWeight: "600",
  },

  item: {
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  itemText: {
    color: "#fff",
    fontSize: 16,
  },

  check: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "700",
  },

  closeBtn: {
    marginTop: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
});
