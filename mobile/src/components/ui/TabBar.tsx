import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../../theme';
import { t, type Phrase } from '../../lib/i18n';
import Icon, { type IconName } from './Icon';
import PressScale from './PressScale';
import useTransition from './useTransition';

export type TabDef<K extends string = string> = { key: K; label: Phrase; icon: IconName };

export type TabBarProps<K extends string> = {
  tabs: readonly TabDef<K>[];
  activeKey: K;
  onTabPress: (key: K) => void;
  badges?: Partial<Record<K, boolean>>;
  style?: ViewStyle;
};

const ICON_SIZE = 22;

/** One tab: its pill fades in behind the icon and label when it opens, and fades out when another does. */
function Tab({ tab, active, badge, onPress }: { tab: TabDef; active: boolean; badge: boolean; onPress: () => void }) {
  const on = useTransition(active);
  const fill = on.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255, 241, 243, 0)', theme.tabBar.active] });
  const label = badge ? t('{label}, new items', { label: t(tab.label) }) : t(tab.label);
  return (
    <PressScale
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.tab}
      fill={{ backgroundColor: fill, borderRadius: theme.radius.field }}
    >
      <View>
        <Icon
          name={tab.icon}
          size={ICON_SIZE}
          color={active ? theme.tabBar.activeIcon : theme.tabBar.icon}
          weight={active ? 'fill' : 'regular'}
        />
        {badge ? <View style={styles.badge} /> : null}
      </View>
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

/** The bottom bar: a white strip with a hairline on top, and the open tab in a rose pill with a crimson icon. */
export default function TabBar<K extends string>({ tabs, activeKey, onTabPress, badges, style }: TabBarProps<K>) {
  const insets = useSafeAreaInsets();
  return (
    <View accessibilityRole="tablist" style={[styles.bar, { paddingBottom: Math.max(insets.bottom, theme.space.s) }, style]}>
      {tabs.map((tab) => (
        <View key={tab.key} style={styles.slot}>
          <Tab tab={tab} active={tab.key === activeKey} badge={!!badges?.[tab.key]} onPress={() => onTabPress(tab.key)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: theme.space.xs,
    paddingTop: theme.space.s,
    paddingHorizontal: theme.space.m,
    backgroundColor: theme.tabBar.fill,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.tabBar.edge,
  },
  slot: { flex: 1 },
  tab: { alignItems: 'center', gap: 2, paddingVertical: theme.space.s - 2, borderRadius: theme.radius.field },
  label: { fontFamily: theme.font.medium, fontSize: 12, lineHeight: 15 },
  badge: {
    position: 'absolute',
    top: -1,
    right: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.color.alert.fg,
    borderWidth: 1.5,
    borderColor: theme.tabBar.fill,
  },
});
