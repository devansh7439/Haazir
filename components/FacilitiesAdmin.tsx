"use client";

import { Building2, Phone, Search, ShieldCheck, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import type { FacilityListItem } from "@/lib/modules/facility/facility.type";
import type { Capability, Contact } from "@/lib/core/types";
import { LANGUAGE_LABEL, clock, shortName } from "@/lib/ui/display";
import { PageHeader, Stat, cx } from "./ui";

const ROLES = ["casualty_desk", "referral_desk", "nursing_station", "duty_manager", "reception", "other"];

async function send(method: string, url: string, body: unknown): Promise<string | null> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (res.ok) return null;
  const data = await res.json().catch(() => ({}));
  return data?.error?.message ?? "Save failed";
}

function Rate({ n, d }: { n: number; d: number }) {
  if (d === 0) return <span className="text-zinc-400">—</span>;
  const pct = Math.round((100 * n) / d);
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-14 overflow-hidden rounded-full bg-zinc-100">
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="kbd-num text-xs text-zinc-600">{pct}% <span className="text-zinc-400">({n}/{d})</span></span>
    </div>
  );
}

export function FacilitiesAdmin({ initial, capabilities, canEdit }: { initial: FacilityListItem[]; capabilities: Capability[]; canEdit: boolean }) {
  const [rows, setRows] = useState(initial);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const capLabel = new Map(capabilities.map((c) => [c.code, c.label]));
  const reload = async () => {
    const res = await fetch("/api/facilities", { cache: "no-store" });
    if (res.ok) setRows((await res.json()).facilities);
  };
  const open = rows.find((r) => r.id === openId) ?? null;
  const shown = rows.filter((r) => r.name.toLowerCase().includes(query.toLowerCase()));
  const totalCalls = rows.reduce((n, r) => n + r.availability_calls, 0);
  const totalAnswered = rows.reduce((n, r) => n + r.answered, 0);

  return (
    <div>
      <PageHeader
        title="Hospitals"
        description="Store what a hospital can do; Haazir asks whether it can take this patient now. Direct casualty or referral-desk numbers get answered far more than reception lines."
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Hospitals" value={rows.filter((r) => r.active).length} hint={`${rows.filter((r) => !r.active).length} inactive`} />
        <Stat label="Direct desk numbers" value={rows.reduce((n, r) => n + r.contacts.filter((c) => c.active && !c.is_ivr).length, 0)} hint="non-IVR, active" />
        <Stat label="Availability calls" value={totalCalls} />
        <Stat label="Answer rate" value={totalCalls ? `${Math.round((100 * totalAnswered) / totalCalls)}%` : "—"} accent="brand" />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
          <div className="relative w-full max-w-xs">
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
            <input aria-label="Search hospitals" className="input pl-9" placeholder="Search hospitals" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <span className="ml-auto text-xs text-zinc-500">{shown.length} of {rows.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs text-zinc-500">
                <th className="px-5 py-3 font-medium">Hospital</th>
                <th className="px-5 py-3 font-medium">Language</th>
                <th className="px-5 py-3 font-medium">Capabilities</th>
                <th className="px-5 py-3 font-medium">Numbers</th>
                <th className="px-5 py-3 font-medium">Answer rate</th>
                <th className="px-5 py-3 font-medium">Acceptance</th>
                <th className="px-5 py-3 font-medium">Last called</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((f) => {
                const active = f.contacts.filter((c) => c.active);
                const ivrOnly = active.length > 0 && active.every((c) => c.is_ivr);
                return (
                  <tr key={f.id} className={cx("cursor-pointer hover:bg-zinc-50/80", !f.active && "opacity-55")} onClick={() => setOpenId(f.id)}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-zinc-100"><Building2 aria-hidden className="size-4 text-zinc-500" /></span>
                        <div>
                          <button className="text-left font-medium text-zinc-900 hover:text-brand-700" onClick={() => setOpenId(f.id)}>{shortName(f.name)}</button>
                          <div className="text-xs capitalize text-zinc-500">{f.kind.replace(/_/g, " ")}{f.is_demo ? " · demo" : ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-zinc-700">{LANGUAGE_LABEL[f.call_language] ?? f.call_language}</td>
                    <td className="px-5 py-3">
                      <div className="flex max-w-xs flex-wrap gap-1">
                        {f.capabilities.slice(0, 4).map((c) => <span key={c} className="tag">{capLabel.get(c) ?? c}</span>)}
                        {f.capabilities.length > 4 && <span className="tag">+{f.capabilities.length - 4}</span>}
                        {f.capabilities.length === 0 && <span className="text-xs text-zinc-400">None</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5 text-zinc-700"><Phone aria-hidden className="size-3.5 text-zinc-400" />{active.length}</span>
                      {ivrOnly && <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-700"><TriangleAlert aria-hidden className="size-3" />IVR only</span>}
                    </td>
                    <td className="px-5 py-3"><Rate n={f.answered} d={f.availability_calls} /></td>
                    <td className="px-5 py-3"><Rate n={f.accepted} d={f.answered} /></td>
                    <td className="px-5 py-3 text-zinc-500">{f.last_called_at ? clock(f.last_called_at) : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="p-10 text-center text-sm text-zinc-500">Add the hospitals you refer to most.</p>}
      </div>
      {open && canEdit && <FacilityDrawer key={open.id} f={open} capabilities={capabilities} onClose={() => setOpenId(null)} onSaved={reload} />}
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
    setError(await send("PATCH", `/api/contacts/${c.id}`, patch));
    await onSaved();
  }

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end bg-zinc-950/30 backdrop-blur-[2px]" onClick={onClose}>
      <aside role="dialog" aria-labelledby="fd-h" className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h2 id="fd-h" className="text-lg font-semibold tracking-tight">{shortName(f.name)}</h2>
            <p className="text-sm capitalize text-zinc-500">{f.kind.replace(/_/g, " ")}</p>
          </div>
          <button aria-label="Close" className="btn btn-ghost px-2.5" onClick={onClose}><X aria-hidden className="size-5" /></button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <section>
            <h3 className="mb-3 text-sm font-semibold">Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label" htmlFor="fd-lat">Latitude</label><input id="fd-lat" className="input" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} /></div>
              <div><label className="label" htmlFor="fd-lng">Longitude</label><input id="fd-lng" className="input" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} /></div>
              <div>
                <label className="label" htmlFor="fd-lang">Call language</label>
                <select id="fd-lang" className="input" value={form.call_language} onChange={(e) => setForm({ ...form, call_language: e.target.value })}>
                  {["en", "kn", "hi"].map((l) => <option key={l} value={l}>{LANGUAGE_LABEL[l]}</option>)}
                </select>
              </div>
              <div><label className="label" htmlFor="fd-wa">WhatsApp number</label><input id="fd-wa" className="input" value={form.whatsapp_number} onChange={(e) => setForm({ ...form, whatsapp_number: e.target.value })} placeholder="+91…" /></div>
              <label className="col-span-2 flex items-center gap-2.5 text-sm text-zinc-700">
                <input type="checkbox" className="size-4 accent-brand-600" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                Active: eligible for referrals
              </label>
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">Capabilities</h3>
            <p className="mb-3 text-xs text-zinc-500">What this hospital can do at all. Live availability is asked on the call.</p>
            <div className="flex flex-wrap gap-2">
              {capabilities.map((c) => {
                const on = caps.includes(c.code);
                return (
                  <button key={c.code} type="button" aria-pressed={on} className={cx("chip", on ? "chip-on" : "chip-off")}
                    onClick={() => setCaps((x) => (on ? x.filter((y) => y !== c.code) : [...x, c.code]))}>
                    <span aria-hidden className={cx("size-1.5 rounded-full", on ? "bg-white" : "bg-zinc-300")} />
                    {c.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">Phone numbers</h3>
            <p className="mb-3 text-xs text-zinc-500">Tried in priority order. Phone-menu (IVR) lines go last, because the agent can&apos;t press keys.</p>
            <ul className="divide-y divide-line rounded-xl border border-line">
              {f.contacts.map((c) => (
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
              <label className="flex items-end gap-2 pb-2.5 text-sm text-zinc-700"><input type="checkbox" className="size-4 accent-brand-600" checked={newContact.is_ivr} onChange={(e) => setNewContact({ ...newContact, is_ivr: e.target.checked })} /> Phone menu (IVR)</label>
              <button className="btn btn-secondary col-span-2" type="submit" disabled={!newContact.phone}>Add number</button>
            </form>
          </section>
        </div>

        <div className="flex items-center gap-3 border-t border-line px-6 py-4">
          {error && <p role="alert" className="mr-auto text-sm font-medium text-rose-600">{error}</p>}
          {saved && !error && <p className="mr-auto text-sm text-emerald-700">Saved</p>}
          <button className="btn btn-secondary ml-auto" onClick={onClose}>Close</button>
          <button className="btn btn-primary" onClick={save}>Save changes</button>
        </div>
      </aside>
    </div>
  );
}
