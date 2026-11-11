// Creates or updates Haazir's Bolna agents from bolna/prompts/*.md and bolna/tools/*.json.
//
//   bun run bolna:agents                       → dry run: writes bolna/generated/<agent>.json for review
//   bun run bolna:agents -- --apply            → POST /v2/agent for each agent whose BOLNA_AGENT_ID_* is not set yet, prints the env lines
//   bun run bolna:agents -- --update           → PUT /v2/agent/{id} for each agent whose BOLNA_AGENT_ID_* is set
//   bun run bolna:agents -- --verify           → GET /v2/agent/{id} and list what differs from the files; changes nothing
//   options: --only availability,release  --suffix " (dev)"  --language kn  --llm-model gpt-4.1-mini
//   --kb <rag_id>     (knowledge base from `bun run bolna:kb`; default BOLNA_KNOWLEDGE_BASE_ID)
//   --demo-transfer   (demo availability agent only, after adding the Transfer Call tool in Bolna: docs/05 §7)
//            --voice <Bulbul v3 voice id>  --speed 0.9  --tts-model bulbul:v3  --stt-model saaras:v4  --telephony plivo
//
// --update replaces the whole agent (Bolna's PATCH can't change tools or the LLM type), so settings made only in the
// dashboard, such as languages and extractions, must be set again afterwards.
// Needs APP_BASE_URL, BOLNA_WEBHOOK_SECRET, BOLNA_FUNCTION_SECRET (and BOLNA_API_KEY for --apply, --update and --verify).
// --apply and --update refuse an APP_BASE_URL Bolna cannot reach (localhost, a private address): the agents keep it inside them.
// After every push the agent is read back and compared, because Bolna drops some fields without an error (CLAUDE.md).
// The payload shape is described at the top of lib/integrations/bolna/bolna.agents.ts.
import fs from "node:fs";
import path from "node:path";
import { AGENT_ENV, DEFAULT_TTS_SPEED, buildAgent, parsePromptDoc, type ToolDef } from "../lib/integrations/bolna/bolna.agents";
import { agentDifferences, unreachableUrlProblem } from "../lib/integrations/bolna/bolna.verify";
import { readText } from "../lib/core/normalize";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

/** Reads one agent back from Bolna and prints what differs from `payload`; true when it matches. */
async function readBack(base: string, apiKey: string, key: string, agentId: string, payload: unknown): Promise<boolean> {
  const res = await fetch(`${base}/v2/agent/${agentId}`, { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(30_000) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${key}: reading ${agentId} back returned ${res.status}: ${text.slice(0, 300)}`);
  const differences = agentDifferences(payload, JSON.parse(text));
  if (differences.length === 0) {
    console.log(`verified ${key}: ${agentId} matches the files`);
    return true;
  }
  console.log(`MISMATCH ${key}: ${agentId}`);
  for (const line of differences) console.log(`  - ${line}`);
  return false;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const update = process.argv.includes("--update");
  const verify = process.argv.includes("--verify");
  if ([apply, update, verify].filter(Boolean).length > 1) throw new Error("Use one of --apply (create), --update or --verify");
  const env = (k: string) => (process.env[k] ?? "").trim();
  const appUrl = env("APP_BASE_URL");
  const webhookSecret = env("BOLNA_WEBHOOK_SECRET");
  const functionSecret = env("BOLNA_FUNCTION_SECRET");
  if (!appUrl || !webhookSecret || !functionSecret) throw new Error("Set APP_BASE_URL, BOLNA_WEBHOOK_SECRET and BOLNA_FUNCTION_SECRET");
  if ((apply || update || verify) && !env("BOLNA_API_KEY")) throw new Error("Set BOLNA_API_KEY for --apply, --update and --verify");
  const urlProblem = apply || update ? unreachableUrlProblem(appUrl) : null;
  if (urlProblem) throw new Error(urlProblem);
  const base = env("BOLNA_BASE_URL") || "https://api.bolna.ai";
  let mismatches = 0;

  const only = arg("only", "availability,hold-confirm,release,family-update,arrival-check,inbound-callback").split(",").map((s) => s.trim());
  const knowledgeBaseId = arg("kb", env("BOLNA_KNOWLEDGE_BASE_ID")) || null;
  const ttsSpeed = Number(arg("speed", String(DEFAULT_TTS_SPEED)));
  if (!(ttsSpeed >= 0.5 && ttsSpeed <= 2)) throw new Error("--speed must be between 0.5 and 2.0");
  const outDir = path.join("bolna", "generated");
  fs.mkdirSync(outDir, { recursive: true });
  const envLines: string[] = [];

  for (const key of only) {
    const doc = parsePromptDoc(key, fs.readFileSync(path.join("bolna", "prompts", `${key}.md`), "utf8"));
    const tools = doc.toolFiles.map((f) => JSON.parse(fs.readFileSync(f, "utf8")) as ToolDef);
    const payload = buildAgent(doc, tools, {
      appUrl,
      webhookSecret,
      functionSecret,
      llmProvider: arg("llm-provider", "openai"),
      llmModel: arg("llm-model", "gpt-4.1-mini"),
      sttProvider: arg("stt-provider", "sarvam"),
      // saarika:v2.5 is deprecated and bulbul:v2 can no longer be selected (Bolna's Sarvam pages, 2026-10-31).
      sttModel: arg("stt-model", "saaras:v4"),
      ttsProvider: arg("tts-provider", "sarvam"),
      ttsModel: arg("tts-model", "bulbul:v3"),
      // A male voice: the Hindi lines use masculine verbs ("रहा हूँ"), docs/05 §2.
      ttsVoice: arg("voice", "shubh"),
      ttsSpeed,
      telephony: arg("telephony", "plivo"),
      startLanguage: arg("language", "en"),
      suffix: arg("suffix", ""),
      demoTransfer: process.argv.includes("--demo-transfer"),
      knowledgeBaseId,
    });
    const file = path.join(outDir, `${key}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2) + "\n");
    if (!apply && !update && !verify) {
      console.log(`wrote ${file}  (${tools.length} tool${tools.length === 1 ? "" : "s"})`);
      continue;
    }
    const agentId = env(AGENT_ENV[key]);
    if ((update || verify) && !agentId) {
      console.log(`skipped ${key}: ${AGENT_ENV[key]} is not set`);
      continue;
    }
    // Creating again would leave a second agent in Bolna that no env var points at.
    if (apply && agentId) {
      console.log(`skipped ${key}: ${AGENT_ENV[key]} is already ${agentId}; use --update to change it`);
      continue;
    }
    if (verify) {
      if (!(await readBack(base, env("BOLNA_API_KEY"), key, agentId, payload))) mismatches += 1;
      continue;
    }
    const res = await fetch(update ? `${base}/v2/agent/${agentId}` : `${base}/v2/agent`, {
      method: update ? "PUT" : "POST",
      headers: { Authorization: `Bearer ${env("BOLNA_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${key}: Bolna returned ${res.status}: ${text.slice(0, 500)}`);
    const data: unknown = JSON.parse(text);
    const id = update ? agentId : (readText(data, "agent_id") ?? readText(data, "id"));
    console.log(`${update ? "updated" : "created"} ${key}: ${id ?? "?"} (${readText(data, "status") ?? readText(data, "state") ?? "?"})`);
    if (!id) continue;
    if (!update) envLines.push(`${AGENT_ENV[key]}=${id}`);
    if (!(await readBack(base, env("BOLNA_API_KEY"), key, id, payload))) mismatches += 1;
  }
  if (apply && envLines.length) console.log("\nAdd to your environment:\n" + envLines.join("\n"));
  if (mismatches > 0) {
    const noun = mismatches === 1 ? "agent differs" : "agents differ";
    console.log(`\n${mismatches} ${noun} from the files. Fix in the Bolna dashboard, or push again with --update.`);
    process.exitCode = 1;
  }
  if (apply || update) {
    console.log("\nThen in the dashboard: languages en/kn/hi with auto-switch, calling hours off, extractions (bolna/extractions.md).");
  } else if (!verify) {
    console.log("\nDry run only. Check one file against Bolna's API reference, then rerun with --apply or --update.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
