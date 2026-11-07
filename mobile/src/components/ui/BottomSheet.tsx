import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, Easing, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../../theme';
import useKeyboardHeight from './useKeyboardHeight';
import { t } from '../../lib/i18n';

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string | undefined;
  subtitle?: string | undefined;
  children: ReactNode;
  footer?: ReactNode | undefined;
  scrollable?: boolean;
};

const SCREEN_HEIGHT = Dimensions.get('window').height;

/** A panel that slides up over the page with a dimmed backdrop; it lifts clear of the keyboard and closes on a tap outside. */
export default function BottomSheet({ visible, onClose, title, subtitle, children, footer, scrollable = true }: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const keyboardHeight = useKeyboardHeight();
  const sheetRef = useRef<ComponentRef<typeof View>>(null);
  const rootRef = useRef<ComponentRef<typeof View>>(null);
  // How far the sheet has to rise to clear the keyboard. Measured rather than assumed: Android
  // resizes the window for the keyboard in some setups and not in others, and guessing wrong
  // either buries the footer button or leaves a gap under the sheet.
  const [lift, setLift] = useState(0);

  useEffect(() => {
    if (keyboardHeight === 0) {
      setLift(0);
      return;
    }
    // Let the window settle first: measuring mid-resize reports the pre-resize position and
    // lifts the sheet a second time, leaving a gap below it.
    const id = setTimeout(() => {
      rootRef.current?.measureInWindow((_rx, rootY, _rw, rootHeight) => {
        sheetRef.current?.measureInWindow((_x, y, _width, height) => {
          const keyboardTop = Math.min(rootY + rootHeight, Dimensions.get('window').height - keyboardHeight);
          const overlap = y + height - keyboardTop;
          setLift(overlap > 1 ? overlap : 0);
        });
      });
    }, 220);
    return () => clearTimeout(id);
  }, [keyboardHeight]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: theme.motion.settle,
        easing: Easing.bezier(0.16, 1, 0.3, 1),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: theme.motion.base,
        easing: Easing.bezier(0.2, 0, 0.2, 1),
        useNativeDriver: true,
      }).start(({ finished }) => finished && setMounted(false));
    }
  }, [visible, mounted, progress]);

  if (!mounted) return null;

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_HEIGHT * 0.6, 0] });
  const Body = scrollable ? ScrollView : View;

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      <View ref={rootRef} collapsable={false} style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: progress }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('Close')} />
        </Animated.View>
        <Animated.View
          ref={sheetRef}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              paddingBottom: keyboardHeight > 0 ? theme.space.l : Math.max(insets.bottom, theme.space.l),
              marginBottom: lift,
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.handle} />
          {title ? (
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text accessibilityRole="header" style={styles.title}>
                  {title}
                </Text>
                {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
              </View>
              <Pressable accessibilityRole="button" accessibilityLabel={t('Close')} hitSlop={10} onPress={onClose} style={styles.close}>
                <Text style={styles.closeText}>{t('Close')}</Text>
              </Pressable>
            </View>
          ) : null}
          <Body
            style={scrollable ? styles.scroll : undefined}
            contentContainerStyle={scrollable ? styles.scrollContent : undefined}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </Body>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { backgroundColor: theme.color.scrim },
  sheet: {
    backgroundColor: theme.color.surface,
    borderTopLeftRadius: theme.radius.sheet + 4,
    borderTopRightRadius: theme.radius.sheet + 4,
    paddingHorizontal: theme.size.screenPadding + 4,
    paddingTop: theme.space.m,
    maxHeight: SCREEN_HEIGHT * 0.88,
    ...theme.elevation.sheet,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: theme.color.borderStrong,
    marginBottom: theme.space.l,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: theme.space.m,
    marginBottom: theme.space.l,
  },
  close: { paddingTop: theme.space.s },
  closeText: { ...theme.type.caption, color: theme.color.textSecondary },
  headerText: { flex: 1, paddingTop: theme.space.s },
  title: { ...theme.type.title, color: theme.color.textPrimary },
  subtitle: { ...theme.type.body, color: theme.color.textSecondary, marginTop: theme.space.xs },
  scroll: { flexGrow: 0 },
  scrollContent: { paddingBottom: theme.space.s },
  footer: { paddingTop: theme.space.l, gap: theme.space.s },
});
