import { describe, expect, it } from "vitest";
import { NOTE_MAX, checkHandoverNote } from "@/lib/modules/note/note.helper";

describe("a handover note", () => {
  it("is trimmed and its spaces tidied", () => {
    expect(checkHandoverNote("  Called   Banyan.\n Waiting. ")).toEqual({ ok: true, body: "Called Banyan. Waiting." });
  });

  it("can't be empty", () => {
    expect(checkHandoverNote("  \n ")).toMatchObject({ ok: false });
  });

  it("can't be longer than the limit", () => {
    expect(checkHandoverNote("a".repeat(NOTE_MAX))).toMatchObject({ ok: true });
    expect(checkHandoverNote("a".repeat(NOTE_MAX + 1))).toMatchObject({ ok: false });
  });

  it("can't hold a phone number, an ID or an email, as the clinical note can't", () => {
    for (const text of ["call 98450 12345", "aadhaar 1234 5678 9012", "x@y.org"]) {
      expect(checkHandoverNote(text)).toMatchObject({ ok: false });
    }
  });
});
