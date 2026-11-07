import "server-only";
import { now } from "@/lib/core/clock";
import { ApiError } from "@/lib/core/error";
import { createLogger } from "@/lib/core/logger";
import type { Referral, TransferConsent, TransferReason } from "@/lib/core/types";
import { facilityArea, withoutDemoTag } from "@/lib/modules/call/call.helper";
import { CallRepository } from "@/lib/modules/call/call.repository";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { type Slip, buildSlip } from "@/lib/modules/referral/slip.helper";

const log = createLogger("slip");

/** Referral statuses where the doctor can still record who agreed to the transfer. */
const CONSENT_RECORDABLE: Referral["status"][] = ["searching", "options_ready", "confirming", "confirmed", "exhausted", "closed"];

/** The transfer record of a referral: consent to the transfer, and the slip handed over with the patient. */
export const SlipService = {
  /**
   * Records, or corrects, who agreed to the transfer and why the patient is being sent. The time is the moment of
   * recording. 409 once the referral was cancelled.
   */
  recordConsent: async (referral: Referral, consent: TransferConsent, reason: TransferReason | null): Promise<Referral> => {
    const updated = await ReferralRepository.update(
      referral.id,
      { transfer_consent: consent, transfer_consent_at: now(), transfer_reason: reason ?? referral.transfer_reason },
      CONSENT_RECORDABLE,
    );
    if (!updated) throw ApiError.conflict("NOT_RECORDABLE", `Referral is ${referral.status}`);
    await EventRepository.add(referral.id, "transfer_consent_recorded", { consent, reason: updated.transfer_reason });
    log.info({ referral_id: referral.id, consent }, "transfer consent recorded");
    return updated;
  },

  /** The slip for a referral with a confirmed bed. 409 when no hospital has been confirmed yet. */
  get: async (referral: Referral): Promise<Slip> => {
    if (!referral.selected_attempt_id || !referral.selected_facility_id || !referral.confirmed_at) {
      throw ApiError.conflict("NO_DESTINATION", "The slip is ready once a hospital has confirmed the bed");
    }
    const ctx = await ReferralRepository.context(referral);
    const [selected, facility, hold] = await Promise.all([
      CallRepository.get(referral.selected_attempt_id),
      FacilityRepository.get(referral.selected_facility_id),
      CallRepository.latestConfirmedHold(referral.id),
    ]);
    if (!selected || !facility) throw ApiError.conflict("NO_DESTINATION", "The slip is ready once a hospital has confirmed the bed");
    return buildSlip({
      referral,
      referrer: ctx.referrer,
      origin_name: ctx.origin ? withoutDemoTag(ctx.origin.name) : null,
      case_label: ctx.template.label,
      needs_labels: ctx.needs.map((n) => n.label),
      hospital_name: withoutDemoTag(facility.name),
      hospital_address: facilityArea(facility) || null,
      desk_number: selected.to_number,
      contact_person: hold?.contact_person || selected.contact_person,
      bed_type: selected.bed_type,
      eta_minutes: selected.eta_minutes,
    });
  },
};
