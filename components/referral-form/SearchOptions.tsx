import { Segmented } from "./PatientSection";
import { RADII_KM } from "./options";

/** The search radius, and a warning when Bolna isn't configured (no hospital can be called). */
export function SearchOptions(props: { radius: number; onRadius: (km: number) => void; bolnaReady: boolean }) {
  return (
    <>
      <div className="grid gap-1.5">
        <span className="label mb-0">Search radius</span>
        <Segmented
          name="radius"
          label="Search radius"
          value={String(props.radius)}
          options={RADII_KM.map((r) => ({ value: String(r), label: `${r} km` }))}
          onChange={(v) => props.onRadius(Number(v))}
        />
      </div>
      {!props.bolnaReady && (
        <p className="text-xs text-zinc-500">
          Bolna isn&apos;t configured on this deployment, so no hospital can be called. Set BOLNA_API_KEY and BOLNA_AGENT_ID_AVAILABILITY.
        </p>
      )}
    </>
  );
}
