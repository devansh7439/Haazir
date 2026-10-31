// The 20-scenario voice test matrix (docs/05-voice-agents.md §9). Gate: every row passes twice in a row; rows marked
// zeroTolerance (a false "accepted") must never fail.

export interface MatrixRow {
  no: number;
  scenario: string;
  expected: string;
  zeroTolerance?: boolean;
}

/** The 20 voice scenarios, each with the result it must produce. */
export const TEST_MATRIX: MatrixRow[] = [
  { no: 1, scenario: "Clear yes in English, gives time and name", expected: "accepted, ready_in_minutes and contact_person filled", zeroTolerance: true },
  { no: 2, scenario: "Clear yes in Kannada", expected: "accepted; transcript in Kannada" },
  { no: 3, scenario: "Starts in English, switches to Hindi", expected: "Agent switches; outcome correct" },
  { no: 4, scenario: "No, \"ICU full\"", expected: "declined, reason full or no_bed" },
  { no: 5, scenario: "Yes \"only if you send the case sheet\"", expected: "conditional with the condition" },
  { no: 6, scenario: "\"Hold on\" and 25 s of silence, then yes", expected: "Agent waits; accepted" },
  { no: 7, scenario: "\"Call back in 3 minutes\"", expected: "callback_later; a new attempt dials after about 3 min" },
  { no: 8, scenario: "\"Let me talk to the doctor\"", expected: "needs_doctor; banner appears in under 2 s" },
  { no: 9, scenario: "\"Wrong desk, call 98xxxxxxxx\"", expected: "redirected; new attempt to the normalised number" },
  { no: 10, scenario: "\"What's the patient's name?\"", expected: "Agent declines politely; call continues" },
  { no: 11, scenario: "\"Are you a robot?\"", expected: "Agent says it's an automated assistant" },
  { no: 12, scenario: "Play a recorded IVR message", expected: "ivr_blocked" },
  { no: 13, scenario: "Don't answer", expected: "no_answer" },
  { no: 14, scenario: "Reject the call (busy)", expected: "busy; one redial after 45 s" },
  { no: 15, scenario: "Ward noise playing loudly, mumbled \"haan… dekhte hain\"", expected: "unclear or a correct answer. Never accepted", zeroTolerance: true },
  { no: 16, scenario: "Says yes, then \"actually no ventilator\" at read-back", expected: "declined", zeroTolerance: true },
  { no: 17, scenario: "Hold confirm: yes with a name", expected: "hold_confirmed; referral confirmed; WhatsApp sent" },
  { no: 18, scenario: "Hold confirm: \"sorry, bed just went\"", expected: "hold_declined; referral back to options_ready" },
  { no: 19, scenario: "Release call", expected: "Completes; release_ack" },
  { no: 20, scenario: "Function route returns 500 (stop the server)", expected: "Agent still ends politely; extraction fills the outcome" },
];

export type MatrixResult = "pass" | "fail" | "untested";

export interface MatrixEntry {
  pass: 1 | 2;
  row_no: number;
  result: MatrixResult;
  note: string | null;
  referral_code: string | null;
  tested_by: string | null;
  tested_at: string;
}

/** Demo-ready only when both passes are 20/20 and no zero-tolerance row has ever failed. */
export function matrixGate(entries: MatrixEntry[]): { passed: [number, number]; failedZeroTolerance: number[]; ready: boolean } {
  const passed: [number, number] = [0, 0];
  const failedZeroTolerance: number[] = [];
  for (const e of entries) {
    if (e.result === "pass") passed[e.pass - 1]++;
    const row = TEST_MATRIX.find((r) => r.no === e.row_no);
    if (e.result === "fail" && row?.zeroTolerance && !failedZeroTolerance.includes(row.no)) failedZeroTolerance.push(row.no);
  }
  return { passed, failedZeroTolerance, ready: passed[0] === 20 && passed[1] === 20 && failedZeroTolerance.length === 0 };
}
