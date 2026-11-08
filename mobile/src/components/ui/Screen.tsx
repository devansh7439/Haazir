import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { type ComponentRef, type ReactNode, useContext, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  type StyleProp,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import theme from '../../theme';

const KEYBOARD_GAP = 24;

export type ScreenProps = {
  children: ReactNode;
  header?: ReactNode;
  /** Pinned under the page, above the keyboard: the page's main button. */
  footer?: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: (() => void) | undefined;
  background?: string;
  contentStyle?: StyleProp<ViewStyle>;
  /** The page is a tab: the floating bar sits over its bottom edge, so the content leaves room for it. */
  inTabs?: boolean;
  testID?: string;
};

/** A page: an optional header, content that scrolls clear of the keyboard, and an optional footer button. */
export default function Screen({
  children,
  header,
  footer,
  scroll = true,
  refreshing = false,
  onRefresh,
  background = theme.color.background,
  contentStyle,
  inTabs = false,
  testID,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  // In a tab the bar floats over the page, so the content ends above it; the bar reports its height (strip included).
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const bottomPad = inTabs
    ? tabBarHeight + theme.space.l
    : footer
      ? theme.space.xl
      : Math.max(insets.bottom, theme.space.l) + theme.space.l;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const offset = useRef(0);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // A field under the keyboard scrolls into view when it takes focus.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (event) => {
      setKeyboardHeight(event.endCoordinates.height);
      const input = TextInput.State.currentlyFocusedInput();
      const view = scrollRef.current;
      if (!input || !view) return;
      requestAnimationFrame(() => {
        input.measureInWindow((_x, y, _width, height) => {
          const keyboardTop = Dimensions.get('window').height - event.endCoordinates.height;
          const overlap = y + height + KEYBOARD_GAP - keyboardTop;
          if (overlap > 0) view.scrollTo({ y: offset.current + overlap, animated: true });
        });
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: background }]}
      testID={testID}
    >
      {header}
      {scroll ? (
        <ScrollView
          ref={scrollRef}
          onScroll={(e) => {
            offset.current = e.nativeEvent.contentOffset.y;
          }}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[{ paddingBottom: bottomPad + keyboardHeight }, styles.grow]}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[theme.color.primary]}
                progressBackgroundColor={theme.color.surface}
              />
            ) : undefined
          }
        >
          <View style={[styles.content, header ? styles.belowHeader : null, contentStyle]}>{children}</View>
        </ScrollView>
      ) : (
        <View style={[styles.root, styles.content, header ? styles.belowHeader : null, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View
          style={[styles.footer, { paddingBottom: Math.max(insets.bottom, theme.space.l) + theme.space.xs }]}
        >
          {footer}
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  grow: { flexGrow: 1 },
  content: { paddingHorizontal: theme.size.screenPadding, gap: theme.space.l },
  belowHeader: { paddingTop: theme.space.l },
  footer: {
    paddingHorizontal: theme.size.screenPadding,
    paddingTop: theme.space.m,
    gap: theme.space.s,
    backgroundColor: theme.color.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.color.border,
  },
});
