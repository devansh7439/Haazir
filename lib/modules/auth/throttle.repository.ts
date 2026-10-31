import "server-only";
import { one, q } from "@/lib/core/db";

/** Failed sign-ins (`login_failures`), keyed by `ip:<address>` or `email:<address>`. */
export const ThrottleRepository = {
  /** The most failures any one of `keys` has had since `since`. */
  maxFailuresSince: async (keys: string[], since: Date): Promise<number> => {
    const row = await one<{ n: number }>(
      `select max(c)::int as n from (select count(*) as c from login_failures where key = any($1::text[]) and at > $2 group by key) x`,
      [keys, since],
    );
    return row?.n ?? 0;
  },

  record: async (keys: string[], at: Date): Promise<void> => {
    for (const key of keys) await q(`insert into login_failures (key, at) values ($1, $2)`, [key, at]);
  },

  deleteBefore: async (at: Date): Promise<void> => {
    await q(`delete from login_failures where at < $1`, [at]);
  },

  clear: async (keys: string[]): Promise<void> => {
    await q(`delete from login_failures where key = any($1::text[])`, [keys]);
  },
};
