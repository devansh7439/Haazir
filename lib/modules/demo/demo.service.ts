import "server-only";
import { env } from "@/lib/core/config";
import { ApiError } from "@/lib/core/error";
import { normalizePhone } from "@/lib/core/normalize";
import type { Referral } from "@/lib/core/types";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { CallService } from "@/lib/modules/call/call.service";
import { WebhookLogRepository } from "@/lib/modules/call/webhook.repository";
import { DemoRepository } from "@/lib/modules/demo/demo.repository";
import type { DemoFacility, NumberAssignments } from "@/lib/modules/demo/demo.type";
import { scenario } from "@/lib/modules/demo/simulator.service";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";
import type { ReferralInput } from "@/lib/modules/referral/referral.type";
import { SettingRepository } from "@/lib/modules/setting/setting.repository";

const FAMILY_PHONE_KEY = "demo_family_phone";
const DEMO_REFERRER_ID = "00000000-0000-4000-8000-000000000201";
/** The drive time a test call announces. */
const TEST_CALL_ETA_MIN = 18;

/** A phone number as stored (E.164), or a 422 naming what it is for. */
const phoneOrThrow = (raw: string, label: string): string => {
  const p = normalizePhone(raw);
  if (!p) throw ApiError.unprocessable("BAD_NUMBER", `${label}: not a valid phone number`);
  return p;
};

/** The demo story's referral input, a fresh copy each time. */
const demoInput = (): ReferralInput => structuredClone(scenario.referral);

/** The Demo page: phones for the fictional hospitals, test calls, and the stage referral (docs/06-ui-spec.md §4). */
export const DemoService = {
  /** Deletes every demo referral and restores the seed. Assigned phone numbers are kept. */
  reset: async (): Promise<{ deleted_referrals: number }> => {
    const deleted = await DemoRepository.deleteReferrals();
    await DemoRepository.dropRedirectContacts();
    await DemoRepository.resetContactStats();
    await DemoRepository.reseed();
    return { deleted_referrals: deleted };
  },

  /** The demo hospitals in judge-card order, the assigned phones, when Bolna last called in, and which settings are set. */
  status: async () => {
    const rows = await DemoRepository.facilities();
    const facilities: DemoFacility[] = rows
      .map((r) => ({
        facility_id: r.id,
        name: r.name,
        judge_card: scenario.availability[r.id]?.judge_card ?? null,
        call_language: r.call_language,
        contact_id: r.contact_id,
        phone: r.phone,
        whatsapp: r.whatsapp_number,
      }))
      .sort((a, b) => (a.judge_card ?? 99) - (b.judge_card ?? 99));
    return {
      facilities,
      referrer_phone: await DemoRepository.referrerPhone(DEMO_REFERRER_ID),
      family_phone: await SettingRepository.get(FAMILY_PHONE_KEY),
      ...(await WebhookLogRepository.lastContact()),
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
  },

  /** Puts the phones the team controls on the demo hospitals, the doctor and the family. Only demo hospitals can change. */
  assignNumbers: async (b: NumberAssignments) => {
    for (const a of b.assignments) {
      const f = await FacilityRepository.get(a.facility_id);
      if (!f?.is_demo) throw ApiError.unprocessable("NOT_DEMO", "Only demo facilities can be reassigned here");
      if (a.phone) {
        const phone = phoneOrThrow(a.phone, f.name);
        const primary = await DemoRepository.primaryContact(f.id);
        if (primary && primary.phone_e164 !== phone) await DemoRepository.reassignContactPhone(f.id, primary.id, phone);
      }
      if (a.whatsapp !== undefined) {
        await FacilityRepository.setWhatsappNumber(f.id, a.whatsapp ? phoneOrThrow(a.whatsapp, `${f.name} WhatsApp`) : null);
      }
    }
    if (b.referrer_phone) await DemoRepository.setReferrerPhone(DEMO_REFERRER_ID, phoneOrThrow(b.referrer_phone, "Doctor phone"));
    if (b.family_phone !== undefined) {
      await SettingRepository.set(FAMILY_PHONE_KEY, b.family_phone ? phoneOrThrow(b.family_phone, "Family phone") : null);
    }
    return DemoService.status();
  },

  /** The demo story's referral, with the family phone from the Demo page. */
  runReferral: async (simulate: boolean): Promise<Referral> => {
    const input = demoInput();
    const family = await SettingRepository.get(FAMILY_PHONE_KEY);
    if (family && input.patient) input.patient.attendant_phone = family;
    const { referral } = await ReferralService.create(input, { simulate });
    return referral;
  },

  /** One availability call with the fictional demo summary, to rehearse a phone (or a consented real desk). */
  testCall: async (facilityId: string, consentedTest: boolean) => {
    const facility = await FacilityRepository.get(facilityId);
    if (!facility) throw ApiError.notFound("Facility not found");
    const contact = await DemoRepository.primaryContact(facilityId);
    if (!contact) throw ApiError.unprocessable("NO_CONTACT", "This hospital has no active number");
    const input = demoInput();
    const r = await DemoRepository.insertTestCallReferral({
      referrer_id: input.referrer_id,
      case_type: input.case_type,
      acuity: input.acuity,
      age_value: input.age_value,
      age_unit: input.age_unit,
      sex: input.sex,
      note: input.note,
      required_capabilities: input.required_capabilities,
      spoken_summary: (await ReferralService.preview(input)).spoken_summary,
      is_simulated: env.simulationMode,
    });
    if (!r) throw ApiError.internal("INSERT_FAILED", "Could not create the test call");
    const attempt = await CallRepository.insert({
      referral_id: r.id,
      facility_id: facility.id,
      contact_id: contact.id,
      purpose: "availability",
      to_number: contact.phone_e164,
      call_language: facility.call_language,
      eta_minutes: TEST_CALL_ETA_MIN,
    });
    await EventRepository.add(r.id, "test_call", { facility_id: facility.id, consented_test: consentedTest });
    const ok = await CallService.dispatchCall(await ReferralRepository.context(r), attempt!, { consented_test: consentedTest });
    return { referral_id: r.id, attempt_id: attempt!.id, dispatched: ok };
  },
};
