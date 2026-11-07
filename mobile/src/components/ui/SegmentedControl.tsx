import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import theme from '../../theme';
import useReducedMotion from './useReducedMotion';

const TRACK_PADDING = 4;

export type Segment<V extends string> = { value: V; label: string };

export type SegmentedControlProps<V extends string> = { value: V; segments: Segment<V>[]; onChange: (value: V) => void; style?: ViewStyle };

/** One choice out of a few in a grey track: a white thumb slides to the chosen one, so the change reads as movement and not a jump. */
export default function SegmentedControl<V extends string>({ value, segments, onChange, style }: SegmentedControlProps<V>) {
  const [width, setWidth] = useState(0);
  const reduced = useReducedMotion();
  const index = Math.max(
    segments.findIndex((segment) => segment.value === value),
    0,
  );
  const segmentWidth = Math.max(width - TRACK_PADDING * 2, 0) / Math.max(segments.length, 1);
  const slide = useRef(new Animated.Value(index)).current;

  useEffect(() => {
    if (reduced !== false) {
      slide.setValue(index);
      return;
    }
    Animated.timing(slide, { toValue: index, duration: theme.motion.base, easing: theme.easing.slide, useNativeDriver: true }).start();
  }, [index, reduced, slide]);

  return (
    <View accessibilityRole="tablist" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[styles.track, style]}>
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.thumb, { width: segmentWidth, transform: [{ translateX: Animated.multiply(slide, segmentWidth) }] }]}
        />
      ) : null}
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(segment.value)}
            style={styles.segment}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.85}
              style={[styles.label, { color: active ? theme.color.primary : theme.color.textSecondary }]}
            >
              {segment.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', backgroundColor: theme.tint.tile, borderRadius: theme.radius.field + 2, padding: TRACK_PADDING },
  thumb: {
    position: 'absolute',
    top: TRACK_PADDING,
    bottom: TRACK_PADDING,
    left: TRACK_PADDING,
    borderRadius: theme.radius.field,
    backgroundColor: theme.tint.paper,
    ...theme.elevation.card,
  },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: theme.size.touch + 4, paddingHorizontal: theme.space.xs },
  label: { ...theme.type.label, fontSize: 14 },
});
