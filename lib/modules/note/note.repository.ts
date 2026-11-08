import "server-only";
import { now } from "@/lib/core/clock";
import { one, q } from "@/lib/core/db";

interface NoteRow {
  id: string;
  author_name: string;
  body: string;
  created_at: Date;
}

/** Handover notes (`referral_notes`): server-only, deleted by the retention purge. */
export const NoteRepository = {
  /** A referral's notes, newest first. */
  list: (referralId: string): Promise<NoteRow[]> =>
    q<NoteRow>(
      `select id, author_name, body, created_at from referral_notes where referral_id = $1 order by created_at desc, seq desc`,
      [referralId],
    ),

  /** Stores a note. The organisation is inherited from the referral by trigger (migration 0022). */
  add: async (referralId: string, authorId: string | null, authorName: string, body: string): Promise<NoteRow> => {
    const row = await one<NoteRow>(
      `insert into referral_notes (referral_id, author_id, author_name, body, created_at) values ($1, $2, $3, $4, $5)
       returning id, author_name, body, created_at`,
      [referralId, authorId, authorName, body, now()],
    );
    if (!row) throw new Error("referral_notes insert returned no row");
    return row;
  },
};
