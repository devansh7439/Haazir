import "server-only";
import { DESK_WINDOW_H, HOSPITAL_FULL_HOURS, env } from "@/lib/core/config";
import { addMinutes, now } from "@/lib/core/clock";
import { ApiError } from "@/lib/core/error";
import { withoutDemoTag } from "@/lib/modules/call/call.helper";
import { EventRepository } from "@/lib/modules/event/event.repository";
import { hashDeskToken, deskState, looksLikeDeskToken, newDeskToken } from "@/lib/modules/hospital/hospital.helper";
import { HospitalRepository } from "@/lib/modules/hospital/hospital.repository";
import type { DeskFacility, DeskSnapshot } from "@/lib/modules/hospital/hospital.type";
import { PushService } from "@/lib/modules/push/push.service";
import { ReferralRepository } from "@/lib/modules/referral/referral.repository";
import { ReferralService } from "@/lib/modules/referral/referral.service";

/** The hospital behind a link. An unknown, replaced or malformed token is one and the same 401. */
const resolve = async (token: string | undefined): Promise<DeskFacility> => {
  const found = token && looksLikeDeskToken(token) ? await HospitalRepository.byTokenHash(hashDeskToken(token)) : null;
  if (!found) throw ApiError.unauthorized("This link doesn't work. Ask for a new one.");
  return found;
};

/**
 * The hospital's own screen, opened by a private link (no accounts): the calls it took, "we're full", and "we can no
 * longer take this patient". It shows the case as read on the call and never a patient identifier.
 */
export const HospitalService = {
  /** Makes (or replaces) a hospital's link. The address is shown once: only its hash is kept. */
  createLink: async (orgId: string, facilityId: string): Promise<{ url: string }> => {
    const token = newDeskToken();
    await HospitalRepository.upsertLink(facilityId, orgId, hashDeskToken(token));
    return { url: `${env.appBaseUrl.replace(/\/$/, "")}/hospital/${token}` };
  },

  /** Refuses (401) a link that doesn't work. Routes call it before they read a request body. */
  check: async (token: string | undefined): Promise<void> => {
    await resolve(token);
  },

  snapshot: async (token: string): Promise<DeskSnapshot> => {
    const f = await resolve(token);
    const t = now();
    const rows = await HospitalRepository.recentCalls(f.facility_id, addMinutes(t, -DESK_WINDOW_H * 60));
    return {
      facility_name: withoutDemoTag(f.name),
      full_until: f.full_until && new Date(f.full_until) > t ? new Date(f.full_until).toISOString() : null,
      referrals: rows.map((r) => {
        const state = deskState(r, f.facility_id);
        return {
          code: r.code,
          summary: r.summary,
          doctor: r.doctor_name ? withoutDemoTag(r.doctor_name) : null,
          referring_facility: r.origin_name ? withoutDemoTag(r.origin_name) : null,
          eta_minutes: r.eta_minutes,
          asked_at: new Date(r.created_at).toISOString(),
          state,
          hold_until: state === "held" && r.hold_expires_at ? new Date(r.hold_expires_at).toISOString() : null,
          can_withdraw: state === "chosen" || state === "held",
          treatment_started_at: r.treatment_started_at ? new Date(r.treatment_started_at).toISOString() : null,
        };
      }),
      server_time: t.toISOString(),
    };
  },

  /** Skips the hospital in new searches for `hours` (default HOSPITAL_FULL_HOURS), or takes the mark off. */
  setFull: async (token: string, full: boolean, hours?: number): Promise<DeskSnapshot> => {
    const f = await resolve(token);
    await HospitalRepository.setFullUntil(f.facility_id, full ? addMinutes(now(), (hours ?? HOSPITAL_FULL_HOURS) * 60) : null);
    return HospitalService.snapshot(token);
  },

  /** The hospital says treatment has started for the patient held there: the door-to-treatment time. First tap wins. */
  treatmentStarted: async (token: string, code: string): Promise<DeskSnapshot> => {
    const f = await resolve(token);
    const r = await ReferralRepository.getByCode(code.toUpperCase());
    if (!r || r.selected_facility_id !== f.facility_id || r.status !== "confirmed") {
      throw ApiError.conflict("NOT_HELD", "That patient is not held at your hospital");
    }
    await ReferralService.recordTreatmentStarted(r);
    return HospitalService.snapshot(token);
  },

  /**
   * The hospital can no longer take a patient it said yes to. The doctor is alerted (board and push) and decides; the
   * referral's state is not changed from here. Only for the referral this hospital was chosen for.
   */
  withdraw: async (token: string, code: string): Promise<DeskSnapshot> => {
    const f = await resolve(token);
    const r = await ReferralRepository.getByCode(code.toUpperCase());
    const chosen = r && r.selected_facility_id === f.facility_id && (r.status === "confirming" || r.status === "confirmed");
    if (!r || !chosen) throw ApiError.conflict("NOT_CHOSEN", "That patient is not held at your hospital");
    if (!(await HospitalRepository.hasWithdrawn(r.id, f.facility_id))) {
      await EventRepository.add(r.id, "alert", {
        kind: "hospital_withdrew",
        facility_id: f.facility_id,
        message: `${withoutDemoTag(f.name)} says it can no longer take the patient. Call the desk, then choose another hospital.`,
      });
      await PushService.notify(r.id, "bed_declined", f.facility_id);
    }
    return HospitalService.snapshot(token);
  },
};
