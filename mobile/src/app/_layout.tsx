import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SessionProvider, useSession } from "../session/SessionProvider";
import { Button } from "../ui/Button";
import { color, font, space } from "../ui/theme";

/** Shows the sign-in screen until someone is signed in, and the app after. Sessions come back from secure storage. */
function Gate() {
  const { state, retry, signOut } = useSession();
  if (state.status === "loading") {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={color.brand} />
      </View>
    );
  }
  if (state.status === "unreachable") {
    return (
      <View style={styles.center}>
        <Text style={styles.heading}>Can't reach Haazir</Text>
        <Text style={styles.body}>{state.message}</Text>
        <Button label="Try again" variant="primary" onPress={retry} />
        <Button label="Use another server" variant="ghost" onPress={signOut} />
      </View>
    );
  }
  const signedIn = state.status === "signedIn";
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="referral/[id]"
          options={{ headerShown: true, title: "Referral", headerBackTitle: "Back", headerTintColor: color.text, headerStyle: { backgroundColor: color.card } }}
        />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <Gate />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, backgroundColor: color.bg, alignItems: "center", justifyContent: "center", padding: space.xl, gap: space.md },
  heading: { fontSize: font.xl, fontWeight: "700", color: color.text },
  body: { fontSize: font.md, color: color.muted, textAlign: "center" },
});
