// Applies supabase/migrations/* (and optionally supabase/seed.sql) to DATABASE_URL.
//   npm run db:setup            → migrations + seed
//   npm run db:setup -- --no-seed
// Works for Supabase (use the direct or session-pooler connection string), local Postgres, or pglite:<dir>.
import { applySchema, connect, migrationFiles } from "../lib/db";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (see .env.example)");
  const seed = !process.argv.includes("--no-seed");
  const db = await connect(url);
  const [{ exists }] = await db.query<{ exists: boolean }>("select to_regclass('public.referrals') is not null as exists");
  if (exists) {
    console.log("Schema already present; applying the seed only (idempotent).");
    if (seed) await db.exec((await import("node:fs")).readFileSync("supabase/seed.sql", "utf8"));
  } else {
    console.log(`Applying ${migrationFiles().join(", ")}${seed ? " + seed" : ""}`);
    await applySchema(db, { seed });
  }
  const [{ n }] = await db.query<{ n: number }>("select count(*)::int as n from facilities");
  console.log(`Done. ${n} facilities.`);
  await db.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
