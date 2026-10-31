// Places one test call with the same user_data the app sends, so a welcome and prompt can be heard with real values.
// A test call from the Bolna dashboard sends no variables, so every name in it is spoken as a blank.
//
//   bun run bolna:test-call -- --to +919800000000                     → availability agent, English
//   options: --agent availability|hold-confirm|release  --language en|hi|kn  --no-wait
//
// The patient is fictional and the call opens with the consented-test sentence. The tools post to APP_BASE_URL: when
// that is localhost, Bolna can't reach it, so a tool call fails and the agent ends politely; the outcome is not recorded.
// On a trial Bolna account, --to must be a verified number. Prints the transcript when the call ends.
import { randomUUID } from "node:crypto";
import { normalizePhone } from "../lib/core/normalize";
import { AGENT_ENV } from "../lib/integrations/bolna/bolna.agents";
import { availabilityUserData, holdConfirmUserData, releaseUserData, type CallContext } from "../lib/modules/call/user-data.helper";

const SAMPLE = {
  doctor_name: "Dr. Meera Rao",
  referring_facility: "Hoskote PHC",
  facility_name: "Banyan Multispeciality Hospital",
  referral_code: "R-4821",
  // docs/05-voice-agents.md §3; the app builds this with buildSpokenSummary.
  case_summary:
    "Man aged 34, suspected snakebite with neurotoxic signs, critical. Drooping eyelids and trouble swallowing 2 hours after bite. " +
    "Given 10 vials of anti-snake venom. Needs an ICU bed and a ventilator.",
  case_summary_short: "man aged 34, suspected snakebite with neurotoxic signs, critical",
  needs_spoken: "an ICU bed and a ventilator",
  eta_minutes: 18,
};
const WAIT_S = 300;
const ENDED = ["completed", "no-answer", "busy", "failed", "canceled", "stopped", "error", "balance-low"];

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

/** The user_data the app would send this agent for the sample referral. Null for an agent this script doesn't cover. */
function userDataFor(agent: string, ctx: CallContext): Record<string, string> | null {
  if (agent === "availability") return availabilityUserData(ctx, SAMPLE);
  if (agent === "hold-confirm") {
    const hold = { ...SAMPLE, bed_type: "icu_with_ventilator", accepted_by: "Dr Shashikala", whatsapp_on_file: false };
    return holdConfirmUserData(ctx, hold);
  }
  if (agent === "release") return releaseUserData(ctx, SAMPLE);
  return null;
}

async function main() {
  const env = (k: string) => (process.env[k] ?? "").trim();
  const agent = arg("agent", "availability");
  const language = arg("language", "en");
  const to = normalizePhone(arg("to", ""));
  if (!to) throw new Error("Give the number to call: --to +91XXXXXXXXXX");
  const agentId = env(AGENT_ENV[agent] ?? "");
  if (!agentId) throw new Error(`Set ${AGENT_ENV[agent] ?? "the agent id"} (agents: availability, hold-confirm, release)`);
  if (!env("BOLNA_API_KEY")) throw new Error("Set BOLNA_API_KEY");

  const ctx: CallContext = { ...SAMPLE, attempt_id: randomUUID(), language, consented_test: true };
  const userData = userDataFor(agent, ctx);
  if (!userData) throw new Error(`No sample for agent "${agent}"`);
  const base = env("BOLNA_BASE_URL") || "https://api.bolna.ai";
  const headers = { Authorization: `Bearer ${env("BOLNA_API_KEY")}`, "Content-Type": "application/json" };
  const body = {
    agent_id: agentId,
    recipient_phone_number: to,
    ...(env("BOLNA_FROM_NUMBER") ? { from_phone_number: env("BOLNA_FROM_NUMBER") } : {}),
    user_data: userData,
    agent_data: { language },
    bypass_call_guardrails: true,
  };
  const res = await fetch(`${base}/call`, { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`Bolna returned ${res.status}: ${text.slice(0, 300)}`);
  const executionId = (JSON.parse(text) as { execution_id?: string }).execution_id;
  console.log(`calling (${agent}, ${language}): execution ${executionId}`);
  if (!executionId || process.argv.includes("--no-wait")) return;

  for (let waited = 0; waited < WAIT_S; waited += 5) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(`${base}/executions/${executionId}`, { headers, signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (!poll?.ok) continue;
    const e = (await poll.json()) as { status?: string; transcript?: string; conversation_duration?: number };
    if (!e.status || !ENDED.includes(e.status)) continue;
    console.log(`\n${e.status}, ${e.conversation_duration ?? "?"} s\n\n${e.transcript ?? "(no transcript)"}`);
    return;
  }
  console.log(`Still running after ${WAIT_S} s; see the call in the Bolna dashboard.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
