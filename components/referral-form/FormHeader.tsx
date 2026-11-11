"use client";

import { Zap } from "lucide-react";

/** The full form's title and the switch back to one-sentence entry. */
export function FormHeader({ onQuickEntry }: { onQuickEntry: () => void }) {
  return (
    <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-[32px] font-semibold tracking-tight text-zinc-900">Find a bed</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-snug text-zinc-500">
          Haazir calls every capable hospital nearby at once, in their language, and shows you who says yes.
        </p>
      </div>
      <button type="button" onClick={onQuickEntry} className="btn btn-secondary">
        <Zap aria-hidden className="size-4" /> Quick entry
      </button>
    </div>
  );
}
