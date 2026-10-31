import "server-only";
import { now } from "@/lib/core/clock";
import { json, one, q } from "@/lib/core/db";
import type { CaseTemplate } from "@/lib/core/types";
import type { ParsedIntake } from "@/lib/modules/intake/intake.helper";
import type { DraftKind, NewDraft } from "@/lib/modules/intake/intake.type";

type DraftRow = { id: string; kind: DraftKind; created_at: Date; parsed: ParsedIntake };

/** WhatsApp referral drafts (`intake_drafts`, C2). The transcript is written here and never read back to the console. */
export const IntakeRepository = {
  /** Case types and their default needs, for parsing a message. */
  caseTemplates: (): Promise<CaseTemplate[]> => q<CaseTemplate>(`select case_type, default_capabilities from case_templates`),

  insert: async (d: NewDraft): Promise<string> => {
    const row = await one<{ id: string }>(
      `insert into intake_drafts (org_id, referrer_id, kind, transcript, parsed, created_at)
       values ($1, $2, $3, $4, $5::jsonb, $6) returning id`,
      [d.orgId, d.referrerId, d.kind, d.transcript, json(d.parsed), now()],
    );
    return row!.id;
  },

  /** An organisation's newest unused drafts, newest first. */
  listNew: (orgId: string, limit: number): Promise<DraftRow[]> =>
    q<DraftRow>(
      `select id, kind, created_at, parsed from intake_drafts where org_id = $1 and status = 'new' order by created_at desc limit $2`,
      [orgId, limit],
    ),

  get: (orgId: string, id: string): Promise<DraftRow | null> =>
    one<DraftRow>(`select id, kind, created_at, parsed from intake_drafts where id = $1 and org_id = $2`, [id, orgId]),

  setStatus: async (orgId: string, id: string, status: "used" | "dismissed"): Promise<void> => {
    await q(`update intake_drafts set status = $3 where id = $1 and org_id = $2`, [id, orgId, status]);
  },
};
