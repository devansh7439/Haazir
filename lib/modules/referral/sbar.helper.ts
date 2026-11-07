// The SBAR handover (Situation, Background, Assessment, Recommendation) built from the referral's fields. Pure and
// deterministic, like the spoken summary (CLAUDE.md rule 6). It carries no patient name or phone (rule 1).

import type { Acuity, AgeUnit, Attempt, ClinicalFacts, HandoverFacts, Sex } from "@/lib/core/types";
import { PAYER_LABEL, clinicalLine } from "@/lib/modules/referral/referral.helper";
import type { ReferralCtx } from "@/lib/modules/referral/referral.type";
import { buildShortSummary } from "@/lib/modules/referral/summary.helper";

export interface SbarInput extends ClinicalFacts, HandoverFacts {
  age_value: number | null;
  age_unit: AgeUnit;
  sex: Sex;
  acuity: Acuity;
  note: string | null;
  transport: string;
}

export interface Sbar {
  situation: string;
  background: string;
  assessment: string;
  recommendation: string;
}

const TRANSPORT: Record<string, string> = { ambulance: "ambulance", private_vehicle: "private vehicle" };

/**
 * One sentence or line per letter. A letter with nothing to say reads "Not stated" so a receiving doctor sees the gap
 * instead of assuming it was checked.
 */
export function buildSbar(input: SbarInput, c: { case_label: string; needs_labels: string[]; eta_minutes: number | null }): Sbar {
  const who = buildShortSummary({ ...input, case_spoken: c.case_label });
  const history = [
    input.note,
    input.trauma_mechanism !== "unknown" && input.trauma_mechanism !== "not_trauma" ? `Mechanism: ${input.trauma_mechanism.replace("_", " ")}` : null,
    input.pregnancy_weeks ? `Pregnant, ${input.pregnancy_weeks} weeks` : null,
    input.infectious_risk !== "unknown" && input.infectious_risk !== "none" ? `Infection risk: ${input.infectious_risk}` : null,
    input.treatment_given ? `Treatment given: ${input.treatment_given}` : null,
    input.medico_legal === true ? "Medico-legal case" : null,
    input.payer !== "unknown" ? `Payment: ${PAYER_LABEL[input.payer]}` : null,
  ].filter((p): p is string => !!p);
  const blood = input.blood_needed === true ? `Needs blood${input.blood_group !== "unknown" ? `, group ${input.blood_group}` : ""}` : null;
  const eta = c.eta_minutes !== null ? `Expected in about ${c.eta_minutes} min by ${TRANSPORT[input.transport] ?? "road"}` : null;
  return {
    situation: who.charAt(0).toUpperCase() + who.slice(1),
    background: history.join(". ") || "Not stated",
    assessment: clinicalLine({ airway: input.airway, spo2: input.spo2, gcs: input.gcs, on_oxygen: input.on_oxygen, payer: "unknown", medico_legal: null }) ?? "Not stated",
    recommendation: [c.needs_labels.length ? `Needs ${c.needs_labels.join(", ")}` : null, blood, eta].filter((p): p is string => !!p).join(". ") || "Not stated",
  };
}

/** The SBAR of a referral that has a chosen hospital, as the lines the pre-arrival note and the slip print. */
export const sbarFor = (ctx: ReferralCtx, selected: Pick<Attempt, "eta_minutes">): string[] =>
  sbarLines(buildSbar(ctx.referral, { case_label: ctx.template.label, needs_labels: ctx.needs.map((n) => n.label), eta_minutes: selected.eta_minutes }));

/** The four letters as plain text lines, for the slip and the pre-arrival note. */
export const sbarLines = (s: Sbar): string[] => [`S: ${s.situation}`, `B: ${s.background}`, `A: ${s.assessment}`, `R: ${s.recommendation}`];
