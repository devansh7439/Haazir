import "server-only";
import { now } from "@/lib/core/clock";
import { env } from "@/lib/core/config";
import { findPlaceId, fetchRating, type GoogleRating } from "@/lib/integrations/google/google.places";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";

/** How long a rating is kept in memory. Google's terms don't allow storing it, so it is never written to the database. */
const TTL_MS = 60 * 60 * 1000;
/** At most this many Google requests at once, so one page load can't flood the API. */
const BATCH = 5;

const ratings = new Map<string, { at: number; value: GoogleRating | null }>();
/** Hospitals we looked for on Google and didn't find, so every page load doesn't search again. */
const unmatched = new Map<string, number>();

const fresh = (at: number): boolean => now().getTime() - at < TTL_MS;

const ratingOf = async (placeId: string): Promise<GoogleRating | null> => {
  const hit = ratings.get(placeId);
  if (hit && fresh(hit.at)) return hit.value;
  const value = await fetchRating(placeId);
  ratings.set(placeId, { at: now().getTime(), value });
  return value;
};

/** Forgets everything held in memory. For tests. */
export const resetRatingCache = (): void => {
  ratings.clear();
  unmatched.clear();
};

/** Google star ratings for the hospitals page. Off, and empty, until GOOGLE_PLACES_API_KEY is set. */
export const RatingService = {
  /**
   * Ratings by hospital id for the organisation's real hospitals (the fictional demo ones have no Google listing). A
   * hospital is matched to its Google place once, by name and location, and only the place id is stored.
   */
  forOrg: async (orgId: string): Promise<{ enabled: boolean; ratings: Record<string, GoogleRating> }> => {
    if (!env.googlePlacesKey) return { enabled: false, ratings: {} };
    const hospitals = (await FacilityRepository.listForOrg(orgId)).filter((f) => !f.is_demo);
    const out: Record<string, GoogleRating> = {};
    for (let i = 0; i < hospitals.length; i += BATCH) {
      await Promise.all(
        hospitals.slice(i, i + BATCH).map(async (f) => {
          let placeId = f.google_place_id;
          if (!placeId) {
            const tried = unmatched.get(f.id);
            if (tried !== undefined && fresh(tried)) return;
            placeId = await findPlaceId(f);
            if (!placeId) return void unmatched.set(f.id, now().getTime());
            await FacilityRepository.setGooglePlaceId(f.id, placeId);
          }
          const r = await ratingOf(placeId);
          if (r) out[f.id] = r;
        }),
      );
    }
    return { enabled: true, ratings: out };
  },
};
