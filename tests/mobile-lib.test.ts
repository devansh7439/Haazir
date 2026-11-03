import { describe, expect, it } from "vitest";
import { newRequestId } from "../mobile/src/lib/request-id";
import { ago } from "../mobile/src/lib/time";
import { normalizeServerUrl } from "../mobile/src/lib/url";

describe("normalizeServerUrl", () => {
  it("adds https to a bare host and http to a local address", () => {
    expect(normalizeServerUrl("abc123.ngrok.app")).toBe("https://abc123.ngrok.app");
    expect(normalizeServerUrl("  Haazir.Example.com/  ")).toBe("https://haazir.example.com");
    expect(normalizeServerUrl("localhost:3000")).toBe("http://localhost:3000");
    expect(normalizeServerUrl("192.168.1.20:3000")).toBe("http://192.168.1.20:3000");
    expect(normalizeServerUrl("10.0.2.2:3000")).toBe("http://10.0.2.2:3000");
  });

  it("keeps a scheme and a path prefix, and drops trailing slashes", () => {
    expect(normalizeServerUrl("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(normalizeServerUrl("https://example.com/haazir///")).toBe("https://example.com/haazir");
  });

  it("refuses text that is not an address", () => {
    expect(normalizeServerUrl("")).toBeNull();
    expect(normalizeServerUrl("   ")).toBeNull();
    expect(normalizeServerUrl("not a url")).toBeNull();
    expect(normalizeServerUrl("https://")).toBeNull();
  });
});

describe("newRequestId", () => {
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  it("is a v4 UUID and differs each time", () => {
    const ids = new Set(Array.from({ length: 50 }, newRequestId));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id).toMatch(UUID);
  });

  it("still works where the platform has no crypto", () => {
    const real = globalThis.crypto;
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    try {
      expect(newRequestId()).toMatch(UUID);
    } finally {
      Object.defineProperty(globalThis, "crypto", { value: real, configurable: true });
    }
  });
});

describe("ago", () => {
  const now = new Date("2026-11-02T12:00:00Z").getTime();
  const before = (s: number) => new Date(now - s * 1000).toISOString();
  it("reads naturally", () => {
    expect(ago(before(10), now)).toBe("just now");
    expect(ago(before(5 * 60), now)).toBe("5 min ago");
    expect(ago(before(3 * 3600), now)).toBe("3 h ago");
    expect(ago(before(2 * 86_400), now)).toBe("2 d ago");
    expect(ago(before(30 * 86_400), now)).toMatch(/Oct/);
  });
  it("never reads a future time as negative", () => {
    expect(ago(new Date(now + 60_000).toISOString(), now)).toBe("just now");
  });
});
