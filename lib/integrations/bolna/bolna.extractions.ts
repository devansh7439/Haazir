// The post-call extractions, as data (bolna/extractions.md). Bolna calls each question a "disposition" and groups them
// in "extraction categories" attached to an agent; scripts/bolna-extractions.ts creates or updates them.
// webhook.helper.ts reads the results by these exact category and question names, so renaming one here breaks that.
// Categories and dispositions are their own Bolna resources, so `bolna:agents -- --update` doesn't remove them.

/** One question Bolna's model answers from the transcript after the call. */
export interface DispositionDef {
  name: string;
  question: string;
  /** Pre-defined answers; without them the answer is free text. */
  options?: Array<{ value: string; condition: string }>;
  /** Format for a free-text answer. */
  format?: "text" | "numeric";
}

/** A category of questions on one agent (by its key in AGENT_ENV). */
export interface CategoryDef {
  agent: string;
  name: string;
  dispositions: DispositionDef[];
}

/** The model for every category's extraction pass: one of Bolna's preferred models, so it is in the flat rate. */
export const EXTRACTION_MODEL = "gpt-4.1-mini";

const CALL = "You are reading a phone call between an automated referral assistant and a hospital emergency desk.";

/** The extraction categories to set up on the availability agent, as `bolna/extractions.md` describes. */
export const EXTRACTIONS: CategoryDef[] = [
  {
    agent: "availability",
    name: "Referral outcome",
    dispositions: [
      {
        name: "availability_outcome",
        question:
          `${CALL} Decide what the hospital answered about accepting the patient. Choose "accepted" only if a hospital staff ` +
          "member clearly said they can take the patient now. If the staff member changed their answer during the call, use " +
          'their final answer. If no human spoke, choose "ivr_or_recording".',
        options: [
          { value: "accepted", condition: "The hospital clearly agreed to accept the patient now, without conditions" },
          { value: "conditional", condition: "The hospital agreed, but only with a condition" },
          { value: "declined", condition: "The hospital said it cannot accept the patient" },
          { value: "redirected", condition: "They asked us to call a different number or department" },
          { value: "needs_doctor", condition: "They asked to speak with the referring doctor before deciding" },
          { value: "callback_later", condition: "They asked to be called back later" },
          { value: "ivr_or_recording", condition: "No human answered: a phone menu, a recorded message or voicemail" },
          { value: "unclear", condition: "None of the above is clear from the conversation" },
        ],
      },
      {
        name: "bed_type",
        question: `${CALL} What bed or care did the hospital say it can offer this patient right now?`,
        options: [
          { value: "icu_with_ventilator", condition: "An ICU bed with a ventilator" },
          { value: "icu", condition: "An ICU bed without a ventilator" },
          { value: "hdu", condition: "A high-dependency (HDU) or step-down bed" },
          { value: "nicu", condition: "A neonatal ICU (NICU or SNCU) bed" },
          { value: "emergency_only", condition: "They can see the patient in casualty or emergency, but have no bed" },
          { value: "ward", condition: "A general ward bed" },
          { value: "none", condition: "They said they have no bed of any kind" },
          { value: "unknown", condition: "No bed type was said" },
        ],
      },
      {
        name: "ready_in_minutes",
        question: `${CALL} How many minutes until the hospital is ready to receive the patient, if they said? Digits only.`,
        format: "numeric",
      },
      { name: "contact_person", question: `${CALL} Whom should the ambulance team ask for, if the hospital gave a name or role?` },
      { name: "conditions", question: `${CALL} What condition, if any, did the hospital attach to accepting the patient?` },
      {
        name: "decline_reason",
        question: `${CALL} If the hospital declined, what reason did it give?`,
        options: [
          { value: "no_bed", condition: "No bed is free" },
          { value: "no_ventilator", condition: "No ventilator is free" },
          { value: "no_specialist", condition: "The needed specialist is not available" },
          { value: "full", condition: "The hospital or unit is full" },
          { value: "not_our_case", condition: "They don't treat this kind of patient" },
          { value: "other", condition: "Another reason" },
          { value: "not_applicable", condition: "They did not decline, or gave no reason" },
        ],
      },
    ],
  },
  {
    agent: "hold-confirm",
    name: "Hold",
    dispositions: [
      {
        name: "hold_confirmed",
        question: `${CALL} The hospital was asked to keep a bed ready for a patient the doctor is sending. What did they answer?`,
        options: [
          { value: "yes", condition: "They agreed to keep the bed ready" },
          { value: "no", condition: "They said they can no longer take the patient" },
          { value: "unclear", condition: "Neither is clear from the conversation" },
        ],
      },
      { name: "contact_person", question: `${CALL} Whom should the ambulance team ask for, if the hospital gave a name or role?` },
    ],
  },
];

/** The body Bolna's disposition API takes for one question, linked to the agent and category. */
export function dispositionBody(d: DispositionDef, agentId: string, categoryId: string): Record<string, unknown> {
  const base = { agent_id: agentId, category_id: categoryId, name: d.name, question: d.question, model: EXTRACTION_MODEL };
  return d.options
    ? { ...base, is_objective: true, is_subjective: false, objective_options: d.options }
    : { ...base, is_objective: false, is_subjective: true, subjective_type: d.format ?? "text" };
}
