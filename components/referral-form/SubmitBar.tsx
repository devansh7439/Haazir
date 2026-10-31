import { Loader2 } from "lucide-react";

/**
 * "Find a bed", always in reach: it sticks to the bottom of the screen while the doctor scrolls the form. It must be
 * rendered as a direct child of the form card section (which is overflow-clip, not overflow-hidden), or it stops sticking.
 */
export function SubmitBar(props: { canSubmit: boolean; submitting: boolean; error: string | null; callCount: number; ready: boolean; missing: string | null }) {
  const { canSubmit, submitting, error, callCount, ready, missing } = props;
  return (
    <div className="sticky bottom-0 z-10 space-y-2 border-t border-line bg-white/95 px-5 py-3 backdrop-blur sm:px-6">
      {error && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">{error}</p>}
      <button type="submit" disabled={!canSubmit} className="btn btn-primary btn-lg w-full">
        {submitting ? <><Loader2 aria-hidden className="size-4 animate-spin" /> Starting calls…</> : callCount > 0 && ready ? `Find a bed · call ${callCount} hospitals` : "Find a bed"}
      </button>
      {missing && <p className="text-center text-xs text-zinc-500">{missing} to continue.</p>}
    </div>
  );
}
