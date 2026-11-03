import * as Haptics from "expo-haptics";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Icon, type IconName } from "./Icon";
import { color, font, radius } from "./theme";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const COLORS: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: color.brand, fg: color.onBrand, border: color.brand },
  secondary: { bg: color.card, fg: color.text, border: color.line },
  ghost: { bg: "transparent", fg: color.text2, border: "transparent" },
  danger: { bg: color.card, fg: color.danger, border: "#fecaca" },
};

/** A 48 pt tall touch target: emergency use, often one-handed. */
export function Button(props: {
  label: string;
  onPress: () => unknown;
  variant?: Variant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const c = COLORS[props.variant ?? "secondary"];
  const off = props.disabled || props.loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!props.loading }}
      testID={props.testID}
      disabled={off}
      onPress={() => {
        void Haptics.selectionAsync().catch(() => {});
        void props.onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        props.compact && styles.compact,
        { backgroundColor: c.bg, borderColor: c.border, opacity: off ? 0.5 : pressed ? 0.8 : 1 },
        props.style,
      ]}
    >
      {props.loading ? (
        <ActivityIndicator color={c.fg} />
      ) : (
        <View style={styles.row}>
          {props.icon && <Icon name={props.icon} size={16} color={c.fg} />}
          <Text style={[styles.label, { color: c.fg }]}>{props.label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: 48, paddingHorizontal: 16, borderRadius: radius.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  compact: { minHeight: 40, paddingHorizontal: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { fontSize: font.md, fontWeight: "600" },
});
