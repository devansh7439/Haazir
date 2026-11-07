import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import theme from '../../theme';
import { t } from '../../lib/i18n';
import Button from './Button';

export type ErrorStateProps = {
  /** What the server or the phone said went wrong. */
  message: string;
  onRetry: () => void;
  what?: string | undefined;
  style?: ViewStyle;
};

/** A page or list that could not load: what went wrong in plain words, and a button to try again. */
export default function ErrorState({ message, onRetry, what, style }: ErrorStateProps) {
  return (
    <View accessibilityLiveRegion="polite" style={[styles.wrap, style]}>
      <Text accessibilityRole="header" style={styles.title}>
        {what ? t('Couldn’t load {what}', { what }) : t('Couldn’t load this')}
      </Text>
      <Text style={styles.body}>{message}</Text>
      <Button label={t('Try again')} onPress={onRetry} variant="secondary" size="medium" style={styles.action} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingVertical: theme.space.xxxl, paddingHorizontal: theme.space.xl },
  title: { ...theme.type.heading, color: theme.tint.ink, textAlign: 'center' },
  body: { ...theme.type.body, color: theme.tint.muted, textAlign: 'center', marginTop: theme.space.s },
  action: { marginTop: theme.space.xl, minWidth: 180 },
});
