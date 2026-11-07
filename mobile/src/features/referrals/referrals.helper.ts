import type { ReferralListItem } from '../../api/schema';

/** The statuses of a referral that is still being worked on: hospitals are being called, or a bed is being or has been held. */
const IN_PROGRESS = ['searching', 'options_ready', 'confirming', 'confirmed'];

/** Whether a referral is still in progress. */
export const isInProgress = (referral: Pick<ReferralListItem, 'status'>): boolean => IN_PROGRESS.includes(referral.status);

/** The referrals in progress first and the earlier ones after, each keeping the order the server gave (newest first). */
export function inProgressFirst<T extends Pick<ReferralListItem, 'status'>>(referrals: readonly T[]): T[] {
  return [...referrals.filter(isInProgress), ...referrals.filter((r) => !isInProgress(r))];
}

/** The newest referral in progress, or null when none is. */
export const newestInProgress = <T extends Pick<ReferralListItem, 'status'>>(referrals: readonly T[]): T | null =>
  referrals.find(isInProgress) ?? null;
