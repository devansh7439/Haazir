"use client";

import { CheckCircle2, Circle, Database, Loader2, Phone, PlayCircle, Radio, RotateCcw, Webhook, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { demoStatus } from "@/lib/demo";
import { LANGUAGE_LABEL, shortName } from "@/lib/ui";
import { PageHeader, cx } from "./ui";

type Status = Awaited<ReturnType<typeof demoStatus>>;

const CHECKLIST = [
  "Bolna concurrency is at least 10 (trial accounts dial 2 at a time, verified numbers only)",
  "Outbound calling hours are off on every agent",
  "Webhook URL with ?token= is set on the demo agents, all statuses",
  "All phones are off silent and allow unknown callers",
  "Every WhatsApp recipient has messaged our WhatsApp number first",
  "Simulation fallback rehearsed on this machine",
];

function ago(iso: string | null): string {
  if (!iso) return "Never";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });
}

function Panel({ title, description, children, action }: { title: string; description?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-zinc-500">{description}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
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
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function call(key: string, url: string, body: unknown) {
    setBusy(key);
    setMsg(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) setMsg({ ok: false, text: data?.error?.message ?? "That didn't work" });
      return res.ok ? data : null;
    } finally {
      setBusy(null);
    }
  }

  async function refresh() {
    const res = await fetch("/api/demo/status", { cache: "no-store" });
    if (res.ok) setStatus(await res.json());
  }

  const c = status.config;
  const liveReady = c.bolna_api_key && c.availability_agent;
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
    <div>
      <PageHeader
        title="Demo console"
        description="Assign phones, rehearse each desk, and run the krait-bite story live or as a labelled simulation."
        actions={
          <>
            <button className="btn btn-danger" disabled={!!busy} onClick={async () => {
              if (!window.confirm("Delete all demo referrals and reset call stats? Assigned phone numbers are kept.")) return;
              const d = await call("reset", "/api/demo/reset", {});
              if (d) setMsg({ ok: true, text: `Reset done. ${d.deleted_referrals} demo referrals deleted.` });
              await refresh();
            }}>
              {busy === "reset" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <RotateCcw aria-hidden className="size-4" />} Reset demo
            </button>
            <button className="btn btn-secondary" disabled={!!busy} title="Fictional portal readings that contradict two desks, to show the mismatch flags" onClick={async () => {
              const d = await call("portal", "/api/demo/portal-sample", {});
              if (d) setMsg({ ok: true, text: `Loaded ${d.inserted} sample portal readings. Run a referral to see the flags.` });
            }}>
              {busy === "portal" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Database aria-hidden className="size-4" />} Sample portal data
            </button>
            <button className="btn btn-secondary" disabled={!!busy} onClick={async () => {
              const d = await call("sim", "/api/demo/run", { simulate: true });
              if (d) router.push(`/referrals/${d.id}`);
            }}>
              {busy === "sim" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <PlayCircle aria-hidden className="size-4" />} Run simulation
            </button>
            <button className="btn btn-primary" disabled={!!busy || !liveReady} title={liveReady ? undefined : "Configure Bolna first"} onClick={async () => {
              if (!window.confirm("Place real calls to the phones below?")) return;
              const d = await call("live", "/api/demo/run", { simulate: false });
              if (d) router.push(`/referrals/${d.id}`);
            }}>
              {busy === "live" ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Radio aria-hidden className="size-4" />} Run live demo
            </button>
          </>
        }
      />
      {msg && (
        <p role="status" className={cx("mb-5 rounded-xl px-4 py-3 text-sm font-medium ring-1 ring-inset", msg.ok ? "bg-emerald-50 text-emerald-800 ring-emerald-200" : "bg-rose-50 text-rose-700 ring-rose-200")}>
          {msg.text}
        </p>
      )}

      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Panel
          title="Phones"
          description="Seeded numbers are placeholders. Use phones you control, one per hospital role, before any live call."
          action={
            <button className="btn btn-primary" disabled={!!busy} onClick={async () => {
              const d = await call("save", "/api/demo/assign-numbers", {
                assignments: status.facilities.map((f) => ({ facility_id: f.facility_id, phone: phones[f.facility_id]?.phone || null, whatsapp: phones[f.facility_id]?.whatsapp || null })),
                referrer_phone: referrerPhone || null,
                family_phone: familyPhone || null,
              });
              if (d) {
                setStatus(d);
                setMsg({ ok: true, text: "Numbers saved." });
              }
            }}>Save numbers</button>
          }
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-zinc-500">
                  <th className="px-5 py-2.5 font-medium">Role</th>
                  <th className="px-3 py-2.5 font-medium">Desk phone</th>
                  <th className="px-3 py-2.5 font-medium">WhatsApp</th>
                  <th className="px-5 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {status.facilities.map((f) => (
                  <tr key={f.facility_id}>
                    <td className="px-5 py-2.5">
                      <div className="flex items-center gap-3">
                        <span className={cx("grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold", f.judge_card ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-400")}>
                          {f.judge_card ?? "–"}
                        </span>
                        <div>
                          <div className="font-medium text-zinc-900">{shortName(f.name)}</div>
                          <div className="text-xs text-zinc-500">{LANGUAGE_LABEL[f.call_language] ?? f.call_language}{f.judge_card ? ` · judge card ${f.judge_card}` : " · not in the demo story"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <input aria-label={`${shortName(f.name)} desk phone`} className="input kbd-num" value={phones[f.facility_id]?.phone ?? ""}
                        onChange={(e) => setPhones((p) => ({ ...p, [f.facility_id]: { ...p[f.facility_id], phone: e.target.value } }))} />
                    </td>
                    <td className="px-3 py-2.5">
                      <input aria-label={`${shortName(f.name)} WhatsApp`} className="input kbd-num" placeholder="Optional" value={phones[f.facility_id]?.whatsapp ?? ""}
                        onChange={(e) => setPhones((p) => ({ ...p, [f.facility_id]: { ...p[f.facility_id], whatsapp: e.target.value } }))} />
                    </td>
                    <td className="px-5 py-2.5 text-right">
                      <button className="btn btn-ghost" disabled={!!busy || !c.bolna_api_key} onClick={async () => {
                        const d = await call(`t-${f.facility_id}`, "/api/demo/test-call", { facility_id: f.facility_id, consented_test: consented });
                        if (d) setMsg({ ok: d.dispatched, text: d.dispatched ? `Test call placed to ${shortName(f.name)}.` : "Test call failed. Check the alert on the call." });
                      }}>
                        {busy === `t-${f.facility_id}` ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <Phone aria-hidden className="size-4" />} Test call
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-4 border-t border-line px-5 py-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="doc-phone">Referring doctor&apos;s phone</label>
              <input id="doc-phone" className="input kbd-num" value={referrerPhone} onChange={(e) => setReferrerPhone(e.target.value)} />
              <p className="mt-1 text-xs text-zinc-500">Receives the confirmation on WhatsApp.</p>
            </div>
            <div>
              <label className="label" htmlFor="fam-phone">Family phone</label>
              <input id="fam-phone" className="input kbd-num" placeholder="Optional" value={familyPhone} onChange={(e) => setFamilyPhone(e.target.value)} />
              <p className="mt-1 text-xs text-zinc-500">Gets directions on WhatsApp in their language.</p>
            </div>
            <label className="flex items-start gap-2.5 text-sm text-zinc-700 sm:col-span-2">
              <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={consented} onChange={(e) => setConsented(e.target.checked)} />
              <span>Test calls go to a real desk that agreed to test calls. The call opens with “This is a test call agreed with your hospital.”</span>
            </label>
          </div>
        </Panel>

        <div className="space-y-6">
          <Panel title="Connection" description="Can Bolna reach this app?" action={<button className="btn btn-ghost min-h-8 px-2 text-xs" onClick={refresh}>Refresh</button>}>
            <div className="grid grid-cols-2 divide-x divide-line border-b border-line">
              <div className="px-5 py-3">
                <div className="eyebrow flex items-center gap-1"><Webhook aria-hidden className="size-3.5" />Last webhook</div>
                <div className="mt-1 text-sm font-semibold">{ago(status.last_webhook_at)}</div>
              </div>
              <div className="px-5 py-3">
                <div className="eyebrow">Last function call</div>
                <div className="mt-1 text-sm font-semibold">{ago(status.last_function_at)}</div>
              </div>
            </div>
            <ul className="divide-y divide-line">
              {configRows.map(([label, ok, envName]) => (
                <li key={envName} className="flex items-center gap-2.5 px-5 py-2.5 text-sm">
                  {ok ? <CheckCircle2 aria-label="set" className="size-4 text-emerald-600" /> : <XCircle aria-label="missing" className="size-4 text-zinc-300" />}
                  <span className="flex-1 text-zinc-800">{label}</span>
                  <code className="text-[11px] text-zinc-400">{envName}</code>
                </li>
              ))}
              <li className="flex items-center gap-2.5 px-5 py-2.5 text-sm">
                <CheckCircle2 aria-hidden className="size-4 text-emerald-600" />
                <span className="flex-1 text-zinc-800">WhatsApp provider</span>
                <span className="tag">{c.whatsapp_provider}</span>
              </li>
            </ul>
            <p className="border-t border-line px-5 py-3 text-xs text-zinc-500">
              Agent webhook: <code className="break-all">{c.app_base_url ? `${c.app_base_url}/api/bolna/webhook?token=…` : "set APP_BASE_URL"}</code>
            </p>
          </Panel>

          <Panel title="Pre-flight checklist" description={`${checked.size} of ${CHECKLIST.length} done`}>
            <ul className="divide-y divide-line">
              {CHECKLIST.map((item, i) => {
                const on = checked.has(i);
                return (
                  <li key={item}>
                    <button
                      type="button"
                      aria-pressed={on}
                      className="flex w-full items-start gap-3 px-5 py-3 text-left text-sm hover:bg-zinc-50"
                      onClick={() => setChecked((s) => { const n = new Set(s); if (on) n.delete(i); else n.add(i); return n; })}
                    >
                      {on ? <CheckCircle2 aria-hidden className="mt-px size-4 shrink-0 text-brand-600" /> : <Circle aria-hidden className="mt-px size-4 shrink-0 text-zinc-300" />}
                      <span className={cx(on ? "text-zinc-400 line-through" : "text-zinc-800")}>{item}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  );
}
