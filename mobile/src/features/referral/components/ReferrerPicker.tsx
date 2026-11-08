import { StyleSheet, View } from 'react-native';
import type { Referrer } from '../../../api/schema';
import Banner from '../../../components/ui/Banner';
import OptionTile from '../../../components/ui/OptionTile';
import Screen from '../../../components/ui/Screen';
import ScreenHeader from '../../../components/ui/ScreenHeader';
import { shortName } from '../../../lib/display';
import { t } from '../../../lib/i18n';
import theme from '../../../theme';

/** For a coordinator or admin: choose the doctor the referral is placed for, before the form opens. */
export default function ReferrerPicker({
  referrers,
  onPick,
  onBack,
}: {
  referrers: Referrer[];
  onPick: (id: string) => void;
  onBack: () => void;
}) {
  return (
    <Screen testID="referrer-picker" header={<ScreenHeader title={t('Who is referring?')} onBack={onBack} />}>
      {referrers.length === 0 ? (
        <Banner
          tone="warning"
          title={t('No referring doctor')}
          body={t('No referring doctor is set up for this account. Ask an admin to add one.')}
        />
      ) : (
        <View style={styles.list}>
          {referrers.map((r) => (
            <OptionTile
              key={r.id}
              layout="row"
              label={`${shortName(r.name)}${r.facility ? ` · ${shortName(r.facility)}` : ''}`}
              onPress={() => onPick(r.id)}
              testID={`referrer-${r.id}`}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({ list: { gap: theme.space.s } });
