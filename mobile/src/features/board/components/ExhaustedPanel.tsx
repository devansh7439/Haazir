import { Linking, StyleSheet, Text, View } from 'react-native';
import type { AttemptView, ReferralView } from '../../../api/schema';
import Banner from '../../../components/ui/Banner';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Illustration from '../../../components/ui/Illustration';
import { attemptDisplay, shortName } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import { statusText } from '../../../lib/localize';
import theme from '../../../theme';
import NearestEdList from './NearestEdList';

/** Nobody accepted: the doctor can phone each desk directly, or widen the search to 80 km. */
export default function ExhaustedPanel({
  view,
  cards,
  nowMs,
  onWiden,
}: {
  view: ReferralView;
  cards: AttemptView[];
  nowMs: number;
  onWiden: () => Promise<void>;
}) {
  const calls = view.attempts.filter((a) => a.purpose === 'availability').length;
  const rounds = view.referral.current_wave;
  return (
    <View style={styles.wrap}>
      <View style={styles.art}>
        <Illustration name="none" width={200} />
      </View>
      <Banner
        tone="alert"
        title={
          rounds === 1
            ? t('No hospital accepted after 1 round ({calls} calls)', { calls })
            : t('No hospital accepted after {rounds} rounds ({calls} calls)', { rounds, calls })
        }
        body={t('Call these desks directly, or widen the search.')}
      />
      <Card style={styles.list}>
        {[...cards]
          .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99))
          .map((a) => (
            <View key={a.id} style={styles.item}>
              <Text style={styles.name}>{`${a.rank ?? '•'}. ${shortName(a.facility_name)}`}</Text>
              <Text style={styles.meta}>
                {t('{minutes} min · last answer: {answer}', {
                  minutes: a.eta_minutes ?? '?',
                  answer: statusText(attemptDisplay(a, nowMs).text),
                })}
              </Text>
              <Button
                size="small"
                variant="secondary"
                icon="phone"
                label={a.to_number}
                onPress={() => void Linking.openURL(`tel:${a.to_number}`)}
              />
            </View>
          ))}
      </Card>
      <Button icon="redial" label={t('Widen to 80 km and try again')} onPress={onWiden} testID="widen" />
      {view.nearest_ed.length > 0 ? (
        <Card style={styles.list}>
          <Text style={styles.name}>{t('Nearest emergency departments · stabilise there')}</Text>
          <NearestEdList hospitals={view.nearest_ed} />
        </Card>
      ) : null}
      <Card style={styles.list}>
        <Text style={styles.meta}>
          {t('If the patient can’t wait, you can hand the search to a control room or stop at the nearest emergency department. Your call.')}
        </Text>
        <View style={styles.emergency}>
          <Button size="small" variant="secondary" icon="phone" label="108" onPress={() => void Linking.openURL('tel:108')} />
          <Button size="small" variant="secondary" icon="phone" label="112" onPress={() => void Linking.openURL('tel:112')} />
          {view.escalation.map((c) => (
            <Button key={c.phone} size="small" variant="secondary" icon="phone" label={c.label} onPress={() => void Linking.openURL(`tel:${c.phone}`)} />
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: theme.space.m },
  art: { alignItems: 'center' },
  list: { gap: theme.space.l },
  item: { gap: theme.space.s },
  name: { ...theme.type.bodyStrong, color: theme.color.textPrimary },
  meta: { ...theme.type.caption, color: theme.tint.muted },
  emergency: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.s },
});
