import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, font, space } from "./theme";

/**
 * A scrolling page with a title, pull to refresh and an optional footer pinned above the keyboard (the "Find a bed"
 * bar). Tab screens draw their own header, so the title sits inside the page.
 */
export function Screen(props: {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Leave room for the status bar; false under a native header. */
  top?: boolean;
  testID?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} testID={props.testID}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: (props.top === false ? 0 : insets.top) + space.lg }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={props.onRefresh ? <RefreshControl refreshing={!!props.refreshing} onRefresh={props.onRefresh} /> : undefined}
      >
        {props.title ? (
          <View style={{ gap: 2 }}>
            <Text style={styles.title} accessibilityRole="header">{props.title}</Text>
            {props.subtitle ? <Text style={styles.subtitle}>{props.subtitle}</Text> : null}
          </View>
        ) : null}
        {props.children}
      </ScrollView>
      {props.footer ? <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>{props.footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  scroll: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: space.xl * 2, gap: space.md },
  title: { fontSize: font.xl, fontWeight: "700", color: color.text, letterSpacing: -0.3 },
  subtitle: { fontSize: font.sm, color: color.muted, lineHeight: 19 },
  footer: { borderTopWidth: 1, borderTopColor: color.line, backgroundColor: color.card, paddingHorizontal: space.lg, paddingTop: space.md, gap: 6 },
});
