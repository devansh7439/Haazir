import "server-only";
import { one, q } from "@/lib/core/db";

export type Role = "admin" | "doctor";

/** A console user as sign-in needs it. */
export interface UserRow {
  id: string;
  org_id: string;
  role: Role;
  referrer_id: string | null;
  name: string;
  email: string;
  password_hash: string;
  active: boolean;
}

/** Console users (`app_users`, AUTH_MODE=users). */
export const AuthRepository = {
  byEmail: (email: string): Promise<UserRow | null> =>
    one<UserRow>(`select id, org_id, role, referrer_id, name, email, password_hash, active from app_users where email = $1`, [email]),

  touchLastLogin: async (id: string, at: Date): Promise<void> => {
    await q(`update app_users set last_login_at = $2 where id = $1`, [id, at]);
  },

  /** What a session may still do: read on every request, so a deactivated user loses access at once. */
  access: (id: string): Promise<{ active: boolean; org_id: string; role: Role; referrer_id: string | null } | null> =>
    one(`select active, org_id, role, referrer_id from app_users where id = $1`, [id]),
};
