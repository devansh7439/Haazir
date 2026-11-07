import { Animated, StyleSheet } from 'react-native';
import theme from '../../theme';
import PressScale from './PressScale';
import useTransition from './useTransition';

export type FilterChipProps = { label: string; selected?: boolean; onPress: () => void; dropdown?: boolean; active?: boolean };

/** A pill that is picked or not; its fill and its words fade between the two instead of snapping. With `dropdown` it opens something instead. */
export default function FilterChip({ label, selected = false, onPress, dropdown = false, active = false }: FilterChipProps) {
  const on = useTransition(selected);
  const lit = useTransition(dropdown && active);
  const fill = on.interpolate({ inputRange: [0, 1], outputRange: [theme.color.surface, theme.color.primarySoft] });
  const edge = on.interpolate({ inputRange: [0, 1], outputRange: [theme.color.border, theme.color.primary] });
  const dropEdge = lit.interpolate({ inputRange: [0, 1], outputRange: [theme.color.border, theme.color.primary] });
  const words = on.interpolate({ inputRange: [0, 1], outputRange: [theme.color.textPrimary, theme.color.primary] });

  return (
    <PressScale
      accessibilityRole={dropdown ? 'button' : 'radio'}
      accessibilityState={dropdown ? undefined : { selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 4, bottom: 4 }}
      style={styles.chip}
      fill={{
        backgroundColor: fill,
        borderRadius: theme.radius.pill,
        borderWidth: 1,
        borderColor: dropdown ? dropEdge : edge,
      }}
    >
      <Animated.Text numberOfLines={1} style={[styles.label, { color: words }]}>
        {label}
      </Animated.Text>
    </PressScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    flexShrink: 0,
    gap: theme.space.s,
    minHeight: 40,
    maxWidth: 280,
    paddingHorizontal: theme.space.l,
    borderRadius: theme.radius.pill,
  },
  label: { ...theme.type.body, fontFamily: theme.font.medium },
});
