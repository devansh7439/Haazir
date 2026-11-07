import { HeartPulse, Phone } from "lucide-react";
import { shortName } from "@/lib/ui/display";
import type { NearestEmergency } from "@/lib/modules/facility/facility.type";

/** The closest emergency departments with a direct casualty desk number, nearest first. */
export function NearestEdList({ hospitals }: { hospitals: NearestEmergency[] }) {
  return (
    <ul className="space-y-2">
      {hospitals.map((h) => (
        <li key={h.facility_id} className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{shortName(h.name)}</div>
            <div className="text-xs text-zinc-500">{h.distance_km} km · about {h.eta_minutes} min</div>
          </div>
          <a className="btn btn-secondary" href={`tel:${h.phone}`}><Phone aria-hidden className="size-4" /> {h.phone}</a>
        </li>
      ))}
    </ul>
  );
}

/** For a critical patient while the search runs: stabilising at the nearest emergency department is the doctor's call. */
export function StabilisePanel({ hospitals }: { hospitals: NearestEmergency[] }) {
  return (
    <section className="card overflow-hidden" aria-labelledby="stab-h">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600"><HeartPulse aria-hidden className="size-5" /></span>
        <div>
          <h2 id="stab-h" className="text-[15px] font-semibold">Can&apos;t wait for a yes?</h2>
          <p className="mt-0.5 text-sm text-zinc-600">
            A critical patient may do better stabilised at the nearest emergency department, then transferred. The search keeps running either way.
          </p>
        </div>
      </div>
      <div className="px-5 py-3">
        <NearestEdList hospitals={hospitals} />
      </div>
    </section>
  );
}
