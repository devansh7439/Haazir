import { StyleSheet, Text, View } from 'react-native';
import theme from '../../../theme';

/** A figure under a small caption: the elapsed time, the time to the first yes. */
export default function Metric({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, strong && styles.strong]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  metric: { gap: 2 },
  label: { ...theme.type.captionStrong, color: theme.color.textSecondary },
  value: { ...theme.type.figure, fontSize: 28, lineHeight: 34, color: theme.color.textPrimary },
  strong: { color: theme.color.status.verifiedFg },
});
