// All timestamps the app writes come from here (never SQL now()), so tests can drive time.
let current: () => Date = () => new Date();

export function now(): Date {
  return current();
}

export function setClock(fn: (() => Date) | null): void {
  current = fn ?? (() => new Date());
}

export function secondsBetween(from: Date | string | null | undefined, to: Date = now()): number {
  if (!from) return Infinity;
  return (to.getTime() - new Date(from).getTime()) / 1000;
}

export function addMinutes(d: Date, minutes: number): Date {
  return new Date(d.getTime() + minutes * 60_000);
}
