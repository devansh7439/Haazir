import "server-only";
import { AnalyticsRepository } from "@/lib/modules/analytics/analytics.repository";
import type { HospitalStat, HourStat, ProofStats } from "@/lib/modules/analytics/analytics.type";

/** Acceptance analytics per hospital and per hour of day (C5). */
export const AnalyticsService = {
  hospitalStats: async (orgId: string): Promise<HospitalStat[]> =>
    (await AnalyticsRepository.hospitals(orgId)).map((r) => ({
      ...r,
      last_called_at: r.last_called_at ? new Date(r.last_called_at).toISOString() : null,
    })),

  /** The proof slide's figures; sums that Postgres returns as text become numbers. */
  proofStats: async (orgId: string, realOnly: boolean): Promise<ProofStats> => {
    const p = await AnalyticsRepository.proof(orgId, realOnly);
    return { ...p, total_cost: p.total_cost === null ? null : Number(p.total_cost) };
  },

  /** All 24 hours, India time; an hour with no calls has zeros. */
  hourStats: async (orgId: string): Promise<HourStat[]> => {
    const byHour = new Map((await AnalyticsRepository.hours(orgId)).map((r) => [r.hour, r]));
    return Array.from({ length: 24 }, (_, hour) => byHour.get(hour) ?? { hour, calls: 0, answered: 0, accepted: 0 });
  },
};
