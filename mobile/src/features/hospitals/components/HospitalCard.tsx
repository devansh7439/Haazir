import { Linking, StyleSheet, Text, View } from 'react-native';
import type { FacilityListItem, Rating } from '../../../api/schema';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Icon from '../../../components/ui/Icon';
import IconButton from '../../../components/ui/IconButton';
import { shortName } from '../../../lib/display';
import { firstDesk, mapsLink, telLink } from '../../../lib/facility';
import { t } from '../../../lib/i18n';
import { shortCount } from '../../../lib/rating';
import theme from '../../../theme';

/** One hospital in the list: its name, its rating if it has one, a call and a route button, and an info button for the rest. */
export default function HospitalCard(props: { facility: FacilityListItem; rating: Rating | undefined; onInfo: () => void }) {
  const { facility: f, rating } = props;
  const desk = firstDesk(f);

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View accessible={false} style={styles.tile}>
          <Icon name="hospital" size={theme.size.iconLarge} color={theme.color.textSecondary} />
        </View>
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={2}>
            {shortName(f.name)}
          </Text>
          {rating ? (
            <Text style={styles.meta}>
              {t('★ {rating} on Google · {count} reviews', { rating: rating.rating.toFixed(1), count: shortCount(rating.count) })}
            </Text>
          ) : null}
        </View>
        <IconButton icon="info" label={t('Details of {name}', { name: shortName(f.name) })} variant="tinted" onPress={props.onInfo} />
      </View>
      <View style={styles.quick}>
        {desk ? (
          <Button
            size="small"
            variant="secondary"
            icon="phone"
            label={t('Call')}
            onPress={() => void Linking.openURL(telLink(desk.phone_e164))}
          />
        ) : null}
        <Button
          size="small"
          variant="secondary"
          icon="directions"
          label={t('Directions')}
          onPress={() => void Linking.openURL(mapsLink(f.lat, f.lng))}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: theme.space.m },
  head: { flexDirection: 'row', alignItems: 'center', gap: theme.space.m },
  tile: { width: 44, height: 44, borderRadius: theme.radius.field, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.color.background },
  headText: { flex: 1, gap: 2 },
  quick: { flexDirection: 'row', gap: theme.space.s },
  name: { ...theme.type.rowTitle, color: theme.color.textPrimary },
  meta: { ...theme.type.caption, color: theme.tint.muted },
});
