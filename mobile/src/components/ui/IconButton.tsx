import { StyleSheet, View, type ViewStyle } from 'react-native';
import theme from '../../theme';
import Icon, { type IconName } from './Icon';
import PressScale from './PressScale';

export type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: 'plain' | 'tinted';
  badge?: boolean;
  style?: ViewStyle | undefined;
};

/** An icon-only button (`tinted` is the outlined square RaktKhoj uses for its account button) that sinks a little when pressed; the label is what a screen reader says. */
export default function IconButton({ icon, label, onPress, variant = 'plain', badge = false, style }: IconButtonProps) {
  return (
    <PressScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      pressedScale={0.92}
      style={[styles.base, variant === 'tinted' && styles.tinted, style]}
    >
      <Icon name={icon} size={theme.size.iconLarge} color={theme.color.textPrimary} />
      {badge ? <View style={styles.badge} /> : null}
    </PressScale>
  );
}

const styles = StyleSheet.create({
  base: {
    width: theme.size.touch,
    height: theme.size.touch,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tinted: { backgroundColor: theme.color.surface, borderWidth: 1, borderColor: theme.color.border, borderRadius: theme.radius.field },
  badge: {
    position: 'absolute',
    top: 10,
    right: 11,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.color.alert.fg,
    borderWidth: 2,
    borderColor: theme.color.surface,
  },
});
