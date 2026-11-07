// How recently a hospital's number reached a person. A number nobody has answered for a while is the likeliest reason
// the right hospital is never reached at 2 a.m., so the directory shows it. Pure; used by the browser too.

/** A verified number goes stale when no call has been answered on it for this long. */
export const CONTACT_STALE_AFTER_DAYS = 30;

export type ContactFreshness = "fresh" | "stale" | "unverified";

const DAY_MS = 24 * 3600_000;

/** "unverified" when never confirmed, "stale" when the last confirmation is older than the limit. */
export function contactFreshness(verifiedAt: string | Date | null, nowMs: number): ContactFreshness {
  if (!verifiedAt) return "unverified";
  return nowMs - new Date(verifiedAt).getTime() > CONTACT_STALE_AFTER_DAYS * DAY_MS ? "stale" : "fresh";
}
