// Client-safe helpers for showing a star rating.

/** How much of each of five stars to fill, 0 to 1, for a rating from 0 to 5. Quarter stars, so 4.3 shows as 4.25. */
export function starFills(rating: number): number[] {
  const r = Math.min(5, Math.max(0, rating));
  const quarter = Math.round(r * 4) / 4;
  return [0, 1, 2, 3, 4].map((i) => Math.min(1, Math.max(0, quarter - i)));
}

/** A review count for a small label: 812 stays 812, 1240 becomes 1.2k. */
export function shortCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n);
}
