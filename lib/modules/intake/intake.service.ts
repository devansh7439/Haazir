import "server-only";
import { parseIntake, type ParsedIntake } from "@/lib/modules/intake/intake.helper";
import { IntakeRepository } from "@/lib/modules/intake/intake.repository";
import type { DraftKind, DraftSummary } from "@/lib/modules/intake/intake.type";

const summaryOf = (r: { id: string; kind: DraftKind; created_at: Date; parsed: ParsedIntake }): DraftSummary => ({
  ...r,
  created_at: new Date(r.created_at).toISOString(),
});

/** WhatsApp referral drafts (C2): a doctor's message becomes a form they review and start. */
export const IntakeService = {
  /** Parses the message and saves it as a draft. The transcript stays server-side. */
  create: async (opts: { orgId: string; referrerId: string | null; kind: DraftKind; transcript: string }) => {
    const parsed = parseIntake(opts.transcript, await IntakeRepository.caseTemplates());
    const id = await IntakeRepository.insert({ ...opts, parsed });
    return { id, parsed };
  },

  /** The newest drafts not yet used or dismissed. */
  list: async (orgId: string, limit = 5): Promise<DraftSummary[]> => (await IntakeRepository.listNew(orgId, limit)).map(summaryOf),

  /** One draft of the organisation, or null. */
  get: async (orgId: string, id: string): Promise<DraftSummary | null> => {
    const r = await IntakeRepository.get(orgId, id);
    return r ? summaryOf(r) : null;
  },

  markUsed: (orgId: string, id: string): Promise<void> => IntakeRepository.setStatus(orgId, id, "used"),

  dismiss: (orgId: string, id: string): Promise<void> => IntakeRepository.setStatus(orgId, id, "dismissed"),
};
