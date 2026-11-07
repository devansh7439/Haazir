import type { FactFields, Tri } from "./types";

export const NO_FACTS: FactFields = { airway: "unknown", spo2: "", gcs: "", on_oxygen: "unknown", payer: "unknown", medico_legal: "unknown" };

const tri = (v: Tri): boolean | null => (v === "yes" ? true : v === "no" ? false : null);
const num = (v: string): number | null => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));

/** Whether the typed values are inside the ranges the server accepts (SpO2 0–100, GCS 3–15); empty is fine. */
export const factsValid = (f: FactFields): boolean => {
  const spo2 = num(f.spo2);
  const gcs = num(f.gcs);
  return (spo2 === null || (spo2 >= 0 && spo2 <= 100)) && (gcs === null || (gcs >= 3 && gcs <= 15));
};

/** The facts as POST /api/referrals takes them; a value out of range is left out rather than sent. */
export const factsBody = (f: FactFields) => ({
  airway: f.airway,
  spo2: factsValid(f) ? num(f.spo2) : null,
  gcs: factsValid(f) ? num(f.gcs) : null,
  on_oxygen: tri(f.on_oxygen),
  payer: f.payer,
  medico_legal: tri(f.medico_legal),
});
