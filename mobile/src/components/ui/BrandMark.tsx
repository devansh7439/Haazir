import { StyleSheet, View } from 'react-native';
import theme from '../../theme';
import { t } from '../../lib/i18n';
import Icon from './Icon';

/** Haazir's mark: a heartbeat line on a near-black tile. */
export default function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={t('Haazir')}
      style={[styles.tile, { width: size, height: size, borderRadius: size * 0.3 }]}
    >
      <Icon name="pulse" size={size * 0.55} color={theme.color.onPrimary} />
    </View>
  );
}

const styles = StyleSheet.create({ tile: { backgroundColor: theme.color.primary, alignItems: 'center', justifyContent: 'center' } });
