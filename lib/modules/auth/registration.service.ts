import "server-only";
import { now } from "@/lib/core/clock";
import { ApiError } from "@/lib/core/error";
import { createLogger } from "@/lib/core/logger";
import type { Referrer } from "@/lib/core/types";
import { AuthRepository } from "@/lib/modules/auth/auth.repository";
import { checkRegistration } from "@/lib/modules/auth/registration.helper";
import type { Session } from "@/lib/modules/auth/session.service";

const log = createLogger("registration");

/** A referring doctor's medical registration and the admin check of it. Nothing here calls an outside register. */
export const RegistrationService = {
  /**
   * Stores the doctor's registration number and council and marks them "pending". A doctor can only do this for
   * themselves; an admin can for anyone in the organisation. A changed number is checked again.
   */
  submit: async (s: Session, referrer: Referrer, input: { registration_no: string; registration_council: string }): Promise<Referrer> => {
    if (s.role !== "admin" && s.rid !== referrer.id) throw ApiError.forbidden("You can only give your own registration");
    const check = checkRegistration(input.registration_no, input.registration_council);
    if (!check.ok) throw ApiError.unprocessable("INVALID_REGISTRATION", check.error);
    const updated = await AuthRepository.setRegistration(referrer.id, check.value.registration_no, check.value.registration_council);
    if (!updated) throw ApiError.notFound("Doctor not found");
    log.info({ referrer_id: referrer.id }, "registration submitted");
    return updated;
  },

  /** An admin's decision after looking the number up. 409 when the doctor has given no registration yet. */
  decide: async (s: Session, referrer: Referrer, decision: "verified" | "rejected"): Promise<Referrer> => {
    if (s.role !== "admin") throw ApiError.forbidden("Only an admin can verify a doctor");
    const updated = await AuthRepository.setVerification(referrer.id, decision, s.uid, now());
    if (!updated) throw ApiError.conflict("NO_REGISTRATION", "This doctor has not given a registration number yet");
    log.info({ referrer_id: referrer.id, decision, by: s.uid }, "registration decided");
    return updated;
  },

  /** The organisation's doctors with their status, for the admin list. No phone numbers leave this view. */
  list: async (orgId: string) =>
    (await AuthRepository.referrers(orgId)).map((r) => ({
      id: r.id,
      name: r.name,
      registration_no: r.registration_no,
      registration_council: r.registration_council,
      verification_status: r.verification_status,
      verified_at: r.verified_at,
    })),
};
