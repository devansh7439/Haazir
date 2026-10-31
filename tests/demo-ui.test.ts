import { describe, expect, it } from "vitest";
import { ago } from "@/lib/ui/demo";

describe("ago", () => {
  const now = Date.parse("2026-10-31T10:00:00.000Z");

  it("says Never for a missing time", () => {
    expect(ago(null, now)).toBe("Never");
  });

  it("counts seconds, then minutes, up to an hour", () => {
    expect(ago("2026-10-31T09:59:30.000Z", now)).toBe("30s ago");
    expect(ago("2026-10-31T09:50:00.000Z", now)).toBe("10 min ago");
  });

  it("switches to an Indian-time date after an hour", () => {
    expect(ago("2026-10-31T08:00:00.000Z", now)).toContain("2026");
  });
});
