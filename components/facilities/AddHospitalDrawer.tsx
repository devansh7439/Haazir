import { Loader2, LocateFixed, Plus, X } from "lucide-react";
import { useState } from "react";
import type { Capability } from "@/lib/core/types";
import { CONTACT_ROLE_LABEL, KIND_LABEL, OWNERSHIP_LABEL, groupByCategory } from "@/lib/ui/facility";
import { cx } from "../ui";

const MAX_DESKS = 3;
type Desk = { role: string; phone: string; is_ivr: boolean };
const blankDesk = (): Desk => ({ role: "casualty_desk", phone: "", is_ivr: false });

/** Latitude and longitude typed as text, as numbers in range, or null when either is missing or out of range. */
function parseCoords(c: { lat: string; lng: string }): { lat: number; lng: number } | null {
  if (c.lat.trim() === "" || c.lng.trim() === "") return null;
  const lat = Number(c.lat);
  const lng = Number(c.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
}

/** A drawer for an admin to list a hospital: where it is, what it offers and which desk numbers to call. */
export function AddHospitalDrawer(props: { capabilities: Capability[]; onClose: () => void; onCreated: (id: string) => Promise<void> }) {
  const [form, setForm] = useState({ name: "", kind: "private_hospital", ownership: "private", address: "", city: "", district: "", call_language: "en", whatsapp_number: "" });
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [services, setServices] = useState<string[]>([]);
  const [desks, setDesks] = useState<Desk[]>([blankDesk()]);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));
  const setDesk = (i: number, patch: Partial<Desk>) => setDesks((d) => d.map((x, n) => (n === i ? { ...x, ...patch } : x)));
  const where = parseCoords(coords);
  const canSave = form.name.trim().length >= 2 && where !== null && !saving;

  function useMyLocation() {
    if (!navigator.geolocation) return setError("This browser can't give its location. Type the coordinates instead.");
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setCoords({ lat: String(Math.round(p.coords.latitude * 1e5) / 1e5), lng: String(Math.round(p.coords.longitude * 1e5) / 1e5) });
        setLocating(false);
      },
      () => {
        setError("Couldn't get your location. Type the coordinates instead.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function save() {
    if (!where) return;
    setSaving(true);
    setError(null);
    const body = {
      name: form.name.trim(),
      kind: form.kind,
      ownership: form.ownership,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      district: form.district.trim() || null,
      lat: where.lat,
      lng: where.lng,
      call_language: form.call_language,
      whatsapp_number: form.whatsapp_number.trim() || null,
      capabilities: services,
      contacts: desks.filter((d) => d.phone.trim()).map((d, i) => ({ role: d.role, phone: d.phone.trim(), priority: i + 1, is_ivr: d.is_ivr })),
    };
    try {
      const res = await fetch("/api/facilities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error?.message ?? "Couldn't list the hospital");
        setSaving(false);
        return;
      }
      await props.onCreated(data.id);
    } catch {
      setError("Network error: check the connection and try again");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[1200] flex justify-end bg-zinc-950/30 backdrop-blur-[2px]" onClick={props.onClose}>
      <aside role="dialog" aria-labelledby="ah-h" className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
          <div>
            <h2 id="ah-h" className="text-lg font-semibold tracking-tight">List a hospital</h2>
            <p className="text-sm text-zinc-500">Other doctors will see its services and desk numbers here.</p>
          </div>
          <button aria-label="Close" className="btn btn-ghost px-2.5" onClick={props.onClose}><X aria-hidden className="size-5" /></button>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-6 py-5">
          <section className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="label" htmlFor="ah-name">Hospital name</label>
              <input id="ah-name" className="input" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="ah-kind">Type</label>
              <select id="ah-kind" className="input" value={form.kind} onChange={(e) => set("kind", e.target.value)}>
                {Object.entries(KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="ah-own">Ownership</label>
              <select id="ah-own" className="input" value={form.ownership} onChange={(e) => set("ownership", e.target.value)}>
                {Object.entries(OWNERSHIP_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="label" htmlFor="ah-addr">Address</label>
              <input id="ah-addr" className="input" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="ah-city">Town or city</label>
              <input id="ah-city" className="input" value={form.city} onChange={(e) => set("city", e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="ah-dist">District</label>
              <input id="ah-dist" className="input" value={form.district} onChange={(e) => set("district", e.target.value)} />
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Location</h3>
                <p className="text-xs text-zinc-500">Drive times are measured from here. Stand at the hospital and use your location, or type the coordinates.</p>
              </div>
              <button type="button" className="btn btn-secondary min-h-9 text-xs" onClick={useMyLocation} disabled={locating}>
                {locating ? <Loader2 aria-hidden className="size-4 animate-spin" /> : <LocateFixed aria-hidden className="size-4" />} Use my location
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="ah-lat">Latitude</label>
                <input id="ah-lat" className="input kbd-num" inputMode="decimal" placeholder="13.0735" value={coords.lat} onChange={(e) => setCoords((c) => ({ ...c, lat: e.target.value }))} />
              </div>
              <div>
                <label className="label" htmlFor="ah-lng">Longitude</label>
                <input id="ah-lng" className="input kbd-num" inputMode="decimal" placeholder="77.7986" value={coords.lng} onChange={(e) => setCoords((c) => ({ ...c, lng: e.target.value }))} />
              </div>
            </div>
            {(coords.lat || coords.lng) && !where && <p className="mt-1.5 text-xs text-rose-600">Latitude is -90 to 90 and longitude -180 to 180.</p>}
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">What this hospital offers</h3>
            <p className="mb-3 text-xs text-zinc-500">Only list what the emergency team can really provide. Hospitals are called only for what they list.</p>
            <div className="space-y-4">
              {groupByCategory(props.capabilities).map((g) => (
                <div key={g.category}>
                  <div className="eyebrow mb-1.5">{g.title}</div>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((c) => {
                      const on = services.includes(c.code);
                      return (
                        <button
                          key={c.code}
                          type="button"
                          aria-pressed={on}
                          className={cx("chip", on ? "chip-on" : "chip-off")}
                          onClick={() => setServices((x) => (on ? x.filter((y) => y !== c.code) : [...x, c.code]))}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h3 className="mb-1 text-sm font-semibold">Desk numbers</h3>
            <p className="mb-3 text-xs text-zinc-500">The emergency desk Haazir should phone, best number first. A direct line is answered far more often than a phone menu.</p>
            <div className="space-y-2">
              {desks.map((d, i) => (
                <div key={i} className="grid grid-cols-[1fr_1.2fr] gap-2 rounded-xl bg-zinc-50 p-3">
                  <select aria-label={`Desk ${i + 1} role`} className="input" value={d.role} onChange={(e) => setDesk(i, { role: e.target.value })}>
                    {Object.entries(CONTACT_ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <input aria-label={`Desk ${i + 1} phone`} className="input kbd-num" inputMode="tel" placeholder="+91…" value={d.phone} onChange={(e) => setDesk(i, { phone: e.target.value })} />
                  <label className="col-span-2 flex items-center gap-2 text-sm text-zinc-700">
                    <input type="checkbox" className="size-4 accent-brand-600" checked={d.is_ivr} onChange={(e) => setDesk(i, { is_ivr: e.target.checked })} />
                    This line is a phone menu (&quot;press 1 for…&quot;)
                  </label>
                </div>
              ))}
            </div>
            {desks.length < MAX_DESKS && (
              <button type="button" className="btn btn-ghost mt-2 min-h-9 text-xs" onClick={() => setDesks((d) => [...d, blankDesk()])}>
                <Plus aria-hidden className="size-4" /> Add another number
              </button>
            )}
            <div className="mt-4">
              <label className="label" htmlFor="ah-wa">WhatsApp number (optional)</label>
              <input id="ah-wa" className="input kbd-num" inputMode="tel" placeholder="+91…" value={form.whatsapp_number} onChange={(e) => set("whatsapp_number", e.target.value)} />
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="ah-lang">Language the desk is called in</label>
              <select id="ah-lang" className="input" value={form.call_language} onChange={(e) => set("call_language", e.target.value)}>
                <option value="en">English</option>
                <option value="kn">Kannada</option>
                <option value="hi">Hindi</option>
              </select>
            </div>
          </section>
        </div>

        <div className="flex items-center gap-3 border-t border-line px-6 py-4">
          {error && <p role="alert" className="mr-auto text-sm font-medium text-rose-600">{error}</p>}
          <button className="btn btn-secondary ml-auto" onClick={props.onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!canSave} onClick={save}>
            {saving && <Loader2 aria-hidden className="size-4 animate-spin" />} List hospital
          </button>
        </div>
      </aside>
    </div>
  );
}
