import { applySchema, connect, setDb, type Db } from "@/lib/db";
import { setClock } from "@/lib/clock";

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

export { applySchema };

/** A controllable clock starting at a fixed instant. */
export function fakeClock(start = new Date("2026-10-30T20:30:00Z")) {
  let t = start.getTime();
  setClock(() => new Date(t));
  return {
    advance(seconds: number) { t += seconds * 1000; },
    get now() { return new Date(t); },
  };
}
