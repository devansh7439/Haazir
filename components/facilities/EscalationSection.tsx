"use client";

import { Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { EscalationContact } from "@/lib/modules/escalation/escalation.type";
import { Callout } from "../board/Callout";
import { send } from "./api";

/** Admin: who the doctor can call beyond 108 and 112 when no hospital accepted. Shown on the board only then. */
export function EscalationSection({ initial }: { initial: EscalationContact[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ label: "", phone: "" });
  const [error, setError] = useState<string | null>(null);

  async function act(method: string, url: string, body: unknown) {
    setError(await send(method, url, body));
    router.refresh();
  }

  return (
    <section className="card mt-8 p-5" aria-labelledby="esc-h">
      <h2 id="esc-h" className="text-sm font-semibold">Escalation numbers</h2>
      <p className="mb-3 mt-1 text-xs text-zinc-500">
        Beyond 108 and 112: your district referral officer, the state&apos;s designated referral hospital, a control room. Doctors see these, with a call button,
        when no hospital accepted. Nothing is listed until you add it, because these numbers differ by district.
      </p>
      {error && <Callout tone="red" icon={TriangleAlert} title={error} />}
      {initial.length > 0 && (
        <ul className="mb-3 divide-y divide-line rounded-xl border border-line">
          {initial.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-3 text-sm">
              <span className="font-medium text-zinc-900">{c.label}</span>
              <span className="kbd-num text-zinc-600">{c.phone_e164}</span>
              <button className="btn btn-ghost ml-auto min-h-8 px-2 text-xs" aria-label={`Remove ${c.label}`} onClick={() => act("DELETE", `/api/escalation-contacts/${c.id}`, undefined)}>
                <Trash2 aria-hidden className="size-4" /> Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await send("POST", "/api/escalation-contacts", { label: form.label, phone: form.phone, sort_order: initial.length + 1 });
          setError(err);
          if (!err) setForm({ label: "", phone: "" });
          router.refresh();
        }}
      >
        <div><label className="label" htmlFor="esc-label">Name</label><input id="esc-label" className="input" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="District referral officer" /></div>
        <div><label className="label" htmlFor="esc-phone">Phone</label><input id="esc-phone" className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+91…" /></div>
        <button className="btn btn-secondary col-span-2" type="submit" disabled={form.label.trim().length < 2 || !form.phone}>Add number</button>
      </form>
    </section>
  );
}
