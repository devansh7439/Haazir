// Applies any supabase/migrations/* not yet applied to DATABASE_URL, then the seed (idempotent).
//   npm run db:setup            → migrations + seed
//   npm run db:setup -- --no-seed
// Works for Supabase (direct or session-pooler connection string), local Postgres, or pglite:<dir>.
import { connect, migrate } from "../lib/core/db";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (see .env.example)");
  const db = await connect(url); // a pglite: URL migrates on connect
  const ran = await migrate(db, { seed: !process.argv.includes("--no-seed") });
  console.log(ran.length ? `Applied ${ran.join(", ")}` : "Schema already up to date.");
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from facilities");
  console.log(`Done. ${n} facilities.`);
  await db.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
