import type { VerificationStatus } from "@/lib/core/types";
import type { Tone } from "@/lib/ui/display";

/** How a doctor's registration status reads on screen, with the pill tone from lib/ui/display. */
export const VERIFICATION: Record<VerificationStatus, { text: string; tone: Tone; hint: string }> = {
  verified: { text: "Verified", tone: "green", hint: "An admin checked the registration." },
  pending: { text: "Waiting for an admin", tone: "amber", hint: "The number is with an admin to check against the register." },
  rejected: { text: "Not verified", tone: "red", hint: "The number could not be matched. Check it and send it again." },
  unverified: { text: "No registration given", tone: "grey", hint: "Add your medical registration number." },
};

/** One doctor as the admin list returns it (GET /api/referrers). */
export interface DoctorRow {
  id: string;
  name: string;
  registration_no: string | null;
  registration_council: string | null;
  verification_status: VerificationStatus;
  verified_at: string | null;
}
