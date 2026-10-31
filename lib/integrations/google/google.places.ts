import "server-only";
import { z } from "zod";
import { env } from "@/lib/core/config";

// Google Places API (New): a hospital's star rating. Written without access to a Google key: test it before relying on
// it (CLAUDE.md, "Unverified against live services"). Google's terms keep only the place id; ratings are fetched live.

const BASE = "https://places.googleapis.com/v1";
const TIMEOUT_MS = 6000;
/** A search result further than this from the hospital's listed location is a different place. */
const MATCH_RADIUS_M = 1000;

/** A hospital's rating as Google shows it. */
export interface GoogleRating {
  /** 1 to 5, to one decimal as Google gives it. */
  rating: number;
  count: number;
  /** The place on Google Maps, where the reviews are. */
  url: string | null;
}

const DetailsSchema = z.object({
  rating: z.number().min(0).max(5).optional(),
  userRatingCount: z.number().int().min(0).optional(),
  googleMapsUri: z.string().optional(),
});

const SearchSchema = z.object({
  places: z.array(z.object({ id: z.string(), location: z.object({ latitude: z.number(), longitude: z.number() }).optional() })).default([]),
});

/** Straight-line distance between two points, in metres. */
export function distanceMetres(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

const headers = (fieldMask: string) => ({
  "Content-Type": "application/json",
  "X-Goog-Api-Key": env.googlePlacesKey,
  "X-Goog-FieldMask": fieldMask,
});

/** The rating of a place; null when Google has none, or when the request fails. Never throws. */
export async function fetchRating(placeId: string): Promise<GoogleRating | null> {
  try {
    const res = await fetch(`${BASE}/places/${encodeURIComponent(placeId)}`, {
      headers: headers("rating,userRatingCount,googleMapsUri"),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const d = DetailsSchema.safeParse(await res.json());
    if (!d.success || d.data.rating === undefined) return null;
    return { rating: d.data.rating, count: d.data.userRatingCount ?? 0, url: d.data.googleMapsUri ?? null };
  } catch {
    return null;
  }
}

/** The Google place for a hospital: the top text-search hit within 1 km of where we have it listed, or null. */
export async function findPlaceId(h: { name: string; city: string | null; lat: number; lng: number }): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/places:searchText`, {
      method: "POST",
      headers: headers("places.id,places.location"),
      body: JSON.stringify({
        textQuery: [h.name, h.city].filter(Boolean).join(", "),
        maxResultCount: 1,
        locationBias: { circle: { center: { latitude: h.lat, longitude: h.lng }, radius: MATCH_RADIUS_M } },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const parsed = SearchSchema.safeParse(await res.json());
    const hit = parsed.success ? parsed.data.places[0] : undefined;
    if (!hit?.location) return null;
    const near = distanceMetres({ lat: h.lat, lng: h.lng }, { lat: hit.location.latitude, lng: hit.location.longitude }) <= MATCH_RADIUS_M;
    return near ? hit.id : null;
  } catch {
    return null;
  }
}
