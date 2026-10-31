import { Field } from "./Field";
import { RADII_KM } from "./options";

/** The search radius, and a warning when Bolna isn't configured (no hospital can be called). */
export function SearchOptions(props: { radius: number; onRadius: (km: number) => void; bolnaReady: boolean }) {
  return (
    <div className="grid gap-4 border-t border-line bg-zinc-50/60 px-5 py-5 sm:grid-cols-2 sm:items-end sm:px-6">
      <Field label="Search radius" htmlFor="radius">
        <select id="radius" className="input" value={props.radius} onChange={(e) => props.onRadius(Number(e.target.value))}>
          {RADII_KM.map((r) => <option key={r} value={r}>{r} km</option>)}
        </select>
      </Field>
      {!props.bolnaReady && (
        <p className="text-xs text-zinc-500 sm:col-span-2">
          Bolna isn&apos;t configured on this deployment, so no hospital can be called. Set BOLNA_API_KEY and BOLNA_AGENT_ID_AVAILABILITY.
        </p>
      )}
    </div>
  );
}
