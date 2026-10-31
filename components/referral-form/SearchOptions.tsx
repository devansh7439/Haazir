import { Field } from "./Field";
import { RADII_KM } from "./options";

/** The search radius and the simulation switch (forced on when Bolna isn't configured). */
export function SearchOptions(props: { radius: number; onRadius: (km: number) => void; simulate: boolean; onSimulate: (on: boolean) => void; bolnaReady: boolean }) {
  return (
    <div className="grid gap-4 border-t border-line bg-zinc-50/60 px-5 py-5 sm:grid-cols-2 sm:items-end sm:px-6">
      <Field label="Search radius" htmlFor="radius">
        <select id="radius" className="input" value={props.radius} onChange={(e) => props.onRadius(Number(e.target.value))}>
          {RADII_KM.map((r) => <option key={r} value={r}>{r} km</option>)}
        </select>
      </Field>
      <label className="flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg border border-line bg-white px-3">
        <span className="text-sm font-medium text-zinc-800">Run as simulation</span>
        <span className="relative inline-flex items-center">
          <input type="checkbox" checked={props.simulate} disabled={!props.bolnaReady} onChange={(e) => props.onSimulate(e.target.checked)} className="peer sr-only" />
          <span className="h-6 w-10 rounded-full bg-zinc-200 transition peer-checked:bg-brand-600 peer-focus-visible:ring-4 peer-focus-visible:ring-brand-100" />
          <span className="absolute left-0.5 size-5 rounded-full bg-white shadow transition peer-checked:translate-x-4" />
        </span>
      </label>
      {!props.bolnaReady && (
        <p className="text-xs text-zinc-500 sm:col-span-2">Bolna isn&apos;t configured on this deployment, so referrals run as simulations.</p>
      )}
    </div>
  );
}
