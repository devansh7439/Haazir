import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { ReferralView } from '../../../api/schema';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import SectionHeader from '../../../components/ui/SectionHeader';
import { clock, eventText } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import { animateLayout } from '../../../lib/motion';
import { useSettings } from '../../../lib/settings';
import { eventLine } from '../../../lib/localize';
import theme from '../../../theme';

const COLLAPSED = 6;

/** Every event in plain words, newest first. Each is timestamped, so the record is auditable. */
export default function Timeline({ view, facilityName }: { view: ReferralView; facilityName: (id: unknown) => string }) {
  const [open, setOpen] = useState(useSettings().showActivity);
  const [all, setAll] = useState(false);
  const lines = [...view.events]
    .reverse()
    .map((e) => ({ id: e.id, at: e.created_at, text: eventText(e, facilityName) }))
    .filter((l): l is { id: number; at: string; text: string } => l.text !== null);
  const shown = all ? lines : lines.slice(0, COLLAPSED);
  if (!open)
    return (
      <Button
        size="medium"
        variant="text"
        icon="clock"
        label={t('Show activity')}
        onPress={() => {
          animateLayout();
          setOpen(true);
        }}
      />
    );
  return (
    <View style={styles.wrap}>
      <SectionHeader title={t('Activity')} subtitle={t('{count} events', { count: lines.length })} />
      <Card style={styles.list}>
        {shown.map((l) => (
          <View key={l.id} style={styles.line}>
            <Text style={styles.time}>{clock(l.at)}</Text>
            <Text style={styles.text}>{eventLine(l.text)}</Text>
          </View>
        ))}
        {lines.length > COLLAPSED ? (
          <Button
            size="small"
            variant="text"
            label={all ? t('Show fewer') : t('Show all {count} events', { count: lines.length })}
            onPress={() => {
              animateLayout();
              setAll((open) => !open);
            }}
          />
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.s },
  list: { gap: theme.space.m },
  line: { flexDirection: 'row', gap: theme.space.m },
  time: { ...theme.type.caption, width: theme.size.timeColumn, color: theme.color.textTertiary, fontVariant: ['tabular-nums'] },
  text: { ...theme.type.secondary, flex: 1, color: theme.color.textSecondary },
});
