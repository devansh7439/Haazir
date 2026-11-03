import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, font, radius, space } from "./theme";

/** A bottom sheet for confirmations and short forms. Tapping outside, or the hardware back button, closes it. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose} visible>
      <Pressable accessibilityLabel="Close" style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: space.md }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(9,9,11,0.45)" },
  sheet: { backgroundColor: color.card, borderTopLeftRadius: radius.lg * 1.5, borderTopRightRadius: radius.lg * 1.5, padding: space.lg, gap: space.md, maxHeight: "85%" },
  title: { fontSize: font.lg + 1, fontWeight: "700", color: color.text },
});
