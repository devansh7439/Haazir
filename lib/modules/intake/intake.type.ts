import type { ParsedIntake } from "@/lib/modules/intake/intake.helper";

/** How the doctor sent the case on WhatsApp. */
export type DraftKind = "text" | "voice";

/** A draft as the console sees it: what was understood, never the transcript. */
export interface DraftSummary {
  id: string;
  kind: DraftKind;
  created_at: string;
  parsed: ParsedIntake;
}

export interface NewDraft {
  orgId: string;
  referrerId: string | null;
  kind: DraftKind;
  transcript: string;
  parsed: ParsedIntake;
}
