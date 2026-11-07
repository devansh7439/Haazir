import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearRoutingCache, roadMinutes } from "@/lib/integrations/routing/routing.client";
import { withRoadMinutes, type EligibleRow } from "@/lib/modules/facility/matching.helper";

const FROM = { lat: 13.07, lng: 77.8 };
const TO = [{ lat: 13.1, lng: 77.6 }, { lat: 13.2, lng: 77.5 }];

const answer = (durations: Array<number | null>) => new Response(JSON.stringify({ code: "Ok", durations: [[0, ...durations]] }), { status: 200 });

beforeEach(() => {
  clearRoutingCache();
  vi.stubEnv("ROUTING_BASE_URL", "http://router.test/");
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("road drive times", () => {
  it("is off without a server, and asks nothing", async () => {
    vi.stubEnv("ROUTING_BASE_URL", "");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(await roadMinutes(FROM, TO)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("asks the table service once for every hospital and rounds seconds up to minutes", async () => {
    const fetchSpy = vi.fn(async () => answer([61, 1200]));
    vi.stubGlobal("fetch", fetchSpy);
    expect(await roadMinutes(FROM, TO)).toEqual([2, 20]);
    expect(String((fetchSpy.mock.calls[0] as unknown[])[0])).toBe(
      "http://router.test/table/v1/driving/77.80000,13.07000;77.60000,13.10000;77.50000,13.20000?sources=0&annotations=duration",
    );
  });

  it("does not route the same origin and hospital again soon", async () => {
    const fetchSpy = vi.fn(async () => answer([600, 900]));
    vi.stubGlobal("fetch", fetchSpy);
    await roadMinutes(FROM, TO);
    expect(await roadMinutes(FROM, TO)).toEqual([10, 15]);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("gives null for an unroutable hospital and null overall when the server fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => answer([600, null])));
    expect(await roadMinutes(FROM, TO)).toEqual([10, null]);
    clearRoutingCache();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("down", { status: 503 })));
    expect(await roadMinutes(FROM, TO)).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("timeout"); }));
    expect(await roadMinutes(FROM, TO)).toBeNull();
  });
});

describe("withRoadMinutes", () => {
  const row = (id: string, eta: number): EligibleRow => ({ id, name: id, lat: 0, lng: 0, distance_km: 5, eta_minutes: eta, call_language: "en", availability_calls: 0, answered: 0, accepted: 0 });

  it("replaces the estimate where the router answered and keeps it elsewhere", () => {
    expect(withRoadMinutes([row("a", 18), row("b", 35), row("c", 40)], [25, null, 0]).map((r) => r.eta_minutes)).toEqual([25, 35, 1]);
  });

  it("keeps every estimate when there is no routing answer", () => {
    const rows = [row("a", 18)];
    expect(withRoadMinutes(rows, null)).toBe(rows);
  });
});
