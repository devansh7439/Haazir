import type { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Card from '../../../components/ui/Card';
import theme from '../../../theme';

/**
 * One step's page, laid out like a RaktKhoj section: a white card headed "1. Title", a quiet line of help under it, then the
 * fields grouped inside.
 */
export default function SectionCard({ step, title, hint, children }: { step: number; title: string; hint?: string; children: ReactNode }) {
  return (
    <Card style={styles.card}>
      <View>
        <Text accessibilityRole="header" style={styles.title}>
          {`${step}. ${title}`}
        </Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <View style={styles.body}>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.space.l, paddingVertical: theme.space.l, borderWidth: 1, borderColor: theme.color.border },
  title: { ...theme.type.heading, color: theme.color.textPrimary },
  hint: { ...theme.type.caption, color: theme.tint.muted, marginTop: 2 },
  body: { gap: theme.space.xl },
});
