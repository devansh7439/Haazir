import { z } from "zod";

/** POST /api/referrals/[id]/notes: the handover note. The length and content rules are `checkHandoverNote`. */
export const NoteBody = z.object({ body: z.string() });
