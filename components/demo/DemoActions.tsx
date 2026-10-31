import { Database, Loader2, PlayCircle, Radio, RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "../ConfirmDialog";
import type { Notice } from "./types";
import type { useDemoCall } from "./useDemoCall";

type Props = {
  busy: string | null;
  liveReady: boolean;
  call: ReturnType<typeof useDemoCall>["call"];
  onNotice: (notice: Notice) => void;
  onReset: () => Promise<void>;
};

function Icon({ busy, id, icon: Glyph }: { busy: string | null; id: string; icon: typeof Radio }) {
  return busy === id ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Glyph aria-hidden className="size-4" />;
}

export function DemoActions({ busy, liveReady, call, onNotice, onReset }: Props) {
  const router = useRouter();
  const [asking, setAsking] = useState<"reset" | "live" | null>(null);

  async function reset() {
    const d = await call("reset", "/api/demo/reset", {});
    if (d) onNotice({ ok: true, text: `Reset done. ${d.deleted_referrals} demo referrals deleted.` });
    await onReset();
  }

  async function samplePortal() {
    const d = await call("portal", "/api/demo/portal-sample", {});
    if (d) onNotice({ ok: true, text: `Loaded ${d.inserted} sample portal readings. Run a referral to see the flags.` });
  }

  async function run(key: "sim" | "live", simulate: boolean) {
    const d = await call(key, "/api/demo/run", { simulate });
    if (d) router.push(`/referrals/${d.id}`);
  }

  return (
    <>
      <button className="btn btn-danger" disabled={!!busy} onClick={() => setAsking("reset")}><Icon busy={busy} id="reset" icon={RotateCcw} /> Reset demo</button>
      <button className="btn btn-secondary" disabled={!!busy} title="Fictional portal readings that contradict two desks, to show the mismatch flags" onClick={samplePortal}>
        <Icon busy={busy} id="portal" icon={Database} /> Sample portal data
      </button>
      <button className="btn btn-secondary" disabled={!!busy} onClick={() => run("sim", true)}><Icon busy={busy} id="sim" icon={PlayCircle} /> Run simulation</button>
      <button className="btn btn-primary" disabled={!!busy || !liveReady} title={liveReady ? undefined : "Configure Bolna first"} onClick={() => setAsking("live")}>
        <Icon busy={busy} id="live" icon={Radio} /> Run live demo
      </button>
      {asking === "reset" && (
        <ConfirmDialog
          title="Reset the demo?"
          description="Deletes all demo referrals and resets call stats. Assigned phone numbers are kept."
          confirmLabel="Reset demo"
          danger
          onConfirm={reset}
          onClose={() => setAsking(null)}
        />
      )}
      {asking === "live" && (
        <ConfirmDialog
          title="Place real calls?"
          description="Every phone listed under Phones will ring for real."
          confirmLabel="Run live demo"
          onConfirm={() => run("live", false)}
          onClose={() => setAsking(null)}
        />
      )}
    </>
  );
}
