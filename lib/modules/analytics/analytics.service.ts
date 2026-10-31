import "server-only";
import { AnalyticsRepository } from "@/lib/modules/analytics/analytics.repository";
import type { HospitalStat, HourStat } from "@/lib/modules/analytics/analytics.type";

/** Acceptance analytics per hospital and per hour of day (C5). */
export const AnalyticsService = {
  hospitalStats: async (orgId: string, includeSimulated: boolean): Promise<HospitalStat[]> =>
    (await AnalyticsRepository.hospitals(orgId, includeSimulated)).map((r) => ({
      ...r,
      last_called_at: r.last_called_at ? new Date(r.last_called_at).toISOString() : null,
    })),

  /** All 24 hours, India time; an hour with no calls has zeros. */
  hourStats: async (orgId: string, includeSimulated: boolean): Promise<HourStat[]> => {
    const byHour = new Map((await AnalyticsRepository.hours(orgId, includeSimulated)).map((r) => [r.hour, r]));
    return Array.from({ length: 24 }, (_, hour) => byHour.get(hour) ?? { hour, calls: 0, answered: 0, accepted: 0 });
  },
};
