/** Where and what to search: the origin, the radius, the capabilities every hospital must have, and whose directory. */
export interface MatchParams {
  lat: number;
  lng: number;
  radius_km: number;
  needs: string[];
  origin_id: string | null;
  org_id: string;
}
