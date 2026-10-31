import "server-only";
import { now } from "@/lib/core/clock";
import { one, q } from "@/lib/core/db";

/** Server-only key–value settings (`app_settings`, migration 0002): demo phone numbers, the last purge time. */
export const SettingRepository = {
  /** The value, or null when the key was never set. */
  get: async (key: string): Promise<string | null> => {
    const row = await one<{ value: string | null }>(`select value from app_settings where key = $1`, [key]);
    return row?.value ?? null;
  },

  set: async (key: string, value: string | null): Promise<void> => {
    await q(
      `insert into app_settings (key, value, updated_at) values ($1, $2, $3)
       on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
      [key, value, now()],
    );
  },
};
