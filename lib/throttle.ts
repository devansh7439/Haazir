import "server-only";
import { now } from "./clock";
import { one, q } from "./db";

// Sign-in throttling: after LIMIT failures for an IP or an account within WINDOW_MIN minutes, refuse further
// attempts (even correct ones) until the window passes. Stops passcode and password guessing.
export const LIMIT = 5;
export const WINDOW_MIN = 10;

export async function isThrottled(keys: string[]): Promise<boolean> {
  const since = new Date(now().getTime() - WINDOW_MIN * 60_000);
  const row = await one<{ n: number }>(
    `select max(c)::int as n from (select count(*) as c from login_failures where key = any($1::text[]) and at > $2 group by key) x`,
    [keys, since],
  );
  return (row?.n ?? 0) >= LIMIT;
}

export async function recordFailure(keys: string[]): Promise<void> {
  for (const key of keys) await q(`insert into login_failures (key, at) values ($1, $2)`, [key, now()]);
  // Keep the table small.
  await q(`delete from login_failures where at < $1`, [new Date(now().getTime() - 24 * 3600_000)]);
}

export async function clearFailures(keys: string[]): Promise<void> {
  await q(`delete from login_failures where key = any($1::text[])`, [keys]);
}
