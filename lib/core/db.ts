import "server-only";
import fs from "node:fs";
import path from "node:path";
import { env } from "@/lib/core/config";

// Thin SQL layer. Server routes use raw SQL so the tested queries in docs/03-data-model.md §5
// (eligibility, atomic wave claim) run unchanged. Two drivers:
//   - `pg` for Supabase or any Postgres (DATABASE_URL=postgres://…)
//   - PGlite (embedded Postgres) for tests and zero-setup local dev (DATABASE_URL=pglite:./dir or pglite:memory)

export interface Db {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  close(): Promise<void>;
}

type GlobalWithDb = typeof globalThis & { __haazirDb?: Promise<Db> };
const g = globalThis as GlobalWithDb;

export function setDb(db: Db | null): void {
  g.__haazirDb = db ? Promise.resolve(db) : undefined;
}

export function getDb(): Promise<Db> {
  if (!g.__haazirDb) g.__haazirDb = connect(env.databaseUrl);
  return g.__haazirDb;
}

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  return (await getDb()).query<T>(sql, params);
}

export async function one<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

/** jsonb parameters must be passed as JSON text (pg would turn JS arrays into Postgres array literals). */
export function json(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export async function connect(url: string): Promise<Db> {
  if (url.startsWith("pglite:")) return connectPglite(url.slice("pglite:".length));
  return connectPg(url);
}

async function connectPg(url: string): Promise<Db> {
  const pg = await import("pg");
  const { Pool, types } = pg.default ?? pg;
  types.setTypeParser(1700, (v: string) => parseFloat(v)); // numeric
  types.setTypeParser(20, (v: string) => parseInt(v, 10)); // int8 (count(*))
  const pool = new Pool({
    connectionString: url,
    max: 5,
    ssl: /supabase\.(co|com)/.test(url) ? { rejectUnauthorized: false } : undefined,
  });
  return {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pool.query(sql, params as unknown[]);
      return res.rows as T[];
    },
    async exec(sql: string) {
      await pool.query(sql);
    },
    async close() {
      await pool.end();
    },
  };
}

async function connectPglite(dir: string): Promise<Db> {
  const { PGlite, types } = await import("@electric-sql/pglite");
  const dataDir = dir === "memory" || dir === "" ? undefined : path.resolve(dir);
  if (dataDir) fs.mkdirSync(dataDir, { recursive: true });
  const pglite = new PGlite(dataDir, {
    parsers: {
      [types.NUMERIC]: (v: string) => parseFloat(v),
      [types.INT8]: (v: string) => parseInt(v, 10),
    },
  });
  const db: Db = {
    async query<T>(sql: string, params: unknown[] = []) {
      const res = await pglite.query<T>(sql, params as unknown[]);
      return res.rows;
    },
    async exec(sql: string) {
      await pglite.exec(sql);
    },
    async close() {
      await pglite.close();
    },
  };
  await migrate(db); // creates and seeds an empty embedded database; brings an existing one up to date
  return db;
}

const ROOT = process.cwd();

export function readSql(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

export function migrationFiles(): string[] {
  const dir = path.join(ROOT, "supabase/migrations");
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => `supabase/migrations/${f}`);
}

/**
 * Applies every migration not yet recorded in haazir_migrations, in order. A database created before migrations
 * were tracked is detected from its tables. The seed runs on a fresh database, or when `seed` is true (it is idempotent).
 */
export async function migrate(db: Db, opts: { seed?: boolean } = {}): Promise<string[]> {
  await db.exec(readSql("supabase/local/00_roles.sql"));
  const [{ fresh }] = await db.query<{ fresh: boolean }>("select to_regclass('public.referrals') is null as fresh");
  await db.exec(
    "create table if not exists haazir_migrations (name text primary key, applied_at timestamptz not null default now())",
  );
  // Server-only, like every table: on Supabase the public anon key could otherwise rewrite the migration log.
  await db.exec("alter table haazir_migrations enable row level security");
  let applied = new Set((await db.query<{ name: string }>("select name from haazir_migrations")).map((r) => r.name));
  if (applied.size === 0 && !fresh) {
    // Legacy database: infer what was applied before tracking existed.
    const [legacy] = await db.query<{ app_settings: boolean; organisations: boolean }>(
      "select to_regclass('public.app_settings') is not null as app_settings, to_regclass('public.organisations') is not null as organisations",
    );
    // 0004 and later were always tracked, so a legacy database never has them.
    const inferred = ["0001_init.sql", ...(legacy.app_settings ? ["0002_guards.sql"] : []), ...(legacy.organisations ? ["0003_orgs_and_reliability.sql"] : [])];
    for (const name of inferred) await db.query("insert into haazir_migrations (name) values ($1) on conflict do nothing", [name]);
    applied = new Set(inferred);
  }
  const ran: string[] = [];
  for (const file of migrationFiles()) {
    const name = path.basename(file);
    if (applied.has(name)) continue;
    await db.exec(readSql(file));
    await db.query("insert into haazir_migrations (name) values ($1)", [name]);
    ran.push(name);
  }
  if (fresh || opts.seed) await db.exec(readSql("supabase/seed.sql"));
  return ran;
}

/** Roles (plain Postgres only), every migration in order, then optionally the seed. */
export async function applySchema(db: Db, opts: { seed: boolean }): Promise<void> {
  await migrate(db, { seed: opts.seed });
}
