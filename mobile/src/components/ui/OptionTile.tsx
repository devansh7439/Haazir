import { Animated, StyleSheet, View } from 'react-native';
import theme from '../../theme';
import Icon, { type IconName } from './Icon';
import PressScale from './PressScale';
import useTransition from './useTransition';

export type OptionTileProps = {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  /** A small colour dot before the label; the words carry the meaning, the dot only reinforces it. */
  dot?: string;
  /** `row` puts the icon beside the label; `stack` puts it above. */
  layout?: 'row' | 'stack';
  testID?: string;
};

/** A big, tappable choice: one of a few cases or levels. When picked, its fill turns rose and its edge and words crimson in one short fade. */
export default function OptionTile({ label, selected = false, onPress, icon, dot, layout = 'stack', testID }: OptionTileProps) {
  const on = useTransition(selected);
  const fill = on.interpolate({ inputRange: [0, 1], outputRange: [theme.color.surface, theme.color.primarySoft] });
  const edge = on.interpolate({ inputRange: [0, 1], outputRange: [theme.color.border, theme.color.primary] });
  const words = on.interpolate({ inputRange: [0, 1], outputRange: [theme.color.textPrimary, theme.color.primary] });

  return (
    <PressScale
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={[styles.tile, layout === 'row' && styles.row]}
      fill={{ backgroundColor: fill, borderColor: edge, borderWidth: 1.5, borderRadius: theme.radius.tile }}
    >
      {icon ? (
        <Icon
          name={icon}
          size={theme.size.iconLarge}
          color={selected ? theme.color.primary : theme.color.textPrimary}
          weight={selected ? 'fill' : 'regular'}
        />
      ) : null}
      {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
      <Animated.Text numberOfLines={2} style={[styles.label, { color: words }]}>
        {label}
      </Animated.Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 84,
    justifyContent: 'space-between',
    gap: theme.space.s,
    padding: theme.space.m,
    borderRadius: theme.radius.tile,
  },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  label: { ...theme.type.captionStrong, flexShrink: 1 },
});
