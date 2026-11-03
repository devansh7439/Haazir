import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { color, font, radius } from "./theme";

/** A labelled text input with an optional hint and error under it. */
export function Field({ label, hint, error, ...input }: { label: string; hint?: string; error?: string | null } & TextInputProps) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.faint}
        {...input}
        style={[styles.input, input.multiline && styles.multiline, !!error && styles.invalid, input.style]}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: font.sm, fontWeight: "600", color: color.text2 },
  input: { minHeight: 48, borderWidth: 1, borderColor: color.line, borderRadius: radius.md, backgroundColor: color.card, paddingHorizontal: 14, fontSize: font.md, color: color.text },
  multiline: { minHeight: 88, paddingTop: 12, textAlignVertical: "top" },
  invalid: { borderColor: color.danger },
  hint: { fontSize: font.xs, color: color.muted },
  error: { fontSize: font.xs, color: color.danger },
});
