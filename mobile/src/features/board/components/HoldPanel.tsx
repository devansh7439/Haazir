import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { AttemptView, ReferralView } from '../../../api/schema';
import Banner from '../../../components/ui/Banner';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Icon from '../../../components/ui/Icon';
import Illustration from '../../../components/ui/Illustration';
import StatusPill from '../../../components/ui/StatusPill';
import { LANGUAGE_LABEL, attemptDisplay, clock, shortName } from '../../../lib/display';
import { phrase, t } from '../../../lib/i18n';
import { statusText, wordText } from '../../../lib/localize';
import theme from '../../../theme';
import CancelSheet from './CancelSheet';

const MESSAGES = [
  { audience: 'receiving_facility', label: phrase('Pre-arrival note to hospital') },
  { audience: 'referrer', label: phrase('Confirmation to you') },
  { audience: 'family', label: phrase('Family update') },
] as const;

const ended = (a: AttemptView) => ['no_answer', 'busy', 'failed'].includes(a.status);

/** After a hospital is chosen: the bed hold, the WhatsApp handoff, the family call and the released hospitals. */
export default function HoldPanel(props: {
  view: ReferralView;
  hold: AttemptView | null;
  releases: AttemptView[];
  holdExpired: boolean;
  facilityName: (id: unknown) => string;
  nowMs: number;
  act: (path: string, body?: unknown) => Promise<boolean>;
}) {
  const { view, hold } = props;
  const r = view.referral;
  const selected = view.attempts.find((a) => a.id === r.selected_attempt_id);
  const name = shortName(selected?.facility_name ?? hold?.facility_name);
  const contact = hold?.contact_person || selected?.contact_person;
  const [cancelling, setCancelling] = useState(false);

  if (r.status === 'confirming') {
    const display = hold ? attemptDisplay(hold, props.nowMs) : null;
    return (
      <Banner
        tone="info"
        title={t('Confirming the bed with {name}', { name })}
        body={
          display
            ? t('{status}. The desk is being asked to keep the bed ready.', { status: statusText(display.text) })
            : t('Placing the confirmation call…')
        }
      />
    );
  }

  const family = view.attempts.filter((a) => a.purpose === 'family_update');
  const arrival = view.attempts.filter((a) => a.purpose === 'arrival_check');
  const progress = (a: AttemptView, doneOutcome: string, doneText: string) => {
    const done = a.outcome === doneOutcome;
    return {
      done,
      tone: done ? ('green' as const) : ended(a) ? ('dark' as const) : ('amber' as const),
      icon: done ? ('check' as const) : ended(a) ? ('ban' as const) : ('oncall' as const),
      text: done ? doneText : ended(a) ? t('No answer') : t('Calling'),
    };
  };

  return (
    <Card padded={false} tone="muted" style={styles.card}>
      {r.status === 'confirmed' ? (
        <View style={styles.heldArt}>
          <Illustration name="hold" width={200} />
        </View>
      ) : null}
      {r.status === 'confirmed' ? (
        <View style={styles.held} testID="bed-held">
          <Icon name="lock" size={theme.size.iconLarge} color={theme.color.onPrimary} />
          <View style={styles.heldText}>
            <Text style={styles.heldTitle}>{t('Bed held at {name}', { name })}</Text>
            <Text style={styles.heldSub}>
              {`${t('Until {time}', { time: clock(r.hold_expires_at) })}${contact ? ` · ${t('ask for {name}', { name: contact })}` : ''}${
                selected?.eta_minutes ? ` · ${t('{minutes} min away', { minutes: selected.eta_minutes })}` : ''
              }`}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.section}>
          <Text style={styles.heading}>{t('Referral cancelled · releasing hospitals that said yes')}</Text>
        </View>
      )}

      {view.messages.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.row}>
            <Text style={styles.eyebrow}>{t('WhatsApp handoff')}</Text>
          </View>
          {MESSAGES.map(({ audience, label }) => {
            const m = view.messages.find((x) => x.audience === audience);
            if (!m) return null;
            return (
              <View key={audience} style={styles.message}>
                <View style={styles.row}>
                  <Text style={styles.item}>{t(label)}</Text>
                  <StatusPill
                    size="small"
                    tone={m.status === 'failed' ? 'red' : m.status === 'simulated' ? 'grey' : 'green'}
                    label={wordText(m.status === 'simulated' ? 'not sent' : m.status)}
                    icon={m.status === 'failed' ? 'x' : 'check'}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ) : null}

      {family.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>{t('Family')}</Text>
          {family.map((a) => {
            const p = progress(a, 'family_informed', t('Informed'));
            return (
              <View key={a.id} style={styles.row}>
                <Text style={styles.item}>
                  {t('Update call ({language})', { language: t(LANGUAGE_LABEL[a.call_language] ?? a.call_language) })}
                </Text>
                <StatusPill size="small" tone={p.tone} label={p.text} icon={p.icon} />
              </View>
            );
          })}
        </View>
      ) : null}

      {arrival.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>{t('Arrival')}</Text>
          {arrival.map((a) => {
            const d = attemptDisplay(a, props.nowMs);
            return (
              <View key={a.id} style={styles.row}>
                <Text style={styles.item}>{t('Asked {name} whether the patient arrived', { name: props.facilityName(a.facility_id) })}</Text>
                <StatusPill size="small" tone={d.tone} label={statusText(d.text)} icon={d.icon} />
              </View>
            );
          })}
        </View>
      ) : null}

      {props.releases.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>{t('Released')}</Text>
          {props.releases.map((a) => {
            const p = progress(a, 'release_ack', t('Released'));
            return (
              <View key={a.id} style={styles.row}>
                <Text style={styles.item}>{props.facilityName(a.facility_id)}</Text>
                <StatusPill size="small" tone={p.tone} label={p.text} icon={p.icon} />
              </View>
            );
          })}
        </View>
      ) : null}

      {r.status === 'confirmed' ? (
        <View style={[styles.section, styles.actions]}>
          {props.holdExpired ? <Text style={styles.expired}>{t('Hold expired. Did the patient arrive?')}</Text> : null}
          <Button
            icon="check"
            label={t('Patient arrived')}
            testID="patient-arrived"
            onPress={() => props.act(`/api/referrals/${r.id}/close`, { reason: 'arrived' })}
          />
          {props.holdExpired ? (
            <Button
              label={t('Close')}
              variant="secondary"
              onPress={() => props.act(`/api/referrals/${r.id}/close`, { reason: 'hold_expired' })}
            />
          ) : null}
          <Button variant="danger" label={t('Cancel referral')} onPress={() => setCancelling(true)} />
        </View>
      ) : null}
      {cancelling ? (
        <CancelSheet
          onClose={() => setCancelling(false)}
          onCancel={async (reason) => void (await props.act(`/api/referrals/${r.id}/cancel`, { reason }))}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heldArt: { alignItems: 'center', paddingTop: theme.space.l },
  card: { backgroundColor: theme.color.surface, shadowOpacity: 0.06, elevation: 1 },
  held: {
    backgroundColor: theme.color.status.verifiedFg,
    flexDirection: 'row',
    gap: theme.space.m,
    padding: theme.space.l,
    alignItems: 'center',
  },
  heldText: { flex: 1 },
  heldTitle: { ...theme.type.rowTitle, color: theme.color.onPrimary },
  heldSub: { ...theme.type.caption, color: theme.color.status.verifiedBg, marginTop: 2 },
  section: { padding: theme.space.l, gap: theme.space.m, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.tint.hairline },
  actions: { gap: theme.space.s },
  heading: { ...theme.type.bodyStrong, color: theme.color.textPrimary },
  eyebrow: { ...theme.type.captionStrong, color: theme.color.textSecondary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: theme.space.s },
  message: { gap: theme.space.s },
  item: { ...theme.type.secondary, flex: 1, color: theme.color.textPrimary },
  expired: { ...theme.type.bodyStrong, color: theme.color.status.pendingFg },
});
