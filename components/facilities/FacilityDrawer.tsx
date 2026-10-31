import { X } from "lucide-react";
import { useState } from "react";
import type { Capability } from "@/lib/core/types";
import type { FacilityListItem } from "@/lib/modules/facility/facility.type";
import { LANGUAGE_LABEL, shortName } from "@/lib/ui/display";
import { cx } from "../ui";
import { send } from "./api";
import { ContactsSection } from "./ContactsSection";

export function FacilityDrawer({ f, capabilities, onClose, onSaved }: { f: FacilityListItem; capabilities: Capability[]; onClose: () => void; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState({
    lat: String(f.lat), lng: String(f.lng), call_language: f.call_language, whatsapp_number: f.whatsapp_number ?? "", active: f.active,
  });
  const [caps, setCaps] = useState<string[]>(f.capabilities);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

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

          <ContactsSection facilityId={f.id} contacts={f.contacts} onError={setError} onSaved={onSaved} />
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
