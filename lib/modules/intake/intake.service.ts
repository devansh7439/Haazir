import "server-only";
import { now } from "@/lib/core/clock";
import { json, one, q } from "@/lib/core/db";
import { parseIntake, type ParsedIntake } from "@/lib/modules/intake/intake.helper";
import type { CaseTemplate } from "@/lib/core/types";

// WhatsApp referral drafts (C2). The transcript stays server-side; the console only ever sees `parsed`.

export interface DraftSummary {
  id: string;
  kind: "text" | "voice";
  created_at: string;
  parsed: ParsedIntake;
}

export async function createDraft(opts: { orgId: string; referrerId: string | null; kind: "text" | "voice"; transcript: string }) {
  const templates = await q<CaseTemplate>(`select case_type, default_capabilities from case_templates`);
  const parsed = parseIntake(opts.transcript, templates);
  const row = await one<{ id: string }>(
    `insert into intake_drafts (org_id, referrer_id, kind, transcript, parsed, created_at)
     values ($1, $2, $3, $4, $5::jsonb, $6) returning id`,
    [opts.orgId, opts.referrerId, opts.kind, opts.transcript, json(parsed), now()],
  );
  return { id: row!.id, parsed };
}

export async function listDrafts(orgId: string, limit = 5): Promise<DraftSummary[]> {
  const rows = await q<{ id: string; kind: "text" | "voice"; created_at: Date; parsed: ParsedIntake }>(
    `select id, kind, created_at, parsed from intake_drafts where org_id = $1 and status = 'new' order by created_at desc limit $2`,
    [orgId, limit],
  );
  return rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
}

export async function getDraft(orgId: string, id: string): Promise<DraftSummary | null> {
  const r = await one<{ id: string; kind: "text" | "voice"; created_at: Date; parsed: ParsedIntake }>(
    `select id, kind, created_at, parsed from intake_drafts where id = $1 and org_id = $2`,
    [id, orgId],
  );
  return r ? { ...r, created_at: new Date(r.created_at).toISOString() } : null;
}

export async function markDraftUsed(orgId: string, id: string): Promise<void> {
  await q(`update intake_drafts set status = 'used' where id = $1 and org_id = $2`, [id, orgId]);
}

export async function dismissDraft(orgId: string, id: string): Promise<void> {
  await q(`update intake_drafts set status = 'dismissed' where id = $1 and org_id = $2`, [id, orgId]);
}
