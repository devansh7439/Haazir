import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../../theme';
import BrandMark from './BrandMark';

/** The top bar of the home tab: the logo tile and wordmark, on white with a hairline under it. Language and account live in the Account tab. */
export default function AppBar() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + theme.space.s }]}>
      <View style={styles.brand} accessibilityRole="header">
        <BrandMark size={36} />
        <Text style={styles.word}>
          Haa<Text style={styles.wordAccent}>zir</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.size.screenPadding,
    paddingBottom: theme.space.m,
    backgroundColor: theme.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: theme.space.s },
  word: { ...theme.type.title, fontFamily: theme.font.displayBold, color: theme.tint.heading },
  wordAccent: { color: theme.color.primary },
});
