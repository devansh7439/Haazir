import { StyleSheet, Text, View } from 'react-native';
import Icon from '../../../components/ui/Icon';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

export type CheckItem = { label: string; ok: boolean };

/** "Before you submit": each thing the referral needs, with a tick when it is there and a warning when it is not. */
export default function ReviewChecklist({ items }: { items: CheckItem[] }) {
  return (
    <View style={styles.wrap} testID="checklist">
      <Text style={styles.title}>{t('Before you submit')}</Text>
      {items.map((item) => (
        <View key={item.label} style={styles.row} accessible accessibilityLabel={`${item.label}: ${item.ok ? t('done') : t('missing')}`}>
          <Icon
            name={item.ok ? 'check-circle' : 'alert-circle'}
            size={theme.size.icon}
            color={item.ok ? theme.color.status.verifiedFg : theme.color.alert.fg}
          />
          <Text style={[styles.label, !item.ok && styles.missing]}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.s },
  title: { ...theme.type.captionStrong, color: theme.color.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.s },
  label: { ...theme.type.secondary, flex: 1, color: theme.color.textPrimary },
  missing: { color: theme.color.alert.fg },
});
