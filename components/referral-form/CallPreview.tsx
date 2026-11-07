import { AudioLines, CornerDownLeft, Command, Loader2 } from "lucide-react";
import type { Capability } from "@/lib/core/types";
import { shortName } from "@/lib/ui/display";
import { cx } from "@/components/ui";
import type { Acuity, Preview } from "./types";

/**
 * The right column: the exact words the voice agent will say, the hospitals it will call (and the next round), the
 * "Find a bed" button, and, when nobody qualifies, one-tap ways to widen the search.
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
  canSubmit: boolean;
  /** False on the case page: the button lives on the patient page. */
  showSubmit?: boolean;
  submitting: boolean;
  submitError: string | null;
  missing: string | null;
  onWiden: () => void;
  onRemoveNeed: (code: string) => void;
}) {
  const { caseType, acuity, preview, error, loading, radius, needs, capByCode } = props;
  const willCall = preview?.eligible.filter((e) => e.will_call) ?? [];
  return (
    <aside aria-label="Call preview" aria-live="polite" className="space-y-3 xl:sticky xl:top-6">
      <section className="card-soft overflow-hidden p-1.5">
        <div className="rounded-xl bg-white p-4">
          <div className="flex items-start gap-3">
            <AudioLines aria-hidden className="mt-0.5 size-[18px] shrink-0 text-zinc-700" />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-medium text-zinc-900">What hospitals will hear</h2>
            </div>
            <span className="max-w-24 text-right text-[11px] leading-tight text-zinc-400">
              {loading ? <Loader2 aria-label="Updating" className="ml-auto size-3.5 animate-spin" /> : "In each desk’s language"}
            </span>
          </div>
          <div className="mt-3">
            {!caseType && <p className="rounded-lg border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">Pick a case to see the exact words the voice agent will say.</p>}
            {error && <p className="text-sm text-rose-700">{error}</p>}
            {caseType && !acuity && <p className="text-sm text-zinc-500">Set the acuity to see the full script.</p>}
            {preview?.spoken_summary && acuity && (
              <blockquote className="text-[17px] leading-[1.6] text-zinc-900">{preview.spoken_summary}</blockquote>
            )}
          </div>
          {preview?.spoken_summary && acuity && (
            <p className="mt-3 text-xs leading-snug text-zinc-400">The script is built from your answers by rules, not written by AI.</p>
          )}
        </div>
      </section>

      {preview && preview.eligible.length > 0 && (
        <section className="card-soft overflow-hidden p-1.5">
          <div className="rounded-xl bg-white px-4 py-3.5">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-sm font-medium text-zinc-900">
                {willCall.length} {willCall.length === 1 ? "hospital" : "hospitals"}, called at once
              </h2>
              <span className="font-mono text-[11px] text-zinc-400">within {radius} km</span>
            </div>
            {!!preview.skipped_far && (
              <p className="mt-2 text-xs text-zinc-500">
                {preview.skipped_far} more {preview.skipped_far === 1 ? "hospital is" : "hospitals are"} over {preview.max_eta_minutes} min away and left out for a {acuity || "this"} patient.
              </p>
            )}
            <ol className="mt-2.5 space-y-1">
              {preview.eligible.map((e, i) => (
                <li key={e.facility_id} className={cx("flex items-baseline gap-3 py-1 text-sm", !e.will_call && "opacity-50")}>
                  <span className="w-5 shrink-0 font-mono text-[11px] text-zinc-400">{String(i + 1).padStart(2, "0")}</span>
                  <span className="min-w-0 flex-1 truncate text-zinc-800">
                    {shortName(e.name)}
                    {!e.will_call && <span className="tag ml-2">next round</span>}
                    {e.rank_reasons.includes("IVR line only") && <span className="tag ml-2">IVR only</span>}
                  </span>
                  <span className="kbd-num shrink-0 font-mono text-[13px] text-zinc-600">{e.eta_minutes} min</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      {preview && preview.spoken_summary && preview.eligible.length === 0 && (
        <section className="card-soft p-5">
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

      {props.showSubmit !== false && (
      <div className="space-y-2 pt-1">
        {props.submitError && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{props.submitError}</p>}
        <button type="submit" disabled={!props.canSubmit} className="btn btn-primary btn-lg w-full justify-between rounded-xl px-5">
          <span className="inline-flex items-center gap-2">
            {props.submitting && <Loader2 aria-hidden className="size-4 animate-spin" />}
            {props.submitting ? "Starting calls…" : willCall.length > 0 && !props.missing ? `Find a bed and call ${willCall.length} ${willCall.length === 1 ? "hospital" : "hospitals"}` : "Find a bed"}
          </span>
          <span aria-hidden className="hidden items-center gap-1 font-mono text-[11px] text-white/60 sm:inline-flex">
            <Command className="size-3" /> <CornerDownLeft className="size-3" />
          </span>
        </button>
        <p className="px-2 text-center text-xs leading-snug text-zinc-400">
          {props.missing ? `${props.missing} to continue.` : "You choose the hospital. Nobody is told to expect the patient until you do."}
        </p>
      </div>
      )}
    </aside>
  );
}
