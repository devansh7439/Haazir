import { ShieldCheck } from "lucide-react";
import { useState } from "react";
import type { Contact } from "@/lib/core/types";
import { cx } from "../ui";
import { send } from "./api";

const ROLES = ["casualty_desk", "referral_desk", "nursing_station", "duty_manager", "reception", "other"];

export function ContactsSection({ facilityId, contacts, onError, onSaved }: { facilityId: string; contacts: Contact[]; onError: (message: string | null) => void; onSaved: () => Promise<void> }) {
  const [newContact, setNewContact] = useState({ role: "casualty_desk", phone: "", priority: 1, is_ivr: false });

  async function contactAction(c: Contact, patch: Record<string, unknown>) {
    onError(await send("PATCH", `/api/contacts/${c.id}`, patch));
    await onSaved();
  }

  return (
    <section>
      <h3 className="mb-1 text-sm font-semibold">Phone numbers</h3>
      <p className="mb-3 text-xs text-zinc-500">Tried in priority order. Phone-menu (IVR) lines go last, because the agent can&apos;t press keys.</p>
      <ul className="divide-y divide-line rounded-xl border border-line">
        {contacts.map((c) => (
          <li key={c.id} className={cx("px-4 py-3", !c.active && "opacity-55")}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="kbd-num font-medium text-zinc-900">{c.phone_e164}</span>
              <span className="capitalize text-zinc-600">{c.role.replace(/_/g, " ")}</span>
              <span className="tag">P{c.priority}</span>
              {c.is_ivr && <span className="tag bg-amber-50 text-amber-800">IVR</span>}
              {c.verified_at && <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><ShieldCheck aria-hidden className="size-3.5" />verified</span>}
              <span className="ml-auto text-xs text-zinc-500">answered {c.calls_answered}/{c.calls_made}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              <button className="btn btn-ghost min-h-8 px-2 text-xs" onClick={() => contactAction(c, { active: !c.active })}>{c.active ? "Deactivate" : "Activate"}</button>
              <button className="btn btn-ghost min-h-8 px-2 text-xs" onClick={() => contactAction(c, { is_ivr: !c.is_ivr })}>{c.is_ivr ? "Not a phone menu" : "Mark as phone menu"}</button>
              {!c.verified_at && <button className="btn btn-ghost min-h-8 px-2 text-xs" onClick={() => contactAction(c, { verified: true })}>Mark verified</button>}
            </div>
          </li>
        ))}
      </ul>
      <form
        className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-zinc-50 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const err = await send("POST", `/api/facilities/${facilityId}/contacts`, newContact);
          onError(err);
          if (!err) setNewContact({ ...newContact, phone: "" });
          await onSaved();
        }}
      >
        <div><label className="label" htmlFor="nc-phone">Phone</label><input id="nc-phone" className="input" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} placeholder="+91…" /></div>
        <div>
          <label className="label" htmlFor="nc-role">Role</label>
          <select id="nc-role" className="input" value={newContact.role} onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}>
            {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div><label className="label" htmlFor="nc-pri">Priority</label><input id="nc-pri" className="input" inputMode="numeric" value={newContact.priority} onChange={(e) => setNewContact({ ...newContact, priority: Number(e.target.value.replace(/\D/g, "")) || 1 })} /></div>
        <label className="flex items-end gap-2 pb-2.5 text-sm text-zinc-700"><input type="checkbox" className="size-4 accent-brand-600" checked={newContact.is_ivr} onChange={(e) => setNewContact({ ...newContact, is_ivr: e.target.checked })} /> Phone menu (IVR)</label>
        <button className="btn btn-secondary col-span-2" type="submit" disabled={!newContact.phone}>Add number</button>
      </form>
    </section>
  );
}
