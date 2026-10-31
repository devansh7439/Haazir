import "server-only";
import { now } from "@/lib/core/clock";
import { env } from "@/lib/core/config";
import { createLogger } from "@/lib/core/logger";
import type { Facility } from "@/lib/core/types";
import { fetchRating, searchPlace, type GoogleRating } from "@/lib/integrations/google/google.places";
import { FacilityRepository } from "@/lib/modules/facility/facility.repository";
import { MATCH_RADIUS_M, isFresh, isSamePlace } from "@/lib/modules/facility/rating.helper";

const log = createLogger("ratings");

/** At most this many Google requests at once, so one page load can't flood the API. */
const BATCH = 5;

/** Ratings by place id, in memory only: Google's terms don't allow storing them. */
const ratings = new Map<string, { at: number; value: GoogleRating | null }>();
/** Hospitals we looked for on Google and didn't find, so every page load doesn't search again. */
const unmatched = new Map<string, number>();

/** Runs a Google request; null when it fails, with the cause logged. A rating is a nice-to-have, never an error for the page. */
const orNull = async <T>(what: string, facilityId: string, request: () => Promise<T>): Promise<T | null> => {
  try {
    return await request();
  } catch (err) {
    log.warn({ err, facility_id: facilityId }, what);
    return null;
  }
};

/** A place's rating, from memory while fresh. Null when Google has none or the lookup failed; either is remembered for a while. */
const ratingOf = async (placeId: string, facilityId: string): Promise<GoogleRating | null> => {
  const known = ratings.get(placeId);
  if (known && isFresh(known.at, now())) return known.value;
  const value = await orNull("Google rating lookup failed", facilityId, () => fetchRating(placeId));
  ratings.set(placeId, { at: now().getTime(), value });
  return value;
};

/**
 * The hospital's Google place id. Found once by name and location, then stored. Null when no hit is near enough or the
 * search failed; either is remembered for a while, so a hospital that isn't on Google isn't searched on every page load.
 */
const placeIdOf = async (f: Facility): Promise<string | null> => {
  if (f.google_place_id) return f.google_place_id;
  const tried = unmatched.get(f.id);
  if (tried !== undefined && isFresh(tried, now())) return null;
  const hit = await orNull("Google place search failed", f.id, () => searchPlace(f, MATCH_RADIUS_M));
  if (!hit || !isSamePlace(f, hit.location)) {
    unmatched.set(f.id, now().getTime());
    return null;
  }
  await FacilityRepository.setGooglePlaceId(f.id, hit.id);
  return hit.id;
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
          const placeId = await placeIdOf(f);
          const rating = placeId ? await ratingOf(placeId, f.id) : null;
          if (rating) out[f.id] = rating;
        }),
      );
    }
    return { enabled: true, ratings: out };
  },
};
