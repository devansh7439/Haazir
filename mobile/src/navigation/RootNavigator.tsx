import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { ReferralBoardScreen } from '../features/board';
import { LaunchView, SignInScreen } from '../features/auth';
import { HospitalDetailScreen } from '../features/hospitals';
import { NewReferralScreen } from '../features/referral';
import { PushBridge } from '../lib/push/PushBridge';
import { useSession } from '../lib/session/SessionProvider';
import MainTabs from './MainTabs';
import { navigationState } from './navigationState';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * Shows the sign-in screen until someone is signed in, and the app after. Swapping the screen set (rather than navigating)
 * removes the other side from history entirely, so neither can go back into the other.
 */
export default function RootNavigator() {
  const { state } = useSession();
  // Signing in or out swaps the screen set, so the screens kept from before no longer exist.
  useEffect(() => navigationState.clear(), [state.status]);
  if (state.status !== 'signedIn' && state.status !== 'signedOut') return <LaunchView />;
  if (state.status === 'signedOut') return <SignInScreen />;
  return (
    <>
      {Platform.OS !== 'web' ? <PushBridge /> : null}
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="MainTabs" component={MainTabs} />
        <Stack.Screen name="ReferralBoard" component={ReferralBoardScreen} />
        <Stack.Screen name="HospitalDetail" component={HospitalDetailScreen} />
        <Stack.Screen name="FindBed" component={NewReferralScreen} />
      </Stack.Navigator>
    </>
  );
}
