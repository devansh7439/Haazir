import { StyleSheet, Text, View } from "react-native";
import { registerPush, usePushStatus, type PushStatus } from "../../push/push";
import { useSignedIn } from "../../session/SessionProvider";
import { Button } from "../../ui/Button";
import { Callout } from "../../ui/Callout";
import { Card } from "../../ui/Card";
import { Screen } from "../../ui/Screen";
import { color, font } from "../../ui/theme";

const Line = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.line}>
    <Text style={styles.label}>{label}</Text>
    <Text style={styles.value} selectable>{value}</Text>
  </View>
);

const PUSH_TEXT: Record<PushStatus, { kind: "info" | "ok" | "warn"; title: string; body: string }> = {
  unknown: { kind: "info", title: "Notifications", body: "Checking…" },
  on: { kind: "ok", title: "Notifications are on", body: "You will hear about a first yes, a desk asking for you, and a held bed, even when the app is closed." },
  denied: { kind: "warn", title: "Notifications are off", body: "Allow notifications for Haazir in your phone settings, then tap Turn on." },
  unsupported: { kind: "info", title: "Notifications need a phone", body: "They work in a development or release build on a real phone, not in the browser or a simulator." },
  needs_project: { kind: "warn", title: "Notifications need setup", body: "This build has no EAS project id. Run eas init in the mobile folder, then build again." },
  error: { kind: "warn", title: "Notifications could not be set up", body: "Check the connection and tap Turn on to try again." },
};

export default function Account() {
  const { boot, serverUrl, signOut } = useSignedIn();
  const push = usePushStatus();
  const p = PUSH_TEXT[push];
  return (
    <Screen title="Account" testID="account">
      <Card style={{ gap: 12 }}>
        <Line label="Name" value={boot.user.name ?? "Shared passcode"} />
        {boot.user.email ? <Line label="Email" value={boot.user.email} /> : null}
        <Line label="Role" value={boot.user.role === "admin" ? "Admin" : "Doctor"} />
        <Line label="Refers as" value={boot.referrer ? `${boot.referrer.name}${boot.referrer.facility ? ` · ${boot.referrer.facility}` : ""}` : "No referring doctor set up"} />
        <Line label="Server" value={serverUrl} />
      </Card>
      {boot.bolna_ready ? (
        <Callout kind="ok" title="Calls are on">Find a bed places real calls to hospital desks.</Callout>
      ) : (
        <Callout kind="warn" title="Calls are off">The server has no Bolna setup yet, so Find a bed can't phone hospitals.</Callout>
      )}
      <Callout kind={p.kind} title={p.title}>{p.body}</Callout>
      {push === "denied" || push === "error" ? <Button label="Turn on notifications" icon="bell" onPress={registerPush} /> : null}
      <Button label="Sign out" variant="danger" icon="log-out" onPress={signOut} testID="sign-out" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { gap: 2 },
  label: { fontSize: font.xs, fontWeight: "700", color: color.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: font.md, color: color.text },
});
