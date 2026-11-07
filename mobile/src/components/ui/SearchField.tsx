import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { t } from '../../lib/i18n';
import theme from '../../theme';
import Icon from './Icon';

/** The search box a page shows under its header when its search button is tapped: a magnifier, the text, and a clear button. */
export default function SearchField({
  value,
  onChangeText,
  placeholder,
  testID,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  testID?: string;
}) {
  return (
    <View style={styles.box}>
      <Icon name="search" size={theme.size.icon} color={theme.color.textTertiary} />
      <TextInput
        testID={testID}
        accessibilityLabel={placeholder}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.color.textTertiary}
        autoFocus
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="search"
        style={styles.input}
      />
      {value ? (
        <Pressable accessibilityRole="button" accessibilityLabel={t('Clear search')} hitSlop={10} onPress={() => onChangeText('')}>
          <Icon name="close" size={theme.size.icon} color={theme.color.textTertiary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.space.s,
    minHeight: theme.size.field,
    paddingHorizontal: theme.space.m,
    borderRadius: theme.radius.field,
    borderWidth: 1.5,
    borderColor: theme.color.borderStrong,
    backgroundColor: theme.color.surface,
  },
  input: { ...theme.type.body, flex: 1, minWidth: 0, color: theme.color.textPrimary, paddingVertical: theme.space.s },
});
