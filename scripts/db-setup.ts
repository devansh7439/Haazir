// Applies any supabase/migrations/* not yet applied to DATABASE_URL, then the seed (idempotent).
//   npm run db:setup            → migrations + seed
//   npm run db:setup -- --no-seed
//   npm run db:setup -- --demo   → also loads the fictional demo directory (supabase/demo-directory.sql)
// Works for Supabase (direct or session-pooler connection string), local Postgres, or pglite:<dir>.
import { readFileSync } from "node:fs";
import path from "node:path";
import { connect, migrate, setDb } from "../lib/core/db";
import { FacilityRepository } from "../lib/modules/facility/facility.repository";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL (see .env.example)");
  const db = await connect(url); // a pglite: URL migrates on connect
  const ran = await migrate(db, { seed: !process.argv.includes("--no-seed") });
  console.log(ran.length ? `Applied ${ran.join(", ")}` : "Schema already up to date.");
  if (process.argv.includes("--demo")) {
    await db.exec(readFileSync(path.join(process.cwd(), "supabase/demo-directory.sql"), "utf8"));
    console.log("Loaded the demo directory.");
  }
  setDb(db);
  console.log(`Done. ${await FacilityRepository.count()} facilities.`);
  await db.close();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
