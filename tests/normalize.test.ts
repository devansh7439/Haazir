import { describe, expect, it } from "vitest";
import { clean, cleanParams, maskPhone, normalizeBedType, normalizeOutcome, normalizePhone, normalizeReferralCode, normalizeYesNo, parseMinutes } from "@/lib/core/normalize";

describe("function payload normaliser", () => {
  it("treats empty, None and unreplaced tokens as missing", () => {
    expect(clean("%(bed_type)s")).toBeNull();
    expect(clean("None")).toBeNull();
    expect(clean("")).toBeNull();
    expect(clean("  null ")).toBeNull();
    expect(clean("undefined")).toBeNull();
    expect(clean(" Dr Kiran ")).toBe("Dr Kiran");
    expect(cleanParams({ a: "%(a)s", b: "x" })).toEqual({ a: null, b: "x" });
  });

  it("parses minutes leniently", () => {
    expect(parseMinutes("15")).toBe(15);
    expect(parseMinutes("15 min")).toBe(15);
    expect(parseMinutes("fifteen")).toBe(15);
    expect(parseMinutes("half an hour")).toBe(30);
    expect(parseMinutes("%(ready_in_minutes)s")).toBeNull();
    expect(parseMinutes("soon")).toBeNull();
  });

  it("normalises Indian phone numbers to E.164", () => {
    expect(normalizePhone("98450 12345")).toBe("+919845012345");
    expect(normalizePhone("09845012345")).toBe("+919845012345");
    expect(normalizePhone("919845012345")).toBe("+919845012345");
    expect(normalizePhone("+91 98450-12345")).toBe("+919845012345");
    expect(normalizePhone("123")).toBeNull();
    expect(maskPhone("+919845012345")).toBe("+91 ••••• ••345");
  });

  it("never guesses accepted from garbled outcomes", () => {
    expect(normalizeOutcome("Accepted")).toBe("accepted");
    expect(normalizeOutcome("haan dekhte hain")).toBe("unclear");
    expect(normalizeOutcome("%(outcome)s")).toBe("unclear");
    expect(normalizeOutcome("ivr_or_recording")).toBe("ivr_blocked");
  });

  it("normalises bed types, yes/no and referral codes", () => {
    expect(normalizeBedType("ICU with ventilator")).toBe("icu_with_ventilator");
    expect(normalizeBedType("something")).toBe("unknown");
    expect(normalizeYesNo("Yes")).toBe("yes");
    expect(normalizeYesNo("maybe")).toBeNull();
    expect(normalizeReferralCode("R 4 8 2 1")).toBe("R-4821");
    expect(normalizeReferralCode("r4821")).toBe("R-4821");
  });
});
