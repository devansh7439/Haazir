import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/core/db";
import { setDb } from "@/lib/core/db";
import { DEFAULT_ORG_ID } from "@/lib/core/types";
import { distanceMetres } from "@/lib/integrations/google/google.places";
import { DirectoryService } from "@/lib/modules/facility/directory.service";
import { RatingService, resetRatingCache } from "@/lib/modules/facility/rating.service";
import { shortCount, starFills } from "@/lib/ui/rating";
import { freshDb } from "./helpers";

describe("star rating helpers", () => {
  it("fills five stars in quarters", () => {
    expect(starFills(4.3)).toEqual([1, 1, 1, 1, 0.25]);
    expect(starFills(3.5)).toEqual([1, 1, 1, 0.5, 0]);
    expect(starFills(0)).toEqual([0, 0, 0, 0, 0]);
    expect(starFills(9)).toEqual([1, 1, 1, 1, 1]);
    expect(starFills(-1)).toEqual([0, 0, 0, 0, 0]);
  });

  it("shortens review counts", () => {
    expect([shortCount(812), shortCount(1240), shortCount(1000), shortCount(15_300)]).toEqual(["812", "1.2k", "1k", "15k"]);
  });

  it("measures the distance between two points", () => {
    expect(Math.round(distanceMetres({ lat: 13.07, lng: 77.8 }, { lat: 13.07, lng: 77.8 }))).toBe(0);
    const d = distanceMetres({ lat: 13.07, lng: 77.8 }, { lat: 13.08, lng: 77.8 });
    expect(d).toBeGreaterThan(1100);
    expect(d).toBeLessThan(1120);
  });
});

describe("RatingService", () => {
  let db: Db;
  const HOSPITAL = { name: "Lotus Care Hospital", lat: 13.07, lng: 77.8 };
  const listing = () => ({
    name: HOSPITAL.name, kind: "private_hospital", ownership: "private", address: null, city: "Hoskote", district: null,
    lat: HOSPITAL.lat, lng: HOSPITAL.lng, call_language: "en", whatsapp_number: null, capabilities: [], contacts: [],
  });
  let searchHit: { id: string; location: { latitude: number; longitude: number } } | null;
  const fetchMock = vi.fn(async (url: string) => {
    if (url.endsWith("places:searchText")) return Response.json({ places: searchHit ? [searchHit] : [] });
    return Response.json({ rating: 4.3, userRatingCount: 812, googleMapsUri: "https://maps.google.com/?cid=1" });
  });

  beforeEach(async () => {
    db = await freshDb();
    resetRatingCache();
    fetchMock.mockClear();
    searchHit = { id: "place-1", location: { latitude: 13.0702, longitude: 77.8001 } };
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "test-key");
  });
  afterEach(async () => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    setDb(null);
    await db.close();
  });

  it("is off, and asks Google nothing, without a key", async () => {
    vi.stubEnv("GOOGLE_PLACES_API_KEY", "");
    expect(await RatingService.forOrg(DEFAULT_ORG_ID)).toEqual({ enabled: false, ratings: {} });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("matches a real hospital once, stores only the place id, and returns its rating", async () => {
    const f = await DirectoryService.create(DEFAULT_ORG_ID, listing());
    const out = await RatingService.forOrg(DEFAULT_ORG_ID);
    expect(out.ratings[f.id]).toEqual({ rating: 4.3, count: 812, url: "https://maps.google.com/?cid=1" });
    const [row] = await db.query<{ google_place_id: string | null }>(`select google_place_id from facilities where id = $1`, [f.id]);
    expect(row.google_place_id).toBe("place-1");
    // The fictional demo hospitals have no Google listing and are never looked up.
    expect(Object.keys(out.ratings)).toEqual([f.id]);
    expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith("places:searchText"))).toHaveLength(1);
  });

  it("serves a repeat from memory instead of asking Google again", async () => {
    await DirectoryService.create(DEFAULT_ORG_ID, listing());
    await RatingService.forOrg(DEFAULT_ORG_ID);
    const calls = fetchMock.mock.calls.length;
    await RatingService.forOrg(DEFAULT_ORG_ID);
    expect(fetchMock.mock.calls.length).toBe(calls);
  });

  it("ignores a search hit that is far from the hospital's listed location", async () => {
    searchHit = { id: "elsewhere", location: { latitude: 12.97, longitude: 77.59 } };
    const f = await DirectoryService.create(DEFAULT_ORG_ID, listing());
    const out = await RatingService.forOrg(DEFAULT_ORG_ID);
    expect(out.ratings[f.id]).toBeUndefined();
    const [row] = await db.query<{ google_place_id: string | null }>(`select google_place_id from facilities where id = $1`, [f.id]);
    expect(row.google_place_id).toBeNull();
    // Not found counts as an answer for a while: no second search on the next load.
    const searches = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith("places:searchText")).length;
    await RatingService.forOrg(DEFAULT_ORG_ID);
    expect(searches()).toBe(1);
  });

  it("shows no rating when Google has none or the request fails", async () => {
    await DirectoryService.create(DEFAULT_ORG_ID, listing());
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith("places:searchText") ? Response.json({ places: [searchHit] }) : new Response("nope", { status: 403 }),
    );
    expect((await RatingService.forOrg(DEFAULT_ORG_ID)).ratings).toEqual({});
  });
});
