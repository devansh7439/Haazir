import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import type { AttemptView, ReferralView } from '../../../api/schema';
import Banner from '../../../components/ui/Banner';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import StatusPill from '../../../components/ui/StatusPill';
import { callEnded } from '../../../lib/board';
import { BED_LABEL, attemptDisplay, clock, shortName } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import { animateLayout } from '../../../lib/motion';
import { statusText } from '../../../lib/localize';
import { routeLink } from '../../../lib/links';
import theme from '../../../theme';
import ManualOutcome from './ManualOutcome';

const OPEN = ['options_ready', 'searching', 'exhausted'];

/** One hospital: its rank and drive time, its answer, what the desk said, and what the doctor can do next. */
export default function AttemptCard(props: {
  attempt: AttemptView;
  calls: number;
  nowMs: number;
  referralStatus: string;
  isSelected: boolean;
  portalFlag: ReferralView['portal_flags'][string] | null;
  origin: { lat: number; lng: number };
  onSelect: () => void;
  act: (path: string, body?: unknown) => Promise<boolean>;
}) {
  const { attempt: a } = props;
  const display = attemptDisplay(a, props.nowMs);
  const tone = theme.tone[display.tone];
  const accepted = a.outcome === 'accepted' || a.outcome === 'conditional';
  const canSelect = accepted && OPEN.includes(props.referralStatus);
  const canRedial = callEnded(a.status) && !accepted && OPEN.includes(props.referralStatus);
  const [more, setMore] = useState(a.needs_review);
  const [manual, setManual] = useState(false);
  const away = t('{minutes} min away', { minutes: a.eta_minutes ?? '?' });

  return (
    <Card accent={tone.accent} tone={props.isSelected ? 'held' : undefined} style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.rank, { backgroundColor: tone.pin }]}>
          <Text style={styles.rankText}>{a.rank ?? '•'}</Text>
        </View>
        <View style={styles.headText}>
          <Text style={[styles.name, display.group === 'not_available' && styles.nameQuiet]}>
            {shortName(a.facility_name)}
            {props.isSelected ? `  ·  ${t('Selected')}` : ''}
          </Text>
          <Text style={styles.meta}>
            {`${away}${a.distance_km !== null ? ` · ${t('{km} km', { km: a.distance_km })}` : ''}${props.calls > 1 ? ` · ${t('{count} calls', { count: props.calls })}` : ''}`}
          </Text>
        </View>
      </View>
      <StatusPill tone={display.tone} icon={display.icon} label={statusText(display.text)} />

      {accepted ? (
        <View style={styles.detail}>
          <Text style={styles.detailText}>
            {t(BED_LABEL[a.bed_type ?? 'unknown'] ?? a.bed_type ?? '')}
            {a.ready_in_minutes !== null ? ` · ${t('ready in {minutes} min', { minutes: a.ready_in_minutes })}` : ''}
          </Text>
          {a.contact_person ? <Text style={styles.detailText}>{t('Ask for {name}', { name: a.contact_person })}</Text> : null}
          {a.conditions ? (
            <Text style={[styles.detailText, styles.condition]}>{t('Condition: {text}', { text: a.conditions })}</Text>
          ) : null}
        </View>
      ) : null}
      {a.outcome === 'needs_doctor' && a.conditions ? (
        <Text style={styles.quote}>{`“${a.conditions}”${a.contact_person ? ` · ${a.contact_person}` : ''}`}</Text>
      ) : null}
      {a.needs_review ? (
        <Banner
          tone="warning"
          title={t('The answer is unclear')}
          body={t('Call: {call}, transcript: {transcript}. Listen to the recording before selecting.', {
            call: a.outcome ? t(a.outcome) : t('none'),
            transcript: a.extraction_outcome ? t(a.extraction_outcome) : t('none'),
          })}
        />
      ) : null}
      {props.portalFlag ? (
        <Banner
          tone="warning"
          title={t('Desk and portal disagree')}
          body={t('{detail} at {time} ({source}).', {
            detail: props.portalFlag.detail,
            time: clock(props.portalFlag.observed_at),
            source: props.portalFlag.source,
          })}
        />
      ) : null}
      {a.contact_is_ivr ? <Text style={styles.meta}>{t('Phone menu line only. A direct desk number works better.')}</Text> : null}

      <View style={styles.actions}>
        {canSelect ? (
          <Button label={a.needs_review ? t('Select anyway') : t('Select hospital')} onPress={props.onSelect} testID={`select-${a.rank}`} />
        ) : null}
        <Button icon="phone" variant="secondary" label={t('Call desk')} onPress={() => void Linking.openURL(`tel:${a.to_number}`)} />
        {canRedial ? (
          <Button
            icon="redial"
            variant="secondary"
            label={t('Redial')}
            onPress={() =>
              props.act(`/api/attempts/${a.id}/redial`, {
                contact_id: a.contact_id ?? undefined,
                to_number: a.contact_id ? undefined : a.to_number,
              })
            }
          />
        ) : null}
        <Button
          size="small"
          variant="text"
          icon={more ? 'chevron-up' : 'chevron-down'}
          label={t('More')}
          onPress={() => {
            animateLayout();
            setMore((open) => !open);
          }}
        />
      </View>
      {more ? (
        <View style={styles.actions}>
          <Button
            icon="edit"
            variant="secondary"
            label={a.needs_review || a.outcome === 'unclear' ? t('Set outcome') : t('Record outcome')}
            onPress={() => setManual(true)}
          />
          {a.facility_lat !== null && a.facility_lng !== null ? (
            <Button
              icon="directions"
              variant="secondary"
              label={t('Route in Maps')}
              onPress={() => void Linking.openURL(routeLink(props.origin, { lat: a.facility_lat!, lng: a.facility_lng! }))}
            />
          ) : null}
          {a.recording_url ? (
            <Button
              icon="headphones"
              variant="secondary"
              label={t('Open recording')}
              onPress={() => void Linking.openURL(a.recording_url!)}
            />
          ) : null}
          {a.transcript ? (
            <Text style={styles.transcript} selectable>
              {a.transcript}
            </Text>
          ) : null}
        </View>
      ) : null}
      {manual ? (
        <ManualOutcome
          attempt={a}
          onClose={() => setManual(false)}
          onSave={(body) => props.act(`/api/attempts/${a.id}/manual-outcome`, body)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.space.m },
  head: { flexDirection: 'row', gap: theme.space.m, alignItems: 'center' },
  headText: { flex: 1, gap: 2 },
  rank: {
    width: theme.size.rank,
    height: theme.size.rank,
    borderRadius: theme.size.rank / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: { ...theme.type.captionStrong, color: theme.color.onPrimary },
  name: { ...theme.type.rowTitle, color: theme.color.textPrimary },
  nameQuiet: { color: theme.color.textSecondary },
  meta: { ...theme.type.caption, color: theme.tint.muted },
  detail: { backgroundColor: theme.color.surfaceMuted, borderRadius: theme.radius.field, padding: theme.space.m, gap: theme.space.xs },
  detailText: { ...theme.type.secondary, color: theme.color.textPrimary },
  condition: { color: theme.color.status.pendingFg },
  quote: {
    ...theme.type.secondary,
    backgroundColor: theme.color.status.pendingBg,
    borderRadius: theme.radius.field,
    padding: theme.space.m,
    color: theme.color.status.pendingFg,
  },
  actions: { gap: theme.space.s },
  transcript: {
    ...theme.type.caption,
    color: theme.color.textSecondary,
    backgroundColor: theme.color.surfaceMuted,
    borderRadius: theme.radius.field,
    padding: theme.space.m,
  },
});
