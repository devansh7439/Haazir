import { AudioLines, Loader2, MapPin, Sparkles } from "lucide-react";
import type { Capability } from "@/lib/core/types";
import { LANGUAGE_LABEL, shortName } from "@/lib/ui/display";
import { cx } from "@/components/ui";
import type { Acuity, Preview } from "./types";

/**
 * The side panel: the exact words the voice agent will say, the hospitals it will call (and the next round), and,
 * when nobody qualifies, one-tap ways to widen the search.
 */
export function CallPreview(props: {
  caseType: string;
  acuity: Acuity | "";
  preview: Preview | null;
  error: string | null;
  loading: boolean;
  radius: number;
  needs: string[];
  capByCode: Map<string, Capability>;
  onWiden: () => void;
  onRemoveNeed: (code: string) => void;
}) {
  const { caseType, acuity, preview, error, loading, radius, needs, capByCode } = props;
  const willCall = preview?.eligible.filter((e) => e.will_call) ?? [];
  return (
    <aside aria-label="Call preview" aria-live="polite" className="space-y-4 xl:sticky xl:top-8">
      <section className="card overflow-hidden">
        <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
          <span className="grid size-7 place-items-center rounded-lg bg-brand-50"><AudioLines aria-hidden className="size-4 text-brand-600" /></span>
          <h2 className="text-sm font-semibold">What hospitals will hear</h2>
          {loading && <Loader2 aria-label="Updating" className="ml-auto size-4 animate-spin text-zinc-400" />}
        </div>
        <div className="p-5">
          {!caseType && (
            <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
              <Sparkles aria-hidden className="mx-auto mb-2 size-5 text-zinc-400" />
              Pick a case to see the exact words the voice agent will say, and which hospitals it will call.
            </div>
          )}
          {error && <p className="text-sm text-rose-700">{error}</p>}
          {caseType && !acuity && <p className="text-sm text-zinc-500">Set the acuity to see the full script.</p>}
          {preview?.spoken_summary && acuity && (
            <div className="flex gap-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-[11px] font-semibold text-white">AI</span>
              <blockquote className="rounded-2xl rounded-tl-sm bg-zinc-50 px-4 py-3 text-[15px] leading-relaxed text-zinc-800 ring-1 ring-inset ring-line">
                {preview.spoken_summary}
              </blockquote>
            </div>
          )}
          {preview?.spoken_summary && acuity && (
            <p className="mt-3 text-xs text-zinc-500">The agent introduces itself as an automated assistant for the doctor, discloses recording, and reads the answer back before recording it.</p>
          )}
        </div>
      </section>

      {preview && preview.eligible.length > 0 && (
        <section className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold">Hospitals to call</h2>
            <span className="text-xs text-zinc-500">{willCall.length} in parallel · {radius} km</span>
          </div>
          {!!preview.skipped_far && (
            <p className="border-b border-line bg-zinc-50 px-5 py-2 text-xs text-zinc-600">
              {preview.skipped_far} more {preview.skipped_far === 1 ? "hospital is" : "hospitals are"} over {preview.max_eta_minutes} min away and left out for a {acuity || "this"} patient.
            </p>
          )}
          <ol className="divide-y divide-line">
            {preview.eligible.map((e, i) => (
              <li key={e.facility_id} className={cx("flex gap-3 px-5 py-3", !e.will_call && "opacity-55")}>
                <span className={cx("grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold", e.will_call ? "bg-brand-50 text-brand-700" : "bg-zinc-100 text-zinc-500")}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-zinc-900">{shortName(e.name)}</span>
                    <span className="kbd-num shrink-0 text-sm text-zinc-700">{e.eta_minutes} min</span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
                    <span className="inline-flex items-center gap-1"><MapPin aria-hidden className="size-3" />{e.distance_km} km</span>
                    <span aria-hidden>·</span>
                    <span>{LANGUAGE_LABEL[e.call_language] ?? e.call_language}</span>
                    {e.rank_reasons.filter((r) => !r.endsWith("min away")).map((r) => (
                      <span key={r} className={cx("tag", r === "IVR line only" && "bg-amber-50 text-amber-800")}>{r}</span>
                    ))}
                    {!e.will_call && <span className="tag">next round</span>}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {preview && preview.spoken_summary && preview.eligible.length === 0 && (
        <section className="card p-5">
          <p className="text-sm font-medium text-zinc-900">
            No hospital within {radius} km has {needs.map((n) => capByCode.get(n)?.label ?? n).join(" + ") || "these needs"}.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {radius < 80 && <button type="button" className="btn btn-secondary" onClick={props.onWiden}>Widen to 80 km</button>}
            {preview.suggestions
              .filter((s) => s.startsWith("remove: "))
              .map((s) => {
                const code = s.slice("remove: ".length);
                return (
                  <button key={s} type="button" className="btn btn-secondary" onClick={() => props.onRemoveNeed(code)}>
                    Remove {capByCode.get(code)?.label ?? code}
                  </button>
                );
              })}
          </div>
        </section>
      )}
    </aside>
  );
}
