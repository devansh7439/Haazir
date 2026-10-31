import { connect, setDb, type Db } from "@/lib/core/db";
import { setClock } from "@/lib/core/clock";

export const IDS = {
  hoskote: "00000000-0000-4000-8000-000000000100",
  banyan: "00000000-0000-4000-8000-000000000101",
  neem: "00000000-0000-4000-8000-000000000102",
  tamarind: "00000000-0000-4000-8000-000000000103",
  mango: "00000000-0000-4000-8000-000000000104",
  jasmine: "00000000-0000-4000-8000-000000000105",
  lotus: "00000000-0000-4000-8000-000000000106",
  referrer: "00000000-0000-4000-8000-000000000201",
};

/** Fresh in-memory Postgres (PGlite) with every migration and the seed applied. */
export async function freshDb(): Promise<Db> {
  const db = await connect("pglite:memory"); // auto-applies schema + seed when empty
  setDb(db);
  return db;
}

/**
 * A controllable clock. It starts at real "now" because Postgres triggers (updated_at) stamp real time,
 * as they do in production, so the two stay comparable.
 */
export function fakeClock(start = new Date()) {
  let t = start.getTime();
  setClock(() => new Date(t));
  return {
    advance(seconds: number) { t += seconds * 1000; },
    get now() { return new Date(t); },
  };
}
