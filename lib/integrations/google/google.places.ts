import "server-only";
import { z } from "zod";
import { env } from "@/lib/core/config";

// Google Places API (New): a hospital's star rating. Written without access to a Google key: test it before relying on
// it (CLAUDE.md, "Unverified against live services"). Google's terms keep only the place id; ratings are fetched live.
// Transport only: deciding whether a hit is the hospital, caching and logging are in RatingService.

const BASE = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 6000;

/** A hospital's rating as Google shows it. */
export interface GoogleRating {
  /** 1 to 5, to one decimal as Google gives it. */
  rating: number;
  count: number;
  /** The place on Google Maps, where the reviews are. */
  url: string | null;
}

/** The top text-search hit: a place id and, when Google gives one, its location. */
export interface PlaceHit {
  id: string;
  location: { lat: number; lng: number } | null;
}

const DetailsSchema = z.object({
  rating: z.number().min(0).max(5).optional(),
  userRatingCount: z.number().int().min(0).optional(),
  googleMapsUri: z.string().optional(),
});

const SearchSchema = z.object({
  places: z.array(z.object({ id: z.string(), location: z.object({ latitude: z.number(), longitude: z.number() }).optional() })).default([]),
});

const headers = (fieldMask: string) => ({
  "Content-Type": "application/json",
  "X-Goog-Api-Key": env.googlePlacesKey,
  "X-Goog-FieldMask": fieldMask,
});

/** The rating of a place; null when Google has none. Throws when the request fails or times out. */
export async function fetchRating(placeId: string): Promise<GoogleRating | null> {
  const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
    headers: headers("rating,userRatingCount,googleMapsUri"),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Google place details returned ${res.status}`);
  const d = DetailsSchema.safeParse(await res.json());
  if (!d.success || d.data.rating === undefined) return null;
  return { rating: d.data.rating, count: d.data.userRatingCount ?? 0, url: d.data.googleMapsUri ?? null };
}

/** Where we have a hospital listed: what a Google text search is made from. */
export interface PlaceQuery {
  name: string;
  city: string | null;
  lat: number;
  lng: number;
}

/** The top text-search hit for a hospital, biased to `radiusM` around where we have it; null when there is none. Throws on failure. */
export async function searchPlace(h: PlaceQuery, radiusM: number): Promise<PlaceHit | null> {
  const res = await fetch(`${BASE}/places:searchText`, {
    method: "POST",
    headers: headers("places.id,places.location"),
    body: JSON.stringify({
      textQuery: [h.name, h.city].filter(Boolean).join(", "),
      maxResultCount: 1,
      locationBias: { circle: { center: { latitude: h.lat, longitude: h.lng }, radius: radiusM } },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Google place search returned ${res.status}`);
  const parsed = SearchSchema.safeParse(await res.json());
  const hit = parsed.success ? parsed.data.places[0] : undefined;
  if (!hit) return null;
  return { id: hit.id, location: hit.location ? { lat: hit.location.latitude, lng: hit.location.longitude } : null };
}
