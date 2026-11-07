import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { CompositeScreenProps, NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  MainTabs: NavigatorScreenParams<MainTabsParamList>;
  ReferralBoard: { id: string };
  HospitalDetail: { id: string };
  FindBed: undefined;
};

export type MainTabsParamList = { HospitalsTab: undefined; ReferralsTab: undefined; AccountTab: undefined };

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof MainTabsParamList> = CompositeScreenProps<
  BottomTabScreenProps<MainTabsParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

// React Navigation's documented way to type useNavigation() app-wide: augmenting its global
// namespace with an interface that only extends the root param list.
declare global {
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
