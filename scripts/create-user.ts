// Creates a console user for AUTH_MODE=users (and the organisation, and optionally their referrer record).
//   DATABASE_URL=… npm run user:create -- --email dr.rao@example.org --name "Dr. Meera Rao" --password '…' \
//     [--org "Hoskote PHC network" | --org-id <uuid>] [--role admin|doctor] [--referrer-phone +91… --facility-id <uuid>]
// Without --org/--org-id the user joins the demo organisation.
import { connect } from "../lib/core/db";
import { hashPassword } from "../lib/password";
import { normalizePhone } from "../lib/core/normalize";
import { DEFAULT_ORG_ID } from "../lib/core/types";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL");
  const email = arg("email")?.trim().toLowerCase();
  const name = arg("name");
  const password = arg("password");
  const role = arg("role") ?? "doctor";
  if (!email || !name || !password) throw new Error("--email, --name and --password are required");
  if (!["admin", "doctor"].includes(role)) throw new Error("--role must be admin or doctor");
  const db = await connect(url);

  let orgId = arg("org-id") ?? DEFAULT_ORG_ID;
  const orgName = arg("org");
  if (orgName) {
    const existing = await db.query<{ id: string }>(`select id from organisations where name = $1`, [orgName]);
    orgId = existing[0]?.id ?? (await db.query<{ id: string }>(`insert into organisations (name) values ($1) returning id`, [orgName]))[0].id;
  }

  let referrerId: string | null = null;
  const phone = arg("referrer-phone");
  if (phone) {
    const e164 = normalizePhone(phone);
    if (!e164) throw new Error("--referrer-phone is not a valid number");
    const [r] = await db.query<{ id: string }>(
      `insert into referrers (name, phone_e164, facility_id, org_id) values ($1, $2, $3, $4) returning id`,
      [name, e164, arg("facility-id") ?? null, orgId],
    );
    referrerId = r.id;
  }

  const [u] = await db.query<{ id: string }>(
    `insert into app_users (org_id, email, name, password_hash, role, referrer_id) values ($1, $2, $3, $4, $5, $6)
     on conflict (email) do update set name = excluded.name, password_hash = excluded.password_hash, role = excluded.role,
       referrer_id = coalesce(excluded.referrer_id, app_users.referrer_id), active = true
     returning id`,
    [orgId, email, name, await hashPassword(password), role, referrerId],
  );
  console.log(`User ${email} (${role}) → organisation ${orgId}${referrerId ? `, referrer ${referrerId}` : ""}. id ${u.id}`);
  await db.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
