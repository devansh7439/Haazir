// All timestamps the app writes come from here (never SQL now()), so tests can drive time.
let current: () => Date = () => new Date();

/** The current time. Everything the app writes uses this, never SQL `now()`, so tests can drive time. */
export function now(): Date {
  return current();
}

/** Replaces the clock with `fn`; null restores the real one. For tests. */
export function setClock(fn: (() => Date) | null): void {
  current = fn ?? (() => new Date());
}

/** Seconds from `from` to `to` (now by default). Infinity when `from` is missing, so a missing time always looks old. */
export function secondsBetween(from: Date | string | null | undefined, to: Date = now()): number {
  if (!from) return Infinity;
  return (to.getTime() - new Date(from).getTime()) / 1000;
}

/** A new date `minutes` after `d`. */
export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}
