import { Linking, StyleSheet, Text, View } from 'react-native';
import type { Alert } from '../../../api/schema';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/ui/Icon';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** Something that needs the doctor: a desk asking for them, a hospital calling back, or a system alert. */
export default function AlertCard({ alert, onDismiss }: { alert: Alert; onDismiss: () => void }) {
  const system = alert.type === 'alert';
  const name = alert.facility_name ?? t('A hospital');
  const what = alert.type === 'inbound_callback' ? t('{name} called back', { name }) : t('{name} wants to talk to you', { name });
  const title = system ? (alert.reason ?? alert.kind ?? t('Alert')) : `${what}${alert.contact_person ? ` · ${alert.contact_person}` : ''}`;
  return (
    <View accessibilityRole="alert" style={styles.box}>
      <View style={styles.head}>
        <Icon name={system ? 'alert' : 'phone-incoming'} size={theme.size.icon} color={theme.color.status.pendingFg} />
        <Text style={styles.title}>{title}</Text>
      </View>
      {!system && alert.reason ? <Text style={styles.reason}>{`“${alert.reason}”`}</Text> : null}
      <View style={styles.actions}>
        {alert.number ? (
          <Button
            icon="phone"
            label={t('Call desk · {number}', { number: alert.number })}
            onPress={() => void Linking.openURL(`tel:${alert.number}`)}
          />
        ) : null}
        <Button label={t('Dismiss')} variant="secondary" onPress={onDismiss} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    backgroundColor: theme.color.status.pendingBg,
    borderRadius: theme.radius.field,
    borderLeftWidth: 3,
    borderLeftColor: theme.color.status.pendingFg,
    padding: theme.space.l,
    gap: theme.space.m,
  },
  head: { flexDirection: 'row', gap: theme.space.m, alignItems: 'flex-start' },
  title: { ...theme.type.rowTitle, flex: 1, color: theme.color.status.pendingFg },
  reason: { ...theme.type.secondary, color: theme.color.textSecondary },
  actions: { gap: theme.space.s },
});
