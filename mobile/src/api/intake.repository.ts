import { z } from 'zod';
import { api } from './client';
import { DraftsSchema } from './schema';

const OkSchema = z.object({ ok: z.literal(true) });

export const IntakeRepository = {
  /** Referrals doctors sent by WhatsApp, waiting to be reviewed. */
  drafts: () => api('/api/intake-drafts', DraftsSchema),

  /** Throws the draft away. Nothing was started from it. */
  dismiss: (id: string) => api(`/api/intake-drafts/${id}/dismiss`, OkSchema, { method: 'POST', body: {} }),
};
