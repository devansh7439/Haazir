import { BottomTabBarHeightCallbackContext, createBottomTabNavigator, type BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { CommonActions } from '@react-navigation/native';
import { useContext } from 'react';
import { View } from 'react-native';
import TabBar, { type TabDef } from '../components/ui/TabBar';
import useReducedMotion from '../components/ui/useReducedMotion';
import { AccountScreen } from '../features/account';
import { HospitalsScreen } from '../features/hospitals';
import { ReferralsScreen } from '../features/referrals';
import LiveReferralBar from '../features/referrals/components/LiveReferralBar';
import { useInProgress } from '../features/referrals/useInProgress';
import { phrase } from '../lib/i18n';
import { tabSlide } from './tabTransition';
import type { MainTabsParamList } from './types';

const Tab = createBottomTabNavigator<MainTabsParamList>();

/** The three places a doctor goes: the hospital directory (home, where "Find a bed" starts), their referrals, and their account. */
const TABS: readonly TabDef<keyof MainTabsParamList>[] = [
  { key: 'HospitalsTab', label: phrase('Home'), icon: 'hospital' },
  { key: 'ReferralsTab', label: phrase('Referrals'), icon: 'list' },
  { key: 'AccountTab', label: phrase('Account'), icon: 'user' },
];

// Mirrors React Navigation's default BottomTabBar: emitting tabPress keeps native-stack's pop-to-top on re-tap, and
// reporting the height keeps useBottomTabBarHeight accurate.
function RoutedTabBar({ state, navigation }: BottomTabBarProps) {
  const onHeightChange = useContext(BottomTabBarHeightCallbackContext);
  const focused = state.routes[state.index];
  const live = useInProgress();

  const onTabPress = (key: keyof MainTabsParamList) => {
    const route = state.routes.find((r) => r.name === key);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (route.key !== focused?.key && !event.defaultPrevented) {
      navigation.dispatch({ ...CommonActions.navigate(route.name, route.params), target: state.key });
    }
  };

  return (
    <View pointerEvents="box-none" onLayout={(e) => onHeightChange?.(e.nativeEvent.layout.height)}>
      {live ? <LiveReferralBar referral={live} onOpen={() => navigation.getParent()?.navigate('ReferralBoard', { id: live.id })} /> : null}
      <TabBar
        tabs={TABS}
        activeKey={(focused?.name ?? 'HospitalsTab') as keyof MainTabsParamList}
        onTabPress={onTabPress}
        badges={{ ReferralsTab: !!live }}
      />
    </View>
  );
}

/** The three tabs, with a strip for the referral in progress above the bar. */
export default function MainTabs() {
  // Until the setting is known, and when Reduce Motion is on, tabs switch at once instead of sliding.
  const animate = useReducedMotion() === false;

  return (
    <Tab.Navigator tabBar={(props) => <RoutedTabBar {...props} />} screenOptions={{ headerShown: false, ...(animate ? tabSlide : {}) }}>
      <Tab.Screen name="HospitalsTab" component={HospitalsScreen} />
      <Tab.Screen name="ReferralsTab" component={ReferralsScreen} />
      <Tab.Screen name="AccountTab" component={AccountScreen} />
    </Tab.Navigator>
  );
}
