import "server-only";
import { now } from "@/lib/core/clock";
import { ThrottleRepository } from "@/lib/modules/auth/throttle.repository";

/** Failures per IP or account within WINDOW_MIN before sign-in is refused. */
export const LIMIT = 5;
export const WINDOW_MIN = 10;
/** Failures are kept this long, so the table stays small. */
const KEEP_MS = 24 * 3600_000;

/**
 * Sign-in throttling: after LIMIT failures for an IP or an account within WINDOW_MIN minutes, further attempts are
 * refused (even correct ones) until the window passes. Stops passcode and password guessing.
 */
export const ThrottleService = {
  isThrottled: async (keys: string[]): Promise<boolean> =>
    (await ThrottleRepository.maxFailuresSince(keys, new Date(now().getTime() - WINDOW_MIN * 60_000))) >= LIMIT,

  recordFailure: async (keys: string[]): Promise<void> => {
    await ThrottleRepository.record(keys, now());
    await ThrottleRepository.deleteBefore(new Date(now().getTime() - KEEP_MS));
  },

  clearFailures: (keys: string[]): Promise<void> => ThrottleRepository.clear(keys),
};
