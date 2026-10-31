// Creates Haazir's Bolna agents from bolna/prompts/*.md and bolna/tools/*.json.
//
//   npm run bolna:agents                       → dry run: writes bolna/generated/<agent>.json for review
//   npm run bolna:agents -- --apply            → POST /v2/agent for each, prints the env lines to copy
//   options: --only availability,release  --suffix " (dev)"  --language kn  --llm-model gpt-4.1-mini
//   --demo-transfer   (demo availability agent only, after adding the Transfer Call tool in Bolna: docs/05 §7)
//            --voice <voice id>  --tts-model bulbul:v2  --stt-model saarika:v2.5  --telephony plivo
//
// Needs APP_BASE_URL, BOLNA_WEBHOOK_SECRET, BOLNA_FUNCTION_SECRET (and BOLNA_API_KEY for --apply).
// Read the VERIFY note in lib/bolnaAgents.ts before the first --apply.
import fs from "node:fs";
import path from "node:path";
import { AGENT_ENV, buildAgent, parsePromptDoc, type ToolDef } from "../lib/integrations/bolna/bolna.agents";

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const env = (k: string) => (process.env[k] ?? "").trim();
  const appUrl = env("APP_BASE_URL");
  const webhookSecret = env("BOLNA_WEBHOOK_SECRET");
  const functionSecret = env("BOLNA_FUNCTION_SECRET");
  if (!appUrl || !webhookSecret || !functionSecret) throw new Error("Set APP_BASE_URL, BOLNA_WEBHOOK_SECRET and BOLNA_FUNCTION_SECRET");
  if (apply && !env("BOLNA_API_KEY")) throw new Error("Set BOLNA_API_KEY for --apply");

  const only = arg("only", "availability,hold-confirm,release,family-update,inbound-callback").split(",").map((s) => s.trim());
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
      sttModel: arg("stt-model", "saarika:v2.5"),
      ttsProvider: arg("tts-provider", "sarvam"),
      ttsModel: arg("tts-model", "bulbul:v2"),
      ttsVoice: arg("voice", "anushka"),
      telephony: arg("telephony", "plivo"),
      startLanguage: arg("language", "en"),
      suffix: arg("suffix", ""),
      demoTransfer: process.argv.includes("--demo-transfer"),
    });
    const file = path.join(outDir, `${key}.json`);
    fs.writeFileSync(file, JSON.stringify(payload, null, 2) + "\n");
    if (!apply) {
      console.log(`wrote ${file}  (${tools.length} tool${tools.length === 1 ? "" : "s"})`);
      continue;
    }
    const res = await fetch(`${env("BOLNA_BASE_URL") || "https://api.bolna.ai"}/v2/agent`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("BOLNA_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${key}: Bolna returned ${res.status}: ${text.slice(0, 500)}`);
    const data = JSON.parse(text) as { agent_id?: string; id?: string; state?: string };
    const id = data.agent_id ?? data.id;
    console.log(`created ${key}: ${id} (${data.state ?? "?"})`);
    envLines.push(`${AGENT_ENV[key]}=${id}`);
  }
  if (apply) {
    console.log("\nAdd to your environment:\n" + envLines.join("\n"));
    console.log("\nThen in the dashboard: languages en/kn/hi with auto-switch, noise cancellation on, calling hours off, extractions (bolna/extractions.md).");
  } else {
    console.log("\nDry run only. Check one file against Bolna's API reference, then rerun with --apply.");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
