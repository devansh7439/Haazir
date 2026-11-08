import "server-only";
import { ApiError } from "@/lib/core/error";
import type { Referral } from "@/lib/core/types";
import type { Session } from "@/lib/modules/auth/session.service";
import { checkHandoverNote } from "@/lib/modules/note/note.helper";
import { NoteRepository } from "@/lib/modules/note/note.repository";
import type { ReferralNote } from "@/lib/modules/note/note.type";

const toNote = (r: { id: string; author_name: string; body: string; created_at: Date }): ReferralNote => ({
  id: r.id,
  author_name: r.author_name,
  body: r.body,
  created_at: new Date(r.created_at).toISOString(),
});

/** Handover notes on a referral. The caller has already loaded the referral through `ScopeService`. */
export const NoteService = {
  /** The referral's notes, newest first. */
  list: async (referral: Referral): Promise<ReferralNote[]> => (await NoteRepository.list(referral.id)).map(toNote),

  /** Adds a note under the signed-in user's name. 422 when it is empty, too long or looks like it holds a phone number or ID. */
  add: async (s: Session, referral: Referral, text: string): Promise<ReferralNote> => {
    const checked = checkHandoverNote(text);
    if (!checked.ok) throw ApiError.unprocessable("INVALID_NOTE", checked.error);
    return toNote(await NoteRepository.add(referral.id, s.uid, s.name?.trim() || "Console", checked.body));
  },
};
