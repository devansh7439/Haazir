import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import theme from '../../theme';
import Button from './Button';
import Illustration, { type IllustrationName } from './Illustration';

export type EmptyStateProps = {
  title: string;
  body?: string;
  /** A drawing above the words. */
  art?: IllustrationName | undefined;
  actionLabel?: string | undefined;
  onAction?: (() => void) | undefined;
  style?: ViewStyle;
};

/** What a list shows when it has nothing in it, in a dashed box as on RaktKhoj: an optional drawing, a title, a line of help and an optional button. */
export default function EmptyState({ title, body, actionLabel, onAction, art, style }: EmptyStateProps) {
  return (
    <View style={[styles.wrap, style]}>
      {art ? <Illustration name={art} width={190} /> : null}
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} size="medium" style={styles.action} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: theme.space.xxxl,
    paddingHorizontal: theme.space.xl,
    borderRadius: theme.radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: theme.color.borderStrong,
  },
  title: { ...theme.type.heading, marginTop: theme.space.m, color: theme.tint.ink, textAlign: 'center' },
  body: { ...theme.type.body, color: theme.tint.muted, textAlign: 'center', marginTop: theme.space.s },
  action: { marginTop: theme.space.xl, alignSelf: 'stretch' },
});
