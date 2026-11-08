import { checkNote } from "@/lib/modules/referral/summary.helper";

/** The longest handover note (also the database's hard cap). */
export const NOTE_MAX = 500;

export type NoteCheck = { ok: true; body: string } | { ok: false; error: string };

/**
 * The note ready to store, or why it can't be. Whitespace is trimmed and an empty note is refused. A note that looks like it
 * holds a phone number, an ID or an email is refused, as the clinical note is (CLAUDE.md rule 1).
 */
export function checkHandoverNote(text: string): NoteCheck {
  const body = text.trim().replace(/\s+/g, " ");
  if (body.length === 0) return { ok: false, error: "Write what is done and what is pending." };
  if (body.length > NOTE_MAX) return { ok: false, error: `Keep the note under ${NOTE_MAX} characters.` };
  const check = checkNote(body);
  if (check.blocked) return { ok: false, error: check.errors[0] };
  return { ok: true, body };
}
