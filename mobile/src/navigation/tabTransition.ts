import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { Dimensions } from 'react-native';
import theme from '../theme';

/**
 * Tabs slide: a page enters from the side of the tab that was tapped while the one it replaces leaves the other way,
 * one screen width in all, so a tab further along is a longer swipe to the same place. Each page is drawn opaque and
 * the pages sit side by side, so nothing of the outgoing page (its list dividers, its sheet's rounded top) is ever
 * drawn over the incoming one, as a crossfade let it be.
 */
const forSlide: NonNullable<BottomTabNavigationOptions['sceneStyleInterpolator']> = ({ current }) => {
  const width = Dimensions.get('window').width;
  return {
    sceneStyle: { transform: [{ translateX: current.progress.interpolate({ inputRange: [-1, 0, 1], outputRange: [-width, 0, width] }) }] },
  };
};

/** How tabs change: the new page slides in from the side of the tab that was tapped. */
export const tabSlide: BottomTabNavigationOptions = {
  sceneStyleInterpolator: forSlide,
  transitionSpec: { animation: 'timing', config: { duration: theme.motion.tabSwitch, easing: theme.easing.slide } },
};
