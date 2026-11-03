import { Pressable, StyleSheet, Text } from "react-native";
import { color, font, radius } from "./theme";

/** A tappable option: selected shows the dark fill plus a check mark in the text, not colour alone. */
export function Chip({ label, selected, onPress, testID }: { label: string; selected: boolean; onPress: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, selected && styles.on]}
    >
      <Text style={[styles.text, selected && styles.textOn]}>{selected ? `✓ ${label}` : label}</Text>
    </Pressable>
  );
}

/** One choice out of a few, as a row of equal buttons. */
export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: ReadonlyArray<{ value: T; label: string }>; onChange: (v: T) => void }) {
  return (
    <Pressable accessibilityRole="radiogroup" style={styles.seg}>
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="radio"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.segItem, o.value === value && styles.on]}
        >
          <Text style={[styles.text, o.value === value && styles.textOn]}>{o.label}</Text>
        </Pressable>
      ))}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: 40, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1, borderColor: color.line, backgroundColor: color.card, justifyContent: "center" },
  on: { backgroundColor: color.brand, borderColor: color.brand },
  text: { fontSize: font.sm, fontWeight: "600", color: color.text2 },
  textOn: { color: color.onBrand },
  seg: { flexDirection: "row", gap: 6 },
  segItem: { flex: 1, minHeight: 44, borderRadius: radius.md, borderWidth: 1, borderColor: color.line, backgroundColor: color.card, alignItems: "center", justifyContent: "center" },
});
