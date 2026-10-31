import { Loader2, Phone } from "lucide-react";
import { useState } from "react";
import { LANGUAGE_LABEL, shortName } from "@/lib/ui/display";
import { cx } from "../ui";
import { Panel } from "./Panel";
import type { DemoStatus, Notice, PhoneEntry } from "./types";
import type { useDemoCall } from "./useDemoCall";

type Props = {
  status: DemoStatus;
  onStatus: (status: DemoStatus) => void;
  onNotice: (notice: Notice) => void;
  busy: string | null;
  call: ReturnType<typeof useDemoCall>["call"];
};

export function PhonesPanel({ status, onStatus, onNotice, busy, call }: Props) {
  const [phones, setPhones] = useState<Record<string, PhoneEntry>>(() =>
    Object.fromEntries(status.facilities.map((f) => [f.facility_id, { phone: f.phone ?? "", whatsapp: f.whatsapp ?? "" }])),
  );
  const [referrerPhone, setReferrerPhone] = useState(status.referrer_phone ?? "");
  const [familyPhone, setFamilyPhone] = useState(status.family_phone ?? "");
  const [consented, setConsented] = useState(false);
  const setEntry = (id: string, patch: Partial<PhoneEntry>) => setPhones((p) => ({ ...p, [id]: { ...p[id], ...patch } }));

  async function saveNumbers() {
    const d = await call("save", "/api/demo/assign-numbers", {
      assignments: status.facilities.map((f) => ({ facility_id: f.facility_id, phone: phones[f.facility_id]?.phone || null, whatsapp: phones[f.facility_id]?.whatsapp || null })),
      referrer_phone: referrerPhone || null,
      family_phone: familyPhone || null,
    });
    if (d) {
      onStatus(d);
      onNotice({ ok: true, text: "Numbers saved." });
    }
  }

  async function testCall(facilityId: string, name: string) {
    const d = await call(`t-${facilityId}`, "/api/demo/test-call", { facility_id: facilityId, consented_test: consented });
    if (d) onNotice({ ok: d.dispatched, text: d.dispatched ? `Test call placed to ${shortName(name)}.` : "Test call failed. Check the alert on the call." });
  }

  return (
    <Panel
      title="Phones"
      description="Seeded numbers are placeholders. Use phones you control, one per hospital role, before any live call."
      action={<button className="btn btn-primary" disabled={!!busy} onClick={saveNumbers}>Save numbers</button>}
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
                    onChange={(e) => setEntry(f.facility_id, { phone: e.target.value })} />
                </td>
                <td className="px-3 py-2.5">
                  <input aria-label={`${shortName(f.name)} WhatsApp`} className="input kbd-num" placeholder="Optional" value={phones[f.facility_id]?.whatsapp ?? ""}
                    onChange={(e) => setEntry(f.facility_id, { whatsapp: e.target.value })} />
                </td>
                <td className="px-5 py-2.5 text-right">
                  <button className="btn btn-ghost" disabled={!!busy || !status.config.bolna_api_key} onClick={() => testCall(f.facility_id, f.name)}>
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
  );
}
