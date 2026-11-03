import type { ReactNode } from "react";
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { color, font, radius, space } from "./theme";

export function Card({ children, style, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; accent?: string }) {
  return (
    <View style={[styles.card, style]}>
      {accent ? <View style={[styles.accent, { backgroundColor: accent }]} /> : null}
      {children}
    </View>
  );
}

export function SectionTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <View style={styles.title}>
      <Text style={styles.titleText} accessibilityRole="header">{children}</Text>
      {count !== undefined && <Text style={styles.count}>{count}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.card, borderRadius: radius.lg, borderWidth: 1, borderColor: color.line, padding: space.lg, overflow: "hidden" },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  title: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: space.sm },
  titleText: { fontSize: font.sm, fontWeight: "700", color: color.text2, textTransform: "uppercase", letterSpacing: 0.5 },
  count: { fontSize: font.xs, color: color.muted, backgroundColor: color.subtle, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 1, overflow: "hidden" },
});
