// Copied from lib/ui/rating.ts (only the part the app uses).

/** A review count for a small label: 812 stays 812, 1240 becomes 1.2k. */
export function shortCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n);
}
