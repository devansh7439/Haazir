import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../../theme';
import { t, type Phrase } from '../../lib/i18n';
import Glass from './Glass';
import Icon, { type IconName } from './Icon';
import PressScale from './PressScale';
import useTransition from './useTransition';

export type TabDef<K extends string = string> = { key: K; label: Phrase; icon: IconName };

export type TabBarProps<K extends string> = {
  tabs: readonly TabDef<K>[];
  activeKey: K;
  onTabPress: (key: K) => void;
  style?: ViewStyle;
};

const ICON_SIZE = 22;
const BAR_RADIUS = 28;

/** One tab: its pill fades in behind the icon and label when it opens, and fades out when another does. */
function Tab({ tab, active, onPress }: { tab: TabDef; active: boolean; onPress: () => void }) {
  const on = useTransition(active);
  const fill = on.interpolate({ inputRange: [0, 1], outputRange: ['rgba(212, 46, 69, 0)', theme.tabBar.active] });
  return (
    <PressScale
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={t(tab.label)}
      onPress={onPress}
      style={styles.tab}
      fill={{ backgroundColor: fill, borderRadius: theme.radius.field }}
    >
      <Icon
        name={tab.icon}
        size={ICON_SIZE}
        color={active ? theme.tabBar.activeIcon : theme.tabBar.icon}
        weight={active ? 'fill' : 'regular'}
      />
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
        style={[styles.label, { color: active ? theme.tabBar.activeLabel : theme.tabBar.label }]}
      >
        {t(tab.label)}
      </Text>
    </PressScale>
  );
}

/** The bottom bar: a floating capsule of glass over the page, with the open tab in a rose pill with a crimson icon. */
export default function TabBar<K extends string>({ tabs, activeKey, onTabPress, style }: TabBarProps<K>) {
  const insets = useSafeAreaInsets();
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.float, { marginBottom: Math.max(insets.bottom, theme.space.s) }, style]}
    >
      <Glass radius={BAR_RADIUS} style={styles.bar}>
        {tabs.map((tab) => (
          <View key={tab.key} style={styles.slot}>
            <Tab tab={tab} active={tab.key === activeKey} onPress={() => onTabPress(tab.key)} />
          </View>
        ))}
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  float: { marginHorizontal: theme.space.l },
  bar: { flexDirection: 'row', gap: theme.space.xs, padding: theme.space.xs },
  slot: { flex: 1 },
  tab: { alignItems: 'center', gap: 2, paddingVertical: theme.space.s - 2, borderRadius: BAR_RADIUS - theme.space.xs },
  label: { fontFamily: theme.font.medium, fontSize: 12, lineHeight: 15 },
});
