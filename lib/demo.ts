import "server-only";
import { env } from "./config";
import { now } from "./clock";
import { getDb, one, q, readSql } from "./db";
import { addEvent } from "./events";
import { lastBolnaContact } from "./handlers";
import { normalizePhone } from "./normalize";
import { createReferral, dispatchCall, loadCtx, previewReferral, type ReferralInput } from "./orchestrator";
import { AppError, getFacility, getSetting, insertAttempt, setSetting } from "./repo";
import { scenario } from "./simulator";
import type { Referral } from "./types";

// Demo control panel (docs/04-api-spec.md §2.12, docs/06-ui-spec.md §4).

const FAMILY_PHONE_KEY = "demo_family_phone";
const DEMO_REFERRER_ID = "00000000-0000-4000-8000-000000000201";

export async function resetDemo(): Promise<{ deleted_referrals: number }> {
  const deleted = await q(`delete from referrals where is_demo returning id`);
  // Contacts added from redirects during runs are dropped; assigned phone numbers are kept.
  await q(
    `delete from facility_contacts c using facilities f
     where c.facility_id = f.id and f.is_demo and c.role = 'other' and c.verified_at is null and c.priority = 9`,
  );
  await q(
    `update facility_contacts c set calls_made = 0, calls_answered = 0, last_outcome = null
     from facilities f where c.facility_id = f.id and f.is_demo`,
  );
  await (await getDb()).exec(readSql("supabase/seed.sql")); // idempotent: restores anything that was removed
  return { deleted_referrals: deleted.length };
}

export interface DemoFacility {
  facility_id: string;
  name: string;
  judge_card: number | null;
  call_language: string;
  contact_id: string | null;
  phone: string | null;
  whatsapp: string | null;
}

export async function demoStatus() {
  const rows = await q<{ id: string; name: string; call_language: string; whatsapp_number: string | null; contact_id: string | null; phone: string | null }>(
    `select f.id, f.name, f.call_language, f.whatsapp_number, c.id as contact_id, c.phone_e164 as phone
     from facilities f
     left join lateral (
       select id, phone_e164 from facility_contacts
       where facility_id = f.id and active order by is_ivr, priority limit 1
     ) c on true
     where f.is_demo and f.id <> '00000000-0000-4000-8000-000000000100'
     order by f.name`,
  );
  const facilities: DemoFacility[] = rows
    .map((r) => ({
      facility_id: r.id,
      name: r.name,
      judge_card: (scenario.availability[r.id] as { judge_card?: number } | undefined)?.judge_card ?? null,
      call_language: r.call_language,
      contact_id: r.contact_id,
      phone: r.phone,
      whatsapp: r.whatsapp_number,
    }))
    .sort((a, b) => (a.judge_card ?? 99) - (b.judge_card ?? 99));
  const referrer = await one<{ phone_e164: string }>(`select phone_e164 from referrers where id = $1`, [DEMO_REFERRER_ID]);
  return {
    facilities,
    referrer_phone: referrer?.phone_e164 ?? null,
    family_phone: await getSetting(FAMILY_PHONE_KEY),
    ...(await lastBolnaContact()),
    config: {
      simulation_mode: env.simulationMode,
      bolna_api_key: !!env.bolnaApiKey,
      availability_agent: !!env.agentId("availability"),
      hold_confirm_agent: !!env.agentId("hold_confirm"),
      release_agent: !!env.agentId("release"),
      webhook_secret: !!env.bolnaWebhookSecret,
      function_secret: !!env.bolnaFunctionSecret,
      app_base_url: env.appBaseUrl || null,
      whatsapp_provider: env.whatsappProvider,
      from_number: !!env.bolnaFromNumber,
    },
  };
}

function phoneOrThrow(raw: string, label: string): string {
  const p = normalizePhone(raw);
  if (!p) throw new AppError(422, "BAD_NUMBER", `${label}: not a valid phone number`);
  return p;
}

export async function assignNumbers(b: {
  assignments: Array<{ facility_id: string; phone: string | null; whatsapp: string | null }>;
  referrer_phone: string | null;
  family_phone: string | null;
}) {
  for (const a of b.assignments) {
    const f = await getFacility(a.facility_id);
    if (!f?.is_demo) throw new AppError(422, "NOT_DEMO", "Only demo facilities can be reassigned here");
    if (a.phone) {
      const phone = phoneOrThrow(a.phone, f.name);
      const primary = await one<{ id: string; phone_e164: string }>(
        `select id, phone_e164 from facility_contacts where facility_id = $1 and active order by is_ivr, priority limit 1`,
        [f.id],
      );
      if (primary && primary.phone_e164 !== phone) {
        // Free the number if another contact of this facility already has it.
        await q(`delete from facility_contacts where facility_id = $1 and phone_e164 = $2 and id <> $3`, [f.id, phone, primary.id]);
        await q(`update facility_contacts set phone_e164 = $2, verified_at = $3 where id = $1`, [primary.id, phone, now()]);
      }
    }
    if (a.whatsapp !== undefined) {
      await q(`update facilities set whatsapp_number = $2 where id = $1`, [f.id, a.whatsapp ? phoneOrThrow(a.whatsapp, `${f.name} WhatsApp`) : null]);
    }
  }
  if (b.referrer_phone) {
    await q(`update referrers set phone_e164 = $2 where id = $1`, [DEMO_REFERRER_ID, phoneOrThrow(b.referrer_phone, "Doctor phone")]);
  }
  if (b.family_phone !== undefined) {
    await setSetting(FAMILY_PHONE_KEY, b.family_phone ? phoneOrThrow(b.family_phone, "Family phone") : null);
  }
  return demoStatus();
}

/** The demo story's referral, with the family phone from the Demo page. */
export async function runDemoReferral(simulate: boolean): Promise<Referral> {
  const input = structuredClone(scenario.referral) as unknown as ReferralInput;
  const family = await getSetting(FAMILY_PHONE_KEY);
  if (family && input.patient) input.patient.attendant_phone = family;
  const { referral } = await createReferral(input, { simulate });
  return referral;
}

/** One availability call with the fictional demo summary, to rehearse a phone (or a consented real desk). */
export async function testCall(facilityId: string, consentedTest: boolean) {
  const facility = await getFacility(facilityId);
  if (!facility) throw new AppError(404, "NOT_FOUND", "Facility not found");
  const contact = await one<{ id: string; phone_e164: string }>(
    `select id, phone_e164 from facility_contacts where facility_id = $1 and active order by is_ivr, priority limit 1`,
    [facilityId],
  );
  if (!contact) throw new AppError(422, "NO_CONTACT", "This hospital has no active number");
  const input = structuredClone(scenario.referral) as unknown as ReferralInput;
  // A closed carrier referral: evaluateReferral ignores it, so a test call never opens waves or holds.
  const t = now();
  const r = await one<Referral>(
    `insert into referrals (status, referrer_id, origin_facility_id, origin_lat, origin_lng, case_type, acuity, age_value,
       age_unit, sex, note, required_capabilities, spoken_summary, transport, is_simulated, is_demo, closed_at, close_reason, created_at, updated_at)
     select 'closed', r.id, r.facility_id, f.lat, f.lng, $2, $3, $4, $5, $6, $7, $8::text[],
            $11, 'ambulance', $9, true, $10, 'test_call', $10, $10
     from referrers r join facilities f on f.id = r.facility_id where r.id = $1
     returning *`,
    [input.referrer_id, input.case_type, input.acuity, input.age_value, input.age_unit, input.sex, input.note,
     input.required_capabilities, env.simulationMode, t, (await previewReferral(input)).spoken_summary],
  );
  if (!r) throw new AppError(500, "INSERT_FAILED", "Could not create the test call");
  const attempt = await insertAttempt({
    referral_id: r.id,
    facility_id: facility.id,
    contact_id: contact.id,
    purpose: "availability",
    to_number: contact.phone_e164,
    call_language: facility.call_language,
    eta_minutes: 18,
  });
  await addEvent(r.id, "test_call", { facility_id: facility.id, consented_test: consentedTest });
  const ok = await dispatchCall(await loadCtx(r), attempt!, { consented_test: consentedTest });
  return { referral_id: r.id, attempt_id: attempt!.id, dispatched: ok };
}
