import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../../theme';
import { t } from '../../lib/i18n';
import IconButton from './IconButton';

export type ScreenHeaderProps = {
  title?: string;
  subtitle?: string;
  /** Shows a back arrow at the left, and a smaller title beside it. */
  onBack?: (() => void) | undefined;
  /** Beside the search button, at the top right. */
  right?: ReactNode;
  /** Shows the search button at the top right; the page opens its own search when it is tapped. */
  onSearch?: () => void;
  /** The page's search is open: the button then closes it. */
  searching?: boolean;
  safeTop?: boolean;
  style?: ViewStyle;
};

/** The top of a page, white with a hairline under it: an optional back arrow, a bold title, and, on pages with a search of their own, its button at the right. */
export default function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  onSearch,
  searching = false,
  safeTop = true,
  style,
}: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const topInset = (safeTop ? insets.top : 0) + theme.space.m;
  const small = !!onBack;

  return (
    <View style={[styles.container, { paddingTop: topInset }, style]}>
      <View style={styles.row}>
        {onBack ? <IconButton icon="back" label={t('Back')} variant="tinted" onPress={onBack} /> : null}
        <View style={styles.titleBlock}>
          {title ? (
            <Text accessibilityRole="header" numberOfLines={2} style={small ? styles.title : styles.titleBig}>
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text numberOfLines={2} style={small ? styles.subtitle : styles.subtitleBig}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right || onSearch ? (
          <View style={styles.right}>
            {right}
            {onSearch ? (
              <IconButton
                icon={searching ? 'close' : 'search'}
                label={searching ? t('Close search') : t('Search')}
                variant="tinted"
                onPress={onSearch}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: theme.size.screenPadding,
    paddingBottom: theme.space.m,
    backgroundColor: theme.color.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.color.border,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: theme.space.m },
  titleBlock: { flex: 1, minHeight: theme.size.touch, justifyContent: 'center' },
  title: { ...theme.type.heading, color: theme.tint.heading },
  titleBig: { ...theme.type.pageTitle, color: theme.tint.heading },
  subtitle: { ...theme.type.caption, color: theme.tint.muted, marginTop: 2 },
  subtitleBig: { ...theme.type.secondary, color: theme.tint.muted, marginTop: theme.space.xs },
  right: { flexDirection: 'row', alignItems: 'center', gap: theme.space.xs },
});
