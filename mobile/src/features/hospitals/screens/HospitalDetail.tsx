import { Linking, StyleSheet, Text, View } from 'react-native';
import { FacilityRepository } from '../../../api/facility.repository';
import { useLoad } from '../../../api/useLoad';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import EmptyState from '../../../components/ui/EmptyState';
import ErrorState from '../../../components/ui/ErrorState';
import Icon from '../../../components/ui/Icon';
import Screen from '../../../components/ui/Screen';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import { LANGUAGE_LABEL, shortName } from '../../../lib/display';
import { CONTACT_ROLE_LABEL, KIND_LABEL, OWNERSHIP_LABEL, firstDesk, groupByCategory, mapsLink, telLink } from '../../../lib/facility';
import { t } from '../../../lib/i18n';
import { shortCount } from '../../../lib/rating';
import { useSignedIn } from '../../../lib/session/SessionProvider';
import { useSettings } from '../../../lib/settings';
import type { RootScreenProps } from '../../../navigation/types';
import theme from '../../../theme';

const label = (labels: Record<string, string>, key: string) => t(labels[key] ?? key);

const Stat = ({ value, caption }: { value: number; caption: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statCaption}>{caption}</Text>
  </View>
);

const Detail = ({ name, value, last }: { name: string; value: string; last?: boolean }) => (
  <View style={[styles.detail, !last && styles.divider]}>
    <Text style={styles.detailName}>{name}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

/** Everything the app knows about one hospital, laid out in cards: who it is, how to reach it, what it offers and how it has answered. */
export default function HospitalDetail({ route, navigation }: RootScreenProps<'HospitalDetail'>) {
  const { id } = route.params;
  const { boot } = useSignedIn();
  const settings = useSettings();
  const { data, error, loading, reload } = useLoad(FacilityRepository.list, []);
  const ratings = useLoad(FacilityRepository.ratings, []).data?.ratings ?? {};
  const f = data?.facilities.find((x) => x.id === id);
  const rating = settings.showRatings ? ratings[id] : undefined;
  const header = <ScreenHeader title={f ? shortName(f.name) : t('Hospital')} onBack={navigation.goBack} />;

  if (!f) {
    return (
      <Screen testID="hospital-detail" header={header}>
        {error ? <ErrorState message={error} onRetry={reload} what={t('the hospital')} /> : null}
        {!loading && !error ? <EmptyState art="search" title={t('This hospital is no longer listed.')} /> : null}
      </Screen>
    );
  }

  const desk = firstDesk(f);
  const contacts = f.contacts.filter((c) => c.active).sort((a, b) => Number(a.is_ivr) - Number(b.is_ivr) || a.priority - b.priority);
  const groups = groupByCategory(boot.capabilities, f.capabilities);
  const place = [f.city, f.district].filter((x): x is string => !!x && x.length > 0).join(', ');

  return (
    <Screen testID="hospital-detail" header={header}>
      <Card style={styles.hero}>
        <Text style={styles.kind}>{label(KIND_LABEL, f.kind)}</Text>
        {f.address || place ? (
          <View style={styles.place}>
            <Icon name="pin" size={theme.size.icon} color={theme.color.textTertiary} />
            <Text style={styles.placeText}>{[f.address, place].filter(Boolean).join('\n')}</Text>
          </View>
        ) : null}
        {rating ? (
          <View style={styles.place}>
            <Icon name="star" size={theme.size.icon} color={theme.color.textTertiary} weight="fill" />
            <Text style={styles.placeText}>
              {t('★ {rating} on Google · {count} reviews', { rating: rating.rating.toFixed(1), count: shortCount(rating.count) })}
            </Text>
          </View>
        ) : null}
      </Card>

      <View style={styles.actions}>
        {desk ? <Button icon="phone" label={t('Call desk')} onPress={() => void Linking.openURL(telLink(desk.phone_e164))} /> : null}
        <Button
          icon="directions"
          variant="secondary"
          label={t('Directions')}
          onPress={() => void Linking.openURL(mapsLink(f.lat, f.lng))}
        />
        {rating?.url ? (
          <Button icon="star" variant="text" label={t('Reviews on Google')} onPress={() => void Linking.openURL(rating.url!)} />
        ) : null}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('Desk numbers')}
        </Text>
        {contacts.length === 0 ? (
          <Text style={styles.empty}>{t('No desk number yet. Add one on the web console.')}</Text>
        ) : (
          <Card padded={false}>
            {contacts.map((c, index) => (
              <View key={c.id} style={[styles.contact, index > 0 && styles.dividerTop]}>
                <View style={styles.contactText}>
                  <Text style={styles.contactRole}>{label(CONTACT_ROLE_LABEL, c.role)}</Text>
                  <Text style={styles.contactNumber}>{c.phone_e164}</Text>
                  {c.is_ivr ? <Text style={styles.contactNote}>{t('Phone menu line: a direct number works better.')}</Text> : null}
                </View>
                <Button
                  size="small"
                  variant="secondary"
                  icon="phone"
                  label={t('Call')}
                  onPress={() => void Linking.openURL(telLink(c.phone_e164))}
                />
              </View>
            ))}
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('Services')}
        </Text>
        {groups.length === 0 ? (
          <Text style={styles.empty}>{t('No services listed yet.')}</Text>
        ) : (
          <Card style={styles.services}>
            {groups.map((g) => (
              <View key={g.category} style={styles.group}>
                <Text style={styles.groupTitle}>{t(g.title)}</Text>
                <View style={styles.chips}>
                  {g.items.map((c) => (
                    <View key={c.code} style={styles.chip}>
                      <Text style={styles.chipText}>{c.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('Track record')}
        </Text>
        {f.availability_calls > 0 ? (
          <View style={styles.stats}>
            <Stat value={f.availability_calls} caption={t('calls placed')} />
            <Stat value={f.answered} caption={t('answered')} />
            <Stat value={f.accepted} caption={t('said yes')} />
          </View>
        ) : (
          <Text style={styles.empty}>{t('Haazir has not phoned this hospital yet.')}</Text>
        )}
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          {t('Details')}
        </Text>
        <Card>
          <Detail name={t('Type')} value={label(KIND_LABEL, f.kind)} />
          <Detail name={t('Ownership')} value={label(OWNERSHIP_LABEL, f.ownership)} />
          <Detail name={t('Calls are placed in')} value={label(LANGUAGE_LABEL, f.call_language)} last={!place} />
          {place ? <Detail name={t('Area')} value={place} last /> : null}
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { gap: theme.space.s, paddingVertical: theme.space.l },
  kind: { ...theme.type.captionStrong, color: theme.tint.muted },
  place: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.s },
  placeText: { ...theme.type.secondary, color: theme.color.textSecondary, flexShrink: 1 },
  actions: { gap: theme.space.s },
  section: { gap: theme.space.s },
  heading: { ...theme.type.title, color: theme.tint.ink },
  empty: { ...theme.type.secondary, color: theme.tint.muted },
  contact: { flexDirection: 'row', alignItems: 'center', gap: theme.space.m, padding: theme.space.l },
  contactText: { flex: 1, gap: 2 },
  contactRole: { ...theme.type.captionStrong, color: theme.tint.muted },
  contactNumber: { ...theme.type.bodyStrong, color: theme.color.textPrimary, fontVariant: ['tabular-nums'] },
  contactNote: { ...theme.type.caption, color: theme.color.status.pendingFg },
  dividerTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.tint.hairline },
  services: { gap: theme.space.l },
  group: { gap: theme.space.s },
  groupTitle: { ...theme.type.captionStrong, color: theme.color.textSecondary },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.space.s },
  chip: {
    paddingHorizontal: theme.space.m,
    paddingVertical: theme.space.s - 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.tint.tile,
  },
  chipText: { ...theme.type.caption, color: theme.color.textPrimary },
  stats: { flexDirection: 'row', gap: theme.space.s },
  stat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: theme.space.l,
    borderRadius: theme.radius.tile,
    backgroundColor: theme.color.surface,
    borderWidth: 1,
    borderColor: theme.color.border,
  },
  statValue: { ...theme.type.figure, color: theme.color.textPrimary },
  statCaption: { ...theme.type.caption, color: theme.tint.muted },
  detail: { gap: 2, paddingVertical: theme.space.m },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.tint.hairline },
  detailName: { ...theme.type.label, color: theme.tint.muted },
  detailValue: { ...theme.type.body, color: theme.color.textPrimary },
});
