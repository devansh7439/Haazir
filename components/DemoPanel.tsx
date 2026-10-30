"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { demoStatus } from "@/lib/demo";
import { LANGUAGE_LABEL, shortName } from "@/lib/ui";

type Status = Awaited<ReturnType<typeof demoStatus>>;

const CHECKLIST = [
  "Bolna concurrency is at least 10 (Settings → Organisation → Account Info). Trial accounts dial 2 at a time, verified numbers only",
  "Outbound calling hours are off on every agent",
  "Webhook URL (with ?token=) is set on the demo agents, all statuses",
  "All phones are off silent and allow unknown callers",
  "Every WhatsApp recipient has messaged our WhatsApp number first",
  "Simulation fallback rehearsed on this machine (Run simulated referral)",
];

function ago(iso: string | null): string {
  if (!iso) return "never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s} s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

export function DemoPanel({ initial }: { initial: Status }) {
  const router = useRouter();
  const [status, setStatus] = useState(initial);
  const [phones, setPhones] = useState(() =>
    Object.fromEntries(initial.facilities.map((f) => [f.facility_id, { phone: f.phone ?? "", whatsapp: f.whatsapp ?? "" }])),
  );
  const [referrerPhone, setReferrerPhone] = useState(initial.referrer_phone ?? "");
  const [familyPhone, setFamilyPhone] = useState(initial.family_phone ?? "");
  const [consented, setConsented] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(url: string, body: unknown, method = "POST") {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data?.error?.message ?? "That didn't work" });
      return res.ok ? data : null;
    } finally {
      setBusy(false);
    }
  }

  async function refresh() {
    const res = await fetch("/api/demo/status", { cache: "no-store" });
    if (res.ok) setStatus(await res.json());
  }

  const c = status.config;
  const configRows: Array<[string, boolean, string]> = [
    ["Bolna API key", c.bolna_api_key, "BOLNA_API_KEY"],
    ["Availability agent", c.availability_agent, "BOLNA_AGENT_ID_AVAILABILITY"],
    ["Hold-confirm agent", c.hold_confirm_agent, "BOLNA_AGENT_ID_HOLD_CONFIRM"],
    ["Release agent", c.release_agent, "BOLNA_AGENT_ID_RELEASE"],
    ["Webhook secret", c.webhook_secret, "BOLNA_WEBHOOK_SECRET"],
    ["Function secret", c.function_secret, "BOLNA_FUNCTION_SECRET"],
    ["Indian caller ID", c.from_number, "BOLNA_FROM_NUMBER"],
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Demo control panel</h1>
      {msg && <p role="status" className={`rounded-lg p-3 font-semibold ${msg.ok ? "bg-green-50 text-green-900" : "bg-red-50 text-red-800"}`}>{msg.text}</p>}

      <section className="card space-y-3 p-4" aria-labelledby="act-h">
        <h2 id="act-h" className="text-lg font-bold">Actions</h2>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy} onClick={async () => {
            const d = await call("/api/demo/run", { simulate: true });
            if (d) router.push(`/referrals/${d.id}`);
          }}>Run simulated referral</button>
          <button className="btn btn-call" disabled={busy || !c.bolna_api_key || !c.availability_agent} onClick={async () => {
            if (!window.confirm("Place real calls to the phones below?")) return;
            const d = await call("/api/demo/run", { simulate: false });
            if (d) router.push(`/referrals/${d.id}`);
          }}>Run live demo referral</button>
          <button className="btn btn-danger" disabled={busy} onClick={async () => {
            if (!window.confirm("Delete all demo referrals and reset call stats? Assigned phone numbers are kept.")) return;
            const d = await call("/api/demo/reset", {});
            if (d) setMsg({ ok: true, text: `Reset done: ${d.deleted_referrals} demo referrals deleted.` });
            await refresh();
          }}>Reset demo</button>
        </div>
        <p className="text-sm text-slate-600">
          The simulated run replays <code>scenarios/demo-krait-bite.json</code> through the same handlers as real calls and is labelled SIMULATED on the board.
          {c.simulation_mode && " SIMULATION_MODE is on: every referral on this deployment is simulated."}
        </p>
      </section>

      <section className="card space-y-3 p-4" aria-labelledby="ph-h">
        <h2 id="ph-h" className="text-lg font-bold">Phones</h2>
        <p className="text-sm text-slate-600">Seeded numbers are placeholders. Put in phones you control (one per hospital role) before any live call.</p>
        <div className="space-y-3">
          {status.facilities.map((f) => (
            <div key={f.facility_id} className="grid items-end gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.3fr)_auto]">
              <div>
                <div className="font-semibold">{f.judge_card ? `Card ${f.judge_card} · ` : ""}{shortName(f.name)}</div>
                <div className="text-sm text-slate-600">{LANGUAGE_LABEL[f.call_language] ?? f.call_language}</div>
              </div>
              <div>
                <label className="label" htmlFor={`p-${f.facility_id}`}>Desk phone</label>
                <input id={`p-${f.facility_id}`} className="input" value={phones[f.facility_id]?.phone ?? ""}
                  onChange={(e) => setPhones((p) => ({ ...p, [f.facility_id]: { ...p[f.facility_id], phone: e.target.value } }))} />
              </div>
              <div>
                <label className="label" htmlFor={`w-${f.facility_id}`}>WhatsApp (optional)</label>
                <input id={`w-${f.facility_id}`} className="input" value={phones[f.facility_id]?.whatsapp ?? ""}
                  onChange={(e) => setPhones((p) => ({ ...p, [f.facility_id]: { ...p[f.facility_id], whatsapp: e.target.value } }))} />
              </div>
              <button className="btn btn-secondary" disabled={busy || !c.bolna_api_key} onClick={async () => {
                const d = await call("/api/demo/test-call", { facility_id: f.facility_id, consented_test: consented });
                if (d) setMsg({ ok: d.dispatched, text: d.dispatched ? `Test call placed to ${shortName(f.name)}.` : "Test call failed: check the alert on the call." });
              }}>Test call</button>
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="doc-phone">Referring doctor&apos;s phone (tap-to-call, confirmation WhatsApp)</label>
              <input id="doc-phone" className="input" value={referrerPhone} onChange={(e) => setReferrerPhone(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="fam-phone">Family phone (WhatsApp in their language)</label>
              <input id="fam-phone" className="input" value={familyPhone} onChange={(e) => setFamilyPhone(e.target.value)} />
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="size-5" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
            Test calls go to a real desk that agreed to test calls (opens with “This is a test call agreed with your hospital.”)
          </label>
          <button className="btn btn-primary" disabled={busy} onClick={async () => {
            const d = await call("/api/demo/assign-numbers", {
              assignments: status.facilities.map((f) => ({ facility_id: f.facility_id, phone: phones[f.facility_id]?.phone || null, whatsapp: phones[f.facility_id]?.whatsapp || null })),
              referrer_phone: referrerPhone || null,
              family_phone: familyPhone || null,
            });
            if (d) {
              setStatus(d);
              setMsg({ ok: true, text: "Numbers saved." });
            }
          }}>Save numbers</button>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="card space-y-2 p-4">
          <h2 className="text-lg font-bold">Can Bolna reach the app?</h2>
          <p>Last webhook: <strong>{ago(status.last_webhook_at)}</strong></p>
          <p>Last function call: <strong>{ago(status.last_function_at)}</strong></p>
          <p className="text-sm text-slate-600">App URL for agents: <code>{c.app_base_url ?? "APP_BASE_URL not set"}</code></p>
          <button className="btn btn-secondary" onClick={refresh}>Refresh</button>
          <ul className="mt-2 space-y-1 text-sm">
            {configRows.map(([label, ok, envName]) => (
              <li key={envName}>{ok ? "✓" : "✖"} {label} <code className="text-xs text-slate-500">{envName}</code></li>
            ))}
            <li>WhatsApp provider: <strong>{c.whatsapp_provider}</strong>{c.whatsapp_provider === "none" && " (messages are simulated and shown on the board)"}</li>
          </ul>
        </div>
        <div className="card p-4">
          <h2 className="text-lg font-bold">Pre-flight checklist</h2>
          <ul className="mt-2 space-y-2">
            {CHECKLIST.map((item) => (
              <li key={item}><label className="flex gap-2"><input type="checkbox" className="mt-1 size-5 shrink-0" /> <span>{item}</span></label></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
