import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t, useUiLanguage, type UiLanguage } from '../../lib/i18n';
import { chooseLanguage } from '../../lib/i18n/deviceLanguage';
import theme from '../../theme';
import BrandMark from './BrandMark';
import IconButton from './IconButton';

const LANGUAGES: { value: UiLanguage; label: string; name: string }[] = [
  { value: 'en', label: 'EN', name: 'English' },
  { value: 'hi', label: 'हिं', name: 'हिन्दी' },
];

/**
 * The top bar of the home tab, as on raktkhoj.org's phone site: the logo tile and wordmark at the left, then the EN / हिं
 * switch and the account button, on white with a hairline under it.
 */
export default function AppBar({ onAccount }: { onAccount: () => void }) {
  const insets = useSafeAreaInsets();
  const language = useUiLanguage();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + theme.space.s }]}>
      <View style={styles.brand} accessibilityRole="header">
        <BrandMark size={36} />
        <Text style={styles.word}>
          Haa<Text style={styles.wordAccent}>zir</Text>
        </Text>
      </View>
      <View style={styles.right}>
        <View style={styles.switch} accessibilityRole="radiogroup">
          {LANGUAGES.map((item) => {
            const on = item.value === language;
            return (
              <Pressable
                key={item.value}
                accessibilityRole="radio"
                accessibilityLabel={item.name}
                accessibilityState={{ selected: on }}
                onPress={() => chooseLanguage(item.value)}
                hitSlop={{ top: 6, bottom: 6 }}
                style={[styles.option, on && styles.optionOn]}
              >
                <Text style={[styles.optionText, on && styles.optionTextOn]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <IconButton icon="user" label={t('Account')} variant="tinted" onPress={onAccount} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.space.m,
    paddingHorizontal: theme.size.screenPadding,
    paddingBottom: theme.space.m,
    backgroundColor: theme.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: theme.space.s },
  word: { ...theme.type.title, fontFamily: theme.font.displayBold, color: theme.tint.heading },
  wordAccent: { color: theme.color.primary },
  right: { flexDirection: 'row', alignItems: 'center', gap: theme.space.s },
  switch: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    gap: 2,
    borderRadius: theme.radius.field,
    borderWidth: 1,
    borderColor: theme.color.border,
    backgroundColor: theme.color.surface,
  },
  option: { minWidth: 40, minHeight: 32, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.space.s, borderRadius: theme.radius.small },
  optionOn: { backgroundColor: theme.color.primary },
  optionText: { ...theme.type.captionStrong, color: theme.color.textSecondary },
  optionTextOn: { color: theme.color.onPrimary },
});
