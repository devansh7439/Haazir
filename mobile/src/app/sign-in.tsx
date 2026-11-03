import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSession } from "../session/SessionProvider";
import { Button } from "../ui/Button";
import { Callout } from "../ui/Callout";
import { Field } from "../ui/Field";
import { Icon } from "../ui/Icon";
import { Screen } from "../ui/Screen";
import { color, font, radius, space } from "../ui/theme";

/** Sign in: the server address first (it changes with every tunnel), then the passcode or the email and password. */
export default function SignIn() {
  const { state, authMode, signIn } = useSession();
  const saved = state.status === "signedOut" ? state.serverUrl : "";
  const [server, setServer] = useState(saved);
  const [mode, setMode] = useState<"passcode" | "users" | null>(null);
  const [passcode, setPasscode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setServer((s) => s || saved), [saved]);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await work();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };
  const connect = () => run(async () => setMode(await authMode(server)));
  const submit = () => run(() => signIn(server, mode === "passcode" ? { passcode } : { email, password }));
  const ready = mode === "passcode" ? passcode.trim().length > 0 : email.trim().length > 0 && password.length > 0;

  return (
    <Screen testID="sign-in">
      <View style={styles.brand}>
        <View style={styles.logo}>
          <Icon name="activity" size={22} color={color.onBrand} />
        </View>
        <Text style={styles.name}>Haazir</Text>
      </View>
      <Text style={styles.lead}>Find a hospital bed for an emergency referral. Haazir phones every capable hospital at once.</Text>
      <Field
        label="Server"
        value={server}
        onChangeText={(t) => {
          setServer(t);
          setMode(null);
        }}
        placeholder="your-tunnel.ngrok.app"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        hint="The address of your Haazir server."
        testID="server"
      />
      {mode === "passcode" && (
        <Field label="Passcode" value={passcode} onChangeText={setPasscode} secureTextEntry autoCapitalize="none" testID="passcode" onSubmitEditing={submit} />
      )}
      {mode === "users" && (
        <>
          <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" testID="email" />
          <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" testID="password" onSubmitEditing={submit} />
        </>
      )}
      {error ? <Callout kind="error">{error}</Callout> : null}
      {mode === null ? (
        <Button label="Continue" variant="primary" loading={busy} disabled={!server.trim()} onPress={connect} testID="continue" />
      ) : (
        <Button label="Sign in" variant="primary" loading={busy} disabled={!ready} onPress={submit} testID="sign-in-submit" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  brand: { flexDirection: "row", alignItems: "center", gap: space.md, marginTop: space.xl },
  logo: { width: 40, height: 40, borderRadius: radius.md, backgroundColor: color.brand, alignItems: "center", justifyContent: "center" },
  name: { fontSize: 28, fontWeight: "800", color: color.text, letterSpacing: -0.5 },
  lead: { fontSize: font.md, color: color.muted, lineHeight: 22 },
});
