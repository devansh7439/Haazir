// Creates a console user for AUTH_MODE=users (and the organisation, and optionally their referrer record).
//   DATABASE_URL=… bun run user:create -- --email dr.rao@example.org --name "Dr. Meera Rao" --password '…' \
//     [--org "Hoskote PHC network" | --org-id <uuid>] [--role admin|doctor] [--referrer-phone +91… --facility-id <uuid>]
// Without --org/--org-id the user joins the demo organisation. The work itself is AuthService.createUser.
import { connect, setDb } from "../lib/core/db";
import { normalizePhone } from "../lib/core/normalize";
import { AuthService } from "../lib/modules/auth/auth.service";

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
  if (role !== "admin" && role !== "doctor") throw new Error("--role must be admin or doctor");

  const phone = arg("referrer-phone");
  const e164 = phone ? normalizePhone(phone) : null;
  if (phone && !e164) throw new Error("--referrer-phone is not a valid number");

  const db = await connect(url);
  setDb(db);
  const created = await AuthService.createUser({
    email,
    name,
    password,
    role,
    orgId: arg("org-id"),
    orgName: arg("org"),
    referrer: e164 ? { phone_e164: e164, facility_id: arg("facility-id") ?? null } : undefined,
  });
  console.log(
    `User ${email} (${role}) → organisation ${created.orgId}${created.referrerId ? `, referrer ${created.referrerId}` : ""}. id ${created.id}`,
  );
  await db.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
