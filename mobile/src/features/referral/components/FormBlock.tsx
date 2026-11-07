import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import theme from '../../../theme';

/** One question of the form: a bold title, a quiet line under it if it needs one, and the way to answer. */
export default function FormBlock({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={styles.block}>
      <View>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: theme.space.m },
  title: { ...theme.type.rowTitle, color: theme.color.textPrimary },
  hint: { ...theme.type.caption, color: theme.tint.muted, marginTop: 2 },
});
