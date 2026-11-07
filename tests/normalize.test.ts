import { describe, expect, it } from "vitest";
import { clean, cleanParams, isRecord, maskPhone, normalizeBedType, normalizeOutcome, normalizePhone, normalizeReferralCode, normalizeYesNo, parseMinutes, readField, readText, toBolnaStatus } from "@/lib/core/normalize";

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

describe("untrusted object readers", () => {
  it("accepts a plain object and refuses null, arrays and primitives", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord(null)).toBe(false);
    expect(isRecord([1])).toBe(false);
    expect(isRecord("text")).toBe(false);
  });

  it("reads a field only from an object", () => {
    expect(readField({ a: 1 }, "a")).toBe(1);
    expect(readField({ a: 1 }, "b")).toBeUndefined();
    expect(readField(null, "a")).toBeUndefined();
    expect(readField([5], "0")).toBeUndefined();
  });

  it("reads text only when the field is a string", () => {
    expect(readText({ a: "x" }, "a")).toBe("x");
    expect(readText({ a: 3 }, "a")).toBeNull();
    expect(readText(undefined, "a")).toBeNull();
    expect(readText({ error: { message: "nope" } }, "error")).toBeNull();
  });

  it("knows Bolna's statuses and nothing else", () => {
    expect(toBolnaStatus("call-disconnected")).toBe("call-disconnected");
    expect(toBolnaStatus("dispatching")).toBeNull();
  });
});
