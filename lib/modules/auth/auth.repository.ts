import "server-only";
import { one, q } from "@/lib/core/db";
import type { Referrer, Role } from "@/lib/core/types";

export type { Role };

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

/** The columns of a console user that is being created. */
export interface NewUserRow {
  org_id: string;
  email: string;
  name: string;
  password_hash: string;
  role: Role;
  referrer_id: string | null;
}

/** Console users (`app_users`, AUTH_MODE=users). */
export const AuthRepository = {
  /** The user with this email, or null. */
  byEmail: (email: string): Promise<UserRow | null> =>
    one<UserRow>(`select id, org_id, role, referrer_id, name, email, password_hash, active from app_users where email = $1`, [email]),

  /** Stamps the user's last sign-in. */
  touchLastLogin: async (id: string, at: Date): Promise<void> => {
    await q(`update app_users set last_login_at = $2 where id = $1`, [id, at]);
  },

  /** What a session may still do: read on every request, so a deactivated user loses access at once. */
  access: (id: string): Promise<{ active: boolean; org_id: string; role: Role; referrer_id: string | null } | null> =>
    one(`select active, org_id, role, referrer_id from app_users where id = $1`, [id]),

  /** The organisation with this name, created when there is none. */
  organisationByName: async (name: string): Promise<string> => {
    const existing = await one<{ id: string }>(`select id from organisations where name = $1`, [name]);
    if (existing) return existing.id;
    const created = await one<{ id: string }>(`insert into organisations (name) values ($1) returning id`, [name]);
    return created!.id;
  },

  /** A referring doctor record, which a console user can be tied to. */
  insertReferrer: async (r: { name: string; phone_e164: string; facility_id: string | null; org_id: string }): Promise<string> => {
    const row = await one<{ id: string }>(
      `insert into referrers (name, phone_e164, facility_id, org_id) values ($1, $2, $3, $4) returning id`,
      [r.name, r.phone_e164, r.facility_id, r.org_id],
    );
    return row!.id;
  },

  /** A referring doctor, or null. */
  referrer: (id: string): Promise<Referrer | null> => one<Referrer>(`select * from referrers where id = $1`, [id]),

  /** The organisation's referring doctors, oldest first, for the admin who verifies them. */
  referrers: (orgId: string): Promise<Referrer[]> =>
    q<Referrer>(`select * from referrers where org_id = $1 order by created_at, id`, [orgId]),

  /** Stores a registration and puts the doctor back to "pending" (a changed number is checked again). */
  setRegistration: (id: string, no: string, council: string): Promise<Referrer | null> =>
    one<Referrer>(
      `update referrers set registration_no = $2, registration_council = $3, verification_status = 'pending',
         verified_at = null, verified_by = null where id = $1 returning *`,
      [id, no, council],
    ),

  /**
   * The admin's decision. Only a doctor with a registration on file can be decided on, so "verified" always refers to a
   * number somebody looked at. Null when there is none.
   */
  setVerification: (id: string, status: "verified" | "rejected", by: string | null, at: Date): Promise<Referrer | null> =>
    one<Referrer>(
      `update referrers set verification_status = $2, verified_at = $3, verified_by = $4
       where id = $1 and registration_no is not null returning *`,
      [id, status, at, by],
    ),

  /** Creates the user, or updates the one with this email (new password and role, reactivated). Returns the id. */
  upsertUser: async (u: NewUserRow): Promise<string> => {
    const row = await one<{ id: string }>(
      `insert into app_users (org_id, email, name, password_hash, role, referrer_id) values ($1, $2, $3, $4, $5, $6)
       on conflict (email) do update set name = excluded.name, password_hash = excluded.password_hash, role = excluded.role,
         referrer_id = coalesce(excluded.referrer_id, app_users.referrer_id), active = true
       returning id`,
      [u.org_id, u.email, u.name, u.password_hash, u.role, u.referrer_id],
    );
    return row!.id;
  },
};
