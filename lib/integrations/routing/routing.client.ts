import "server-only";
import { z } from "zod";
import { now } from "@/lib/core/clock";
import { env } from "@/lib/core/config";
import { createLogger } from "@/lib/core/logger";

// Road drive times from an OSRM-compatible server (the `table` service). Written without access to a live server: test it
// before relying on it (CLAUDE.md, "Unverified against live services"). The public demo server is for tests only; run your
// own for real use. Times are free-flow road times, not traffic, and say nothing about when an ambulance can leave.

const log = createLogger("routing");
const TIMEOUT_MS = 3000;
/** The form asks for a preview on every change; the same origin and hospital are not routed twice within this time. */
const CACHE_MS = 10 * 60 * 1000;

const TableAnswer = z.object({ code: z.string(), durations: z.array(z.array(z.number().nullable())).min(1) });

export interface Point {
  lat: number;
  lng: number;
}

const cache = new Map<string, { minutes: number | null; at: number }>();
const key = (p: Point) => `${p.lng.toFixed(5)},${p.lat.toFixed(5)}`;

/**
 * Minutes of road driving from `from` to each of `to`, rounded up. A destination the server cannot route to is null.
 * Null overall when routing is off or the server fails, so the caller keeps its straight-line estimate.
 */
export async function roadMinutes(from: Point, to: Point[]): Promise<Array<number | null> | null> {
  const base = env.routingBaseUrl;
  if (!base || to.length === 0) return null;
  const t = now().getTime();
  const cached = to.map((p) => cache.get(`${key(from)}>${key(p)}`));
  const fresh = (c: (typeof cached)[number]) => !!c && t - c.at < CACHE_MS;
  const missing = to.filter((_, i) => !fresh(cached[i]));
  if (missing.length > 0) {
    try {
      const coords = [from, ...missing].map(key).join(";");
      const res = await fetch(`${base.replace(/\/+$/, "")}/table/v1/driving/${coords}?sources=0&annotations=duration`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const parsed = TableAnswer.safeParse(await res.json());
      if (!parsed.success || parsed.data.code !== "Ok") throw new Error("unexpected answer");
      const row = parsed.data.durations[0];
      missing.forEach((p, i) => {
        const seconds = row[i + 1];
        cache.set(`${key(from)}>${key(p)}`, { minutes: typeof seconds === "number" ? Math.ceil(seconds / 60) : null, at: t });
      });
    } catch (err) {
      // The caller falls back to the straight-line estimate; never block a referral on routing.
      log.warn({ error: err instanceof Error ? err.message : String(err) }, "routing failed");
      return null;
    }
  }
  return to.map((p) => cache.get(`${key(from)}>${key(p)}`)?.minutes ?? null);
}

/** Forgets every cached drive time. */
export const clearRoutingCache = (): void => cache.clear();
