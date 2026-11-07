import { Sparkles } from "lucide-react";
import type { ParsedIntake } from "@/lib/modules/intake/intake.helper";

/** Tells the doctor the form was filled from a WhatsApp message, so they check every field before starting. */
export function DraftBanner({ parsed }: { parsed: ParsedIntake }) {
  return (
    <div className="mb-8 flex items-start gap-3 rounded-xl border border-line bg-zinc-50 px-4 py-3 text-sm">
      <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-zinc-600" />
      <p className="text-zinc-800">
        Filled from your WhatsApp {parsed.matched.length ? `(${parsed.matched.join(", ")})` : "message"}. Check every field before you start.
        {parsed.note_dropped && " The note was left out because it may contain a name or number."}
      </p>
    </div>
  );
}
