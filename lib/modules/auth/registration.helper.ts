// Medical registration of a referring doctor. Pure rules; the lookup itself is a human check (docs/09 §4).

export interface Registration {
  registration_no: string;
  registration_council: string;
}

export type RegistrationCheck = { ok: true; value: Registration } | { ok: false; error: string };

/** "NMC" in any spelling, so the register can be matched with a plain comparison. */
const NMC = /^(nmc|national medical commission)$/i;

/**
 * A registration number and council as the doctor typed them, tidied. Numbers differ by council (digits, letters,
 * "/" and "-"), so only the shape is checked: 3 to 32 of those characters. Whether the number exists is for an admin.
 */
export function checkRegistration(no: string | null | undefined, council: string | null | undefined): RegistrationCheck {
  const number = (no ?? "").replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z0-9][A-Z0-9/.-]{2,31}$/.test(number)) {
    return { ok: false, error: "The registration number should be 3 to 32 letters, digits, / or -." };
  }
  const name = (council ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 60) return { ok: false, error: "Give the council that issued it: NMC or your state medical council." };
  return { ok: true, value: { registration_no: number, registration_council: NMC.test(name) ? "NMC" : name } };
}

/** Whether a doctor with this status may place referrals, given whether REQUIRE_VERIFIED_REFERRER is on. */
export const mayRefer = (status: string, required: boolean): boolean => !required || status === "verified";
