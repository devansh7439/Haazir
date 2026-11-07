import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import theme from '../../theme';

export type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  required?: boolean;
  optionalHint?: string;
  style?: ViewStyle;
};

/** A bold title for a block of a page, with a quiet line under it and an optional action on the right. */
export default function SectionHeader({
  title,
  subtitle,
  actionLabel,
  onAction,
  required = false,
  optionalHint,
  style,
}: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <View style={styles.text}>
        <Text accessibilityRole="header" style={styles.title}>
          {title}
          {required ? <Text style={styles.required}> *</Text> : null}
          {optionalHint ? <Text style={styles.optional}> {optionalHint}</Text> : null}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={10}>
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.m },
  text: { flex: 1 },
  title: { ...theme.type.heading, color: theme.tint.ink },
  required: { color: theme.color.required },
  optional: { ...theme.type.caption, color: theme.tint.muted },
  subtitle: { ...theme.type.caption, color: theme.tint.muted, marginTop: 2 },
  actionText: { ...theme.type.caption, color: theme.color.textSecondary },
});
