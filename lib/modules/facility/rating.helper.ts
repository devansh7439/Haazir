// Pure rules for Google star ratings: when a remembered answer is still good, and when a search hit is the hospital.

/** How long a rating, or a "not on Google", is remembered. Google's terms don't allow storing a rating. */
export const RATING_TTL_MS = 60 * 60 * 1000;

/** A search hit further than this from the hospital's listed location is a different place. */
export const MATCH_RADIUS_M = 1000;

/** Straight-line distance between two points, in metres. */
export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

/** Whether something remembered at `at` (epoch ms) can still be used at `now`. */
export const isFresh = (at: number, now: Date): boolean => now.getTime() - at < RATING_TTL_MS;

/** Whether a search hit is the listed hospital: within MATCH_RADIUS_M of where we have it. False for a hit with no location. */
export const isSamePlace = (listed: { lat: number; lng: number }, hit: { lat: number; lng: number } | null): boolean =>
  hit !== null && distanceMetres(listed, hit) <= MATCH_RADIUS_M;
