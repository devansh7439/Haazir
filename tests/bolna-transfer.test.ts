import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAgent, parsePromptDoc, type BuildOptions, type ToolDef } from "@/lib/integrations/bolna/bolna.agents";

// docs/05 §7: the live-transfer paragraph is demo-only, opt-in, and only for the availability agent.

const options: BuildOptions = {
  appUrl: "https://app.example", webhookSecret: "wh", functionSecret: "fn", llmProvider: "openai", llmModel: "m",
  sttProvider: "sarvam", sttModel: "s", ttsProvider: "sarvam", ttsModel: "t", ttsVoice: "v", telephony: "plivo",
  startLanguage: "en", suffix: "",
};
const promptOf = (key: string, o: Partial<BuildOptions>): string => {
  const doc = parsePromptDoc(key, fs.readFileSync(`bolna/prompts/${key}.md`, "utf8"));
  const tools = doc.toolFiles.map((f) => JSON.parse(fs.readFileSync(f, "utf8")) as ToolDef);
  const agent = buildAgent(doc, tools, { ...options, ...o }) as { agent_prompts: { task_1: { system_prompt: string } } };
  return agent.agent_prompts.task_1.system_prompt;
};

describe("demo live transfer", () => {
  it("is off by default", () => {
    expect(promptOf("availability", {})).not.toContain("Transfer Call");
  });

  it("adds the paragraph to the availability agent only when asked, and keeps the callback rules", () => {
    const prompt = promptOf("availability", { demoTransfer: true });
    expect(prompt).toContain("Live transfer (demo only)");
    expect(prompt).toContain("request_doctor_callback");
  });

  it("never touches the other agents", () => {
    for (const key of ["hold-confirm", "release", "family-update", "inbound-callback"]) {
      expect(promptOf(key, { demoTransfer: true })).not.toContain("Transfer Call");
    }
  });
});
