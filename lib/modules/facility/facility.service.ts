import "server-only";
import type { Capability } from "@/lib/core/types";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import type { MatchParams } from "@/lib/modules/facility/facility.type";
import { rankFacilities, type RankedFacility } from "@/lib/modules/facility/matching.helper";

/** The radius the "widen the search" suggestion offers. */
const WIDE_RADIUS_KM = 80;

/** Matching hospitals to a case (docs/02-architecture.md §7). */
export const FacilityService = {
  /** Eligible hospitals, ranked, each with the number to call. Empty when none qualify. */
  rankEligible: async (params: MatchParams, needLabels: string[]): Promise<RankedFacility[]> => {
    const rows = await FacilityRepository.eligible(params);
    if (rows.length === 0) return [];
    const contacts = await FacilityRepository.contactsByFacility(rows.map((r) => r.id));
    return rankFacilities(rows, contacts, needLabels);
  },

  /** When nobody qualifies: which change would find a hospital ("widen radius to 80 km", "remove: ventilator"). */
  suggestionsFor: async (params: MatchParams, needs: Capability[]): Promise<string[]> => {
    const out: string[] = [];
    if (params.radius_km < WIDE_RADIUS_KM && (await FacilityService.rankEligible({ ...params, radius_km: WIDE_RADIUS_KM }, [])).length > 0) {
      out.push(`widen radius to ${WIDE_RADIUS_KM} km`);
    }
    for (const n of needs) {
      const rest = params.needs.filter((c) => c !== n.code);
      if ((await FacilityService.rankEligible({ ...params, needs: rest }, [])).length > 0) out.push(`remove: ${n.code}`);
    }
    return out;
  },
};
