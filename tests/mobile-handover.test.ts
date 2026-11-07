import { describe, expect, it } from "vitest";

import { EMPTY_HANDOVER, handoverBody, handoverError, pregnancyValid } from "../mobile/src/features/referral/handover.helper";
import { ReferralBody } from "@/lib/modules/referral/referral.validation";
import { KRAIT } from "./support/scripted-calls";

// The phone form sends the handover as structured fields. Whatever it sends must be accepted by the server's schema.

const everything = {
  pregnancy: "34",
  mechanism: "road_accident",
  infection: "airborne",
  bloodNeeded: "yes",
  bloodGroup: "B-",
  consent: "attendant",
  reason: "service_not_available",
};

describe("the phone handover", () => {
  it("sends nothing when nothing is picked", () => {
    expect(handoverBody(EMPTY_HANDOVER)).toEqual({});
    expect(handoverError(EMPTY_HANDOVER)).toBeNull();
  });

  it("sends every pick as the field the server reads", () => {
    expect(handoverBody(everything)).toEqual({
      pregnancy_weeks: 34,
      trauma_mechanism: "road_accident",
      infectious_risk: "airborne",
      blood_needed: true,
      blood_group: "B-",
      transfer_consent: "attendant",
      transfer_reason: "service_not_available",
    });
    expect(handoverBody({ ...EMPTY_HANDOVER, bloodNeeded: "no" })).toEqual({ blood_needed: false });
  });

  it("leaves out weeks that are not 1 to 45 and says what is wrong", () => {
    for (const bad of ["0", "46", "134"]) {
      expect(pregnancyValid(bad)).toBe(false);
      expect(handoverBody({ ...everything, pregnancy: bad })).not.toHaveProperty("pregnancy_weeks");
      expect(handoverError({ ...everything, pregnancy: bad })).toMatch(/weeks/);
    }
    expect(pregnancyValid("")).toBe(true);
    expect(pregnancyValid("45")).toBe(true);
  });

  it("is accepted by the server's request schema", () => {
    const parsed = ReferralBody.safeParse({ ...KRAIT, sex: "female", ...handoverBody(everything) });
    expect(parsed.success).toBe(true);
  });
});
