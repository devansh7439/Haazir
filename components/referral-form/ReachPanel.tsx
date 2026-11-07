import { Loader2, MapPin, Play, Square } from "lucide-react";
import type { Eligible, Preview } from "./types";
import { useReadAloud } from "./useReadAloud";

const AXIS_MIN = 80;
const LIST_MAX = 4;

/** Tick spacing for the drive-time axis: every 20 minutes up to 80, then wider so the labels never crowd. */
const tickStep = (axis: number): number => (axis <= 80 ? 20 : axis <= 160 ? 40 : 60);

/** The headline under the card: who would be called, or why not yet. */
function headline(props: { loading: boolean; preview: Preview | null; caseType: string; needLabels: string[]; willCall: Eligible[]; missing: string | null }): string {
  const { preview, willCall } = props;
  if (props.loading && !preview) return "Looking for hospitals…";
  if (willCall.length > 0) {
    const nearest = Math.min(...willCall.map((e) => e.eta_minutes));
    return `${willCall.length} ${willCall.length === 1 ? "hospital" : "hospitals"}${props.needLabels.length ? ` with ${props.needLabels.join(" and ")}` : ""}, nearest ${nearest} min`;
  }
  if (preview?.eligible.length === 0) return "No hospital within reach has these needs. Try a wider radius in the full form.";
  return props.missing ?? "";
}

/**
 * Who would be called, laid out along the drive time with the nearest hospitals listed under it. Before a case is chosen it
 * holds the place, so the page doesn't jump when the first hospitals arrive.
 */
export function ReachPanel(props: { preview: Preview | null; loading: boolean; caseType: string; acuity: string; needLabels: string[]; missing: string | null }) {
  const { preview, caseType } = props;
  const aloud = useReadAloud(preview?.spoken_summary ?? null);
  const willCall = (preview?.eligible.filter((e) => e.will_call) ?? []).toSorted((a, b) => a.eta_minutes - b.eta_minutes);
  const axis = Math.max(AXIS_MIN, ...willCall.map((e) => Math.ceil(e.eta_minutes / 10) * 10));
  const farthest = willCall.length ? Math.max(...willCall.map((e) => e.eta_minutes)) : 0;
  const ticks = Array.from({ length: Math.floor(axis / tickStep(axis)) + 1 }, (_, i) => i * tickStep(axis));
  const pct = (minutes: number) => Math.min(100, (minutes / axis) * 100);

  if (!caseType) {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-2xl border border-dashed border-zinc-300 px-4 py-3.5 text-[13px] text-zinc-500">
        <MapPin aria-hidden className="size-4 shrink-0 text-zinc-400" />
        Hospitals that can take the case appear here as you describe it.
      </div>
    );
  }

  return (
    <section aria-live="polite" aria-label="Hospitals that would be called" className="card mt-6 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-zinc-800">
          {props.loading && !preview ? <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-zinc-400" /> : <MapPin aria-hidden className="size-4 shrink-0 text-zinc-500" />}
          <span className="min-w-0">{headline({ ...props, willCall })}</span>
        </p>
        {aloud.available && preview?.spoken_summary && props.acuity && (
          <button type="button" onClick={aloud.toggle} className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900">
            {aloud.speaking ? <Square aria-hidden className="size-3 fill-current" /> : <Play aria-hidden className="size-3 fill-current" />}
            {aloud.speaking ? "Stop" : "Hear the call"}
          </button>
        )}
      </div>

      {willCall.length > 0 && (
        <>
          <div className="mt-5 px-1">
            <div className="relative h-2.5">
              <span aria-hidden className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-100" />
              <span aria-hidden className="absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-zinc-300 transition-all duration-300" style={{ width: `${pct(farthest)}%` }} />
              {willCall.map((e) => (
                <span
                  key={e.facility_id}
                  title={`${e.name}: ${e.eta_minutes} min`}
                  className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-zinc-900 ring-2 ring-white transition-all duration-300"
                  style={{ left: `${pct(e.eta_minutes)}%` }}
                />
              ))}
            </div>
            <div aria-hidden className="relative mt-2 h-4 font-mono text-[11px] text-zinc-400">
              {ticks.map((t, i) => (
                <span key={t} className={i === ticks.length - 1 ? "absolute right-0" : "absolute"} style={i === 0 || i === ticks.length - 1 ? undefined : { left: `${pct(t)}%`, transform: "translateX(-50%)" }}>
                  {t}
                  {i === ticks.length - 1 ? " min" : ""}
                </span>
              ))}
            </div>
          </div>

          <ul className="mt-3 divide-y divide-line border-t border-line text-[13px]">
            {willCall.slice(0, LIST_MAX).map((e, i) => (
              <li key={e.facility_id} className="flex items-center gap-3 py-2.5">
                <span aria-hidden className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 text-[11px] font-medium text-zinc-600">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate text-zinc-800">{e.name}</span>
                <span className="kbd-num hidden shrink-0 text-zinc-500 sm:inline">{Math.round(e.distance_km)} km</span>
                <span className="kbd-num w-14 shrink-0 text-right font-medium text-zinc-900">{e.eta_minutes} min</span>
              </li>
            ))}
          </ul>
          {willCall.length > LIST_MAX && <p className="border-t border-line pt-2.5 text-[13px] text-zinc-500">and {willCall.length - LIST_MAX} more, called at the same time</p>}
        </>
      )}
    </section>
  );
}
