"use client";

import { useState } from "react";
import type { FacilityListItem } from "@/lib/directory";
import type { Capability, Contact } from "@/lib/types";
import { LANGUAGE_LABEL, clock, shortName } from "@/lib/ui";

const ROLES = ["casualty_desk", "referral_desk", "nursing_station", "duty_manager", "reception", "other"];

async function send(method: string, url: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data?.error?.message ?? "Save failed";
}

function pct(n: number, d: number) {
  return d === 0 ? "—" : `${Math.round((100 * n) / d)}% (${n}/${d})`;
}

export function FacilitiesAdmin({ initial, capabilities }: { initial: FacilityListItem[]; capabilities: Capability[] }) {
  const [rows, setRows] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const capLabel = new Map(capabilities.map((c) => [c.code, c.label]));
  const reload = async () => {
    const res = await fetch("/api/facilities", { cache: "no-store" });
    if (res.ok) setRows((await res.json()).facilities);
  };
  const open = rows.find((r) => r.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Facilities</h1>
      <p className="text-slate-700">
        Capabilities are what a hospital <em>can</em> do; whether it can take a patient now is asked on the call. A direct casualty or
        referral-desk number works far better than a reception line.
      </p>
      {rows.length === 0 && <p className="card p-6">Add the hospitals you refer to most.</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-600">
            <tr>
              <th className="p-3">Name</th><th className="p-3">Kind</th><th className="p-3">Call language</th><th className="p-3">Capabilities</th>
              <th className="p-3">Contacts</th><th className="p-3">Answer rate</th><th className="p-3">Acceptance</th><th className="p-3">Last called</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((f) => {
              const ivrOnly = f.contacts.filter((c) => c.active).every((c) => c.is_ivr);
              return (
                <tr key={f.id} className={`cursor-pointer hover:bg-slate-50 ${f.active ? "" : "opacity-60"}`} onClick={() => setOpenId(f.id)}>
                  <td className="p-3 font-semibold">
                    <button className="text-left text-blue-800 underline" onClick={() => setOpenId(f.id)}>{shortName(f.name)}</button>
                    {f.is_demo && <span className="ml-2 rounded bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600">DEMO</span>}
                  </td>
                  <td className="p-3">{f.kind.replace(/_/g, " ")}</td>
                  <td className="p-3">{LANGUAGE_LABEL[f.call_language] ?? f.call_language}</td>
                  <td className="p-3">
                    <div className="flex max-w-xs flex-wrap gap-1">
                      {f.capabilities.map((c) => <span key={c} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{capLabel.get(c) ?? c}</span>)}
                    </div>
                  </td>
                  <td className="p-3">
                    {f.contacts.filter((c) => c.active).length}
                    {ivrOnly && f.contacts.length > 0 && <span className="ml-1 text-amber-800">⚠ IVR only</span>}
                  </td>
                  <td className="p-3">{pct(f.answered, f.availability_calls)}</td>
                  <td className="p-3">{pct(f.accepted, f.answered)}</td>
                  <td className="p-3 text-slate-600">{f.last_called_at ? clock(f.last_called_at) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && <FacilityDrawer key={open.id} f={open} capabilities={capabilities} onClose={() => setOpenId(null)} onSaved={reload} />}
    </div>
  );
}

function FacilityDrawer({ f, capabilities, onClose, onSaved }: { f: FacilityListItem; capabilities: Capability[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    lat: String(f.lat), lng: String(f.lng), call_language: f.call_language, whatsapp_number: f.whatsapp_number ?? "", active: f.active,
  });
  const [caps, setCaps] = useState<string[]>(f.capabilities);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [newContact, setNewContact] = useState({ role: "casualty_desk", phone: "", priority: 1, is_ivr: false });

  async function save() {
    setError(null);
    setSaved(false);
    const e1 = await send("PATCH", `/api/facilities/${f.id}`, {
      lat: Number(form.lat), lng: Number(form.lng), call_language: form.call_language, whatsapp_number: form.whatsapp_number || null, active: form.active,
    });
    const e2 = e1 ?? (await send("PUT", `/api/facilities/${f.id}/capabilities`, { codes: caps }));
    if (e2) setError(e2);
    else setSaved(true);
    await onSaved();
  }

  async function contactAction(c: Contact, patch: Record<string, unknown>) {
    const err = await send("PATCH", `/api/contacts/${c.id}`, patch);
    setError(err);
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end bg-black/40" onClick={onClose}>
      <aside
        role="dialog"
        aria-labelledby="fd-h"
        className="h-full w-full max-w-xl space-y-5 overflow-y-auto bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="fd-h" className="text-xl font-bold">{shortName(f.name)}</h2>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>

        <section className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="fd-lat">Latitude</label><input id="fd-lat" className="input" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></div>
          <div><label className="label" htmlFor="fd-lng">Longitude</label><input id="fd-lng" className="input" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></div>
          <div>
            <label className="label" htmlFor="fd-lang">Call language</label>
            <select id="fd-lang" className="input" value={form.call_language} onChange={(e) => setForm({ ...form, call_language: e.target.value })}>
              {["en", "kn", "hi"].map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
            </select>
          </div>
          <div><label className="label" htmlFor="fd-wa">WhatsApp number</label><input id="fd-wa" className="input" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="+91…" /></div>
          <label className="col-span-2 flex items-center gap-2"><input type="checkbox" className="size-5" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active (eligible for referrals)</label>
        </section>

        <section>
          <h3 className="label">Static capabilities</h3>
          <div className="flex flex-wrap gap-2">
            {capabilities.map((c) => {
              const on = caps.includes(c.code);
              return (
                <button key={c.code} type="button" aria-pressed={on} className={`chip ${on ? "border-green-700 bg-green-50 text-green-900" : "border-slate-300"}`}
                  onClick={() => setCaps((x) => (on ? x.filter((y) => y !== c.code) : [...x, c.code]))}>
                  {on ? "✓ " : "+ "}{c.label}
                </button>
              );
            })}
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button className="btn btn-primary" onClick={save}>Save hospital</button>
          {saved && <span className="text-green-800">Saved</span>}
        </div>
        {error && <p role="alert" className="font-semibold text-red-700">{error}</p>}

        <section>
          <h3 className="label">Contacts (tried in priority order; IVR lines last)</h3>
          <ul className="space-y-2">
            {f.contacts.map((c) => (
              <li key={c.id} className={`rounded-lg border p-3 text-sm ${c.active ? "border-slate-200" : "border-dashed opacity-60"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono font-semibold">{c.phone_e164}</span>
                  <span>{c.role.replace(/_/g, " ")}</span>
                  <span className="text-slate-600">priority {c.priority}</span>
                  {c.is_ivr && <span className="rounded bg-amber-100 px-1.5 text-amber-900">IVR</span>}
                  <span className="text-slate-600">answered {c.calls_answered}/{c.calls_made}</span>
                  <span className="text-slate-600">{c.verified_at ? `verified ${new Date(c.verified_at).toLocaleDateString("en-IN")}` : "unverified"}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button className="btn btn-secondary" onClick={() => contactAction(c, { active: !c.active })}>{c.active ? "Deactivate" : "Activate"}</button>
                  <button className="btn btn-secondary" onClick={() => contactAction(c, { is_ivr: !c.is_ivr })}>{c.is_ivr ? "Not IVR" : "Mark IVR"}</button>
                  <button className="btn btn-secondary" onClick={() => contactAction(c, { verified: true })}>Mark verified</button>
                </div>
              </li>
            ))}
          </ul>
          <form
            className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const err = await send("POST", `/api/facilities/${f.id}/contacts`, newContact);
              setError(err);
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
            <label className="flex items-end gap-2 pb-3"><input type="checkbox" className="size-5" checked={newContact.is_ivr} onChange={(e) => setNewContact({ ...newContact, is_ivr: e.target.checked })} /> Phone menu (IVR)</label>
            <button className="btn btn-primary col-span-2" type="submit" disabled={!newContact.phone}>Add number</button>
          </form>
        </section>
      </aside>
    </div>
  );
}
