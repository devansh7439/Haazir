import { describe, expect, it } from "vitest";
import { parseMissedCallFrom } from "@/lib/modules/call/missed-call.service";

describe("parseMissedCallFrom", () => {
  it("reads JSON and the form fields telephony providers send", () => {
    expect(parseMissedCallFrom('{"from":"+919800000301"}')).toBe("+919800000301");
    expect(parseMissedCallFrom("From=%2B919800000301")).toBe("+919800000301");
    expect(parseMissedCallFrom("CallFrom=09800000301&x=1")).toBe("09800000301");
    expect(parseMissedCallFrom("from=%2B91980")).toBe("+91980");
  });

  it("gives null when there is no number or it isn't text", () => {
    expect(parseMissedCallFrom("{}")).toBeNull();
    expect(parseMissedCallFrom('{"from":12345}')).toBeNull();
    expect(parseMissedCallFrom("")).toBeNull();
  });
});
