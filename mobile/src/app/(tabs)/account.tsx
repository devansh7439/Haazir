import { StyleSheet, Text, View } from "react-native";
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

export default function Account() {
  const { boot, serverUrl, signOut } = useSignedIn();
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
      <Button label="Sign out" variant="danger" icon="log-out" onPress={signOut} testID="sign-out" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  line: { gap: 2 },
  label: { fontSize: font.xs, fontWeight: "700", color: color.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  value: { fontSize: font.md, color: color.text },
});
