import { StyleSheet, Text, View } from "react-native";
import type { IconKey, Tone } from "../lib/display";
import { StatusIcon } from "./Icon";
import { TONE_COLOR, font, radius } from "./theme";

/** A status: a soft pill with an icon and text, so colour never carries meaning alone. */
export function Pill({ tone, text, icon, small }: { tone: Tone; text: string; icon?: IconKey; small?: boolean }) {
  const c = TONE_COLOR[tone];
  return (
    <View style={[styles.pill, { backgroundColor: c.bg, borderColor: c.border }, small && styles.small]}>
      {icon && <StatusIcon icon={icon} size={small ? 12 : 14} color={c.fg} />}
      <Text style={[styles.text, { color: c.fg }, small && { fontSize: 11 }]} numberOfLines={2}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 5, maxWidth: "100%" },
  small: { paddingHorizontal: 8, paddingVertical: 3 },
  text: { fontSize: font.sm, fontWeight: "600", flexShrink: 1 },
});
