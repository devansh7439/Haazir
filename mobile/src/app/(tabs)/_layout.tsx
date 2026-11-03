import { Tabs } from "expo-router/js-tabs";
import type { ColorValue } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "../../ui/Icon";
import { color } from "../../ui/theme";

/** A tab icon in the colour the tab bar gives it (always a string on iOS, Android and web). */
function TabIcon({ name, tint, size }: { name: IconName; tint: ColorValue; size: number }) {
  return <Icon name={name} size={size} color={typeof tint === "string" ? tint : color.brand} />;
}
const tabIcon = (name: IconName) => {
  const render = ({ color: c, size }: { color: ColorValue; size: number }) => <TabIcon name={name} tint={c} size={size} />;
  return render;
};

/** The four places a doctor goes: start a referral, see their referrals, find a hospital, and their account. */
export default function TabsLayout() {
  const { bottom } = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.brand,
        tabBarInactiveTintColor: color.faint,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", lineHeight: 14 },
        // A fixed height (icon + label need ~64 pt) that still clears the home indicator.
        tabBarStyle: { backgroundColor: color.card, borderTopColor: color.line, height: 66 + bottom, paddingTop: 6, paddingBottom: bottom + 4 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "New referral", tabBarIcon: tabIcon("plus-circle") }} />
      <Tabs.Screen name="referrals" options={{ title: "Referrals", tabBarIcon: tabIcon("list") }} />
      <Tabs.Screen name="hospitals" options={{ title: "Hospitals", tabBarIcon: tabIcon("home") }} />
      <Tabs.Screen name="account" options={{ title: "Account", tabBarIcon: tabIcon("user") }} />
    </Tabs>
  );
}
