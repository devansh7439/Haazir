import { StyleSheet, Text, View } from "react-native";
import { Icon, type IconName } from "./Icon";
import { color, font, radius, space } from "./theme";

type Kind = "info" | "warn" | "error" | "ok";
const KIND: Record<Kind, { bg: string; fg: string; icon: IconName }> = {
  info: { bg: color.subtle, fg: color.text2, icon: "info" },
  warn: { bg: color.warnBg, fg: color.warnText, icon: "alert-triangle" },
  error: { bg: color.dangerBg, fg: color.danger, icon: "alert-circle" },
  ok: { bg: color.okBg, fg: color.okText, icon: "check-circle" },
};

/** A message box with an icon, for warnings, errors and notes. */
export function Callout({ kind = "info", title, children }: { kind?: Kind; title?: string; children?: string }) {
  const k = KIND[kind];
  return (
    <View accessibilityRole="alert" style={[styles.box, { backgroundColor: k.bg }]}>
      <Icon name={k.icon} size={16} color={k.fg} style={{ marginTop: 2 }} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={[styles.title, { color: k.fg }]}>{title}</Text> : null}
        {children ? <Text style={[styles.body, { color: k.fg }]}>{children}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: "row", gap: 10, padding: space.md, borderRadius: radius.md },
  title: { fontSize: font.md, fontWeight: "700" },
  body: { fontSize: font.sm, lineHeight: 19 },
});
