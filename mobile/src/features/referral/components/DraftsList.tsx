import { useFocusEffect } from '@react-navigation/native';
import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { IntakeRepository } from '../../../api/intake.repository';
import type { Draft } from '../../../api/schema';
import { useLoad } from '../../../api/useLoad';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Icon from '../../../components/ui/Icon';
import SectionHeader from '../../../components/ui/SectionHeader';
import { clock } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** Referrals doctors sent by WhatsApp text or voice note. Review pre-fills the form; nothing is started until Find a bed. */
export default function DraftsList({ onReview }: { onReview: (draft: Draft) => void }) {
  const { data, reload } = useLoad(IntakeRepository.drafts, []);
  useFocusEffect(useCallback(() => void reload(), [reload]));
  const drafts = data?.drafts ?? [];
  if (drafts.length === 0) return null;
  return (
    <View style={styles.wrap} testID="drafts">
      <SectionHeader
        title={t('From WhatsApp')}
        subtitle={drafts.length === 1 ? t('1 referral waiting') : t('{count} referrals waiting', { count: drafts.length })}
      />
      <Card style={styles.list}>
        {drafts.map((d) => (
          <View key={d.id} style={styles.draft}>
            <View style={styles.row}>
              <Icon name={d.kind === 'voice' ? 'mic' : 'message'} size={theme.size.icon} color={theme.color.textTertiary} />
              <Text style={styles.what}>{d.parsed.matched.length ? d.parsed.matched.join(' · ') : t('Case not recognised')}</Text>
              <Text style={styles.time}>{clock(d.created_at)}</Text>
            </View>
            <View style={styles.row}>
              <Button
                size="small"
                label={t('Review')}
                variant="secondary"
                onPress={() => onReview(d)}
                testID={`review-${d.id}`}
                style={styles.grow}
              />
              <Button
                size="small"
                label={t('Dismiss')}
                variant="text"
                onPress={async () => {
                  await IntakeRepository.dismiss(d.id).catch(() => {});
                  await reload();
                }}
              />
            </View>
          </View>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.s },
  list: { gap: theme.space.l },
  draft: { gap: theme.space.s },
  row: { flexDirection: 'row', alignItems: 'center', gap: theme.space.s },
  grow: { flex: 1 },
  what: { ...theme.type.secondary, color: theme.color.textPrimary, flex: 1 },
  time: { ...theme.type.caption, color: theme.color.textTertiary },
});
