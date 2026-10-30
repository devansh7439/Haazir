import "server-only";
import { TICK_INTERVAL_MS, TICK_INTERVAL_SIM_MS } from "@/lib/core/config";
import { q } from "@/lib/core/db";
import { loadCtx } from "@/lib/orchestrator";
import { getReferral } from "@/lib/repo";
import type { Attempt, EventRow, Referral } from "@/lib/core/types";

// What the console sees for one referral (GET /api/referrals/:id). Never includes patient_details or
// message bodies: message previews come from redacted `handoff_sent` events.

export interface AttemptView extends Attempt {
  facility_name: string | null;
  facility_lat: number | null;
  facility_lng: number | null;
  contact_role: string | null;
  contact_is_ivr: boolean | null;
}

export interface Alert {
  event_id: number;
  type: "doctor_callback_requested" | "inbound_callback" | "alert";
  attempt_id: string | null;
  facility_name: string | null;
  number: string | null;
  reason: string | null;
  contact_person: string | null;
  kind: string | null;
  created_at: string;
}

export interface ReferralView {
  referral: Referral;
  case_label: string;
  needs: Array<{ code: string; label: string }>;
  referrer: { name: string; facility_name: string | null };
  origin: { lat: number; lng: number; name: string | null };
  attempts: AttemptView[];
  events: EventRow[];
  messages: Array<{ audience: string; to_masked: string; status: string; preview_redacted: string; created_at: string }>;
  alerts: Alert[];
  portal_flags: Record<string, { detail: string; source: string; observed_at: string }>;
  tick_interval_ms: number;
  server_time: string;
}

export async function getReferralView(id: string): Promise<ReferralView | null> {
  const referral = await getReferral(id);
  if (!referral) return null;
  const ctx = await loadCtx(referral);
  const [attempts, eventsDesc] = await Promise.all([
    q<AttemptView>(
      `select a.*, f.name as facility_name, f.lat as facility_lat, f.lng as facility_lng,
              c.role as contact_role, c.is_ivr as contact_is_ivr
       from call_attempts a
       left join facilities f on f.id = a.facility_id
       left join facility_contacts c on c.id = a.contact_id
       where a.referral_id = $1
       order by a.created_at, a.rank nulls last`,
      [id],
    ),
    q<EventRow>(`select * from events where referral_id = $1 order by created_at desc, id desc limit 200`, [id]),
  ]);
  const events = [...eventsDesc].reverse();
  // Defence in depth: the family call is never shown, even if a transcript was stored before this rule existed.
  for (const a of attempts) {
    if (a.purpose === "family_update") {
      a.transcript = null;
      a.recording_url = null;
      a.extracted_data = null;
    }
  }

  const dismissed = new Set(
    events.filter((e) => e.type === "alert_dismissed").map((e) => Number((e.payload as { event_id?: number }).event_id)),
  );
  const resolvedAttempts = new Set(attempts.filter((a) => a.outcome && a.outcome !== "needs_doctor").map((a) => a.id));
  const alerts: Alert[] = events
    .filter((e) => ["doctor_callback_requested", "inbound_callback", "alert"].includes(e.type) && !dismissed.has(e.id))
    .filter((e) => !(e.type === "doctor_callback_requested" && e.attempt_id && resolvedAttempts.has(e.attempt_id)))
    .map((e) => {
      const p = e.payload as Record<string, unknown>;
      return {
        event_id: e.id,
        type: e.type as Alert["type"],
        attempt_id: e.attempt_id,
        facility_name: (p.facility_name as string) ?? null,
        number: (p.number as string) ?? null,
        reason: ((p.reason ?? p.message) as string) ?? null,
        contact_person: (p.contact_person as string) ?? null,
        kind: (p.kind as string) ?? null,
        created_at: new Date(e.created_at).toISOString(),
      };
    });

  const messages = events
    .filter((e) => e.type === "handoff_sent")
    .map((e) => {
      const p = e.payload as Record<string, string>;
      return {
        audience: p.audience,
        to_masked: p.to_masked,
        status: p.status,
        preview_redacted: p.preview_redacted,
        created_at: new Date(e.created_at).toISOString(),
      };
    });

  const portal_flags: ReferralView["portal_flags"] = {};
  for (const e of events.filter((x) => x.type === "portal_mismatch" && x.attempt_id)) {
    const p = e.payload as { detail: string; source: string; observed_at: string };
    portal_flags[e.attempt_id!] = { detail: p.detail, source: p.source, observed_at: p.observed_at };
  }

  return {
    referral,
    portal_flags,
    case_label: ctx.template.label,
    needs: ctx.needs.map((n) => ({ code: n.code, label: n.label })),
    referrer: { name: ctx.referrer.name, facility_name: ctx.origin?.name ?? null },
    origin: { lat: referral.origin_lat, lng: referral.origin_lng, name: ctx.origin?.name ?? null },
    attempts,
    events,
    messages,
    alerts,
    tick_interval_ms: referral.is_simulated ? TICK_INTERVAL_SIM_MS : TICK_INTERVAL_MS,
    server_time: new Date().toISOString(),
  };
}

export interface ReferralListItem {
  id: string;
  code: string;
  status: string;
  case_label: string;
  acuity: string;
  is_simulated: boolean;
  created_at: string;
  ttfa_seconds: number | null;
  time_to_confirmed_seconds: number | null;
  calls_total: number;
  close_reason: string | null;
}

export async function listReferrals(orgId: string, limit = 50): Promise<ReferralListItem[]> {
  const rows = await q<ReferralListItem>(
    `select r.id, r.code, r.status, t.label as case_label, r.acuity, r.is_simulated, r.created_at, r.close_reason,
            m.ttfa_seconds, m.time_to_confirmed_seconds, m.calls_total::int as calls_total
     from referrals r
     join case_templates t on t.case_type = r.case_type
     join referral_metrics m on m.id = r.id
     where r.org_id = $2 and coalesce(r.close_reason, '') <> 'test_call'
     order by r.created_at desc
     limit $1`,
    [limit, orgId],
  );
  return rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
}
