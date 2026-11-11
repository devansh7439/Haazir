import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { buildAgent, parsePromptDoc, type BuildOptions, type ToolDef } from "@/lib/integrations/bolna/bolna.agents";
import { agentDifferences, unreachableUrlProblem } from "@/lib/integrations/bolna/bolna.verify";

// Reading an agent back from Bolna: whether APP_BASE_URL can be reached, and what a pushed agent lost on the way.

const options: BuildOptions = {
  appUrl: "https://haazir.example.com", webhookSecret: "wh-secret", functionSecret: "fn-secret", llmProvider: "openai", llmModel: "m",
  sttProvider: "sarvam", sttModel: "saaras:v4", ttsProvider: "sarvam", ttsModel: "bulbul:v3", ttsVoice: "shubh",
  telephony: "plivo", startLanguage: "en", suffix: "",
};

const build = (o: Partial<BuildOptions> = {}, key = "availability"): unknown => {
  const doc = parsePromptDoc(key, fs.readFileSync(`bolna/prompts/${key}.md`, "utf8"));
  const tools = doc.toolFiles.map((f) => JSON.parse(fs.readFileSync(f, "utf8")) as ToolDef);
  return buildAgent(doc, tools, { ...options, ...o });
};

describe("unreachableUrlProblem", () => {
  it("rejects addresses Bolna cannot reach from outside", () => {
    for (const url of ["http://localhost:3000", "http://127.0.0.1:3000", "http://192.168.1.20:3000", "http://10.0.0.5", "http://172.20.0.1"]) {
      expect(unreachableUrlProblem(url), url).toMatch(/not reachable from Bolna/);
    }
    expect(unreachableUrlProblem("http://laptop.local:3000")).toMatch(/not reachable from Bolna/);
    expect(unreachableUrlProblem("http://[::1]:3000")).toMatch(/not reachable from Bolna/);
  });

  it("accepts a tunnel or a public address", () => {
    expect(unreachableUrlProblem("https://abc-123.ngrok-free.app")).toBeNull();
    expect(unreachableUrlProblem("https://haazir.example.com/")).toBeNull();
    expect(unreachableUrlProblem("http://172.32.0.1")).toBeNull();
  });

  it("rejects text that is not an http(s) URL", () => {
    expect(unreachableUrlProblem("haazir.example.com")).toMatch(/not a URL/);
    expect(unreachableUrlProblem("ftp://haazir.example.com")).toMatch(/must start with https/);
  });
});

describe("agentDifferences", () => {
  it("is empty when Bolna returns what was sent", () => {
    for (const key of ["availability", "hold-confirm", "release"]) {
      expect(agentDifferences(build({}, key), build({}, key)), key).toEqual([]);
    }
  });

  it("names the webhook and tool URLs when the agent still points at an old tunnel", () => {
    const lines = agentDifferences(build(), build({ appUrl: "https://old-tunnel.ngrok-free.app" }));
    expect(lines.some((l) => l.startsWith("webhook URL: Bolna has https://old-tunnel.ngrok-free.app/api/bolna/webhook"))).toBe(true);
    expect(lines.some((l) => l.startsWith("tool URLs: Bolna has https://old-tunnel.ngrok-free.app/api/bolna/functions/"))).toBe(true);
  });

  it("says a wrong secret differs without printing either one", () => {
    const lines = agentDifferences(build(), build({ webhookSecret: "other-webhook-secret" }));
    expect(lines).toEqual(["webhook URL: Bolna has https://haazir.example.com/api/bolna/webhook, expected https://haazir.example.com/api/bolna/webhook (the secret in the URL differs)"]);
    expect(lines.join("\n")).not.toContain("secret-");
    expect(lines.join("\n")).not.toContain("wh-secret");
  });

  it("reports a prompt that changed by its length, never its text", () => {
    const lines = agentDifferences(build(), build({ demoTransfer: true }));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/^system prompt: Bolna has \d+ characters, expected \d+ characters$/);
  });

  it("finds a knowledge base that Bolna dropped", () => {
    const lines = agentDifferences(build({ knowledgeBaseId: "rag-1" }), build());
    // The knowledge base also adds a paragraph to the prompt, so the prompt differs too.
    expect(lines.map((l) => l.split(":")[0])).toEqual(["system prompt", "agent type", "knowledge base"]);
    expect(lines).toContain("agent type: Bolna has simple_llm_agent, expected knowledgebase_agent");
    expect(lines).toContain("knowledge base: Bolna has nothing, expected rag-1");
  });

  it("finds tools that are missing", () => {
    const lines = agentDifferences(build(), build({}, "release"));
    expect(lines.some((l) => l.startsWith("tools: Bolna has nothing, expected record_hospital_response"))).toBe(true);
    expect(lines.some((l) => l.startsWith("system prompt:"))).toBe(true);
  });

  it("lists every field as missing when Bolna returns something else", () => {
    const lines = agentDifferences(build(), { state: "created" });
    expect(lines.map((l) => l.split(":")[0])).toEqual(["webhook URL", "system prompt", "agent type", "tools", "tool URLs", "languages"]);
    expect(lines.every((l) => l.includes("Bolna has nothing"))).toBe(true);
  });
});
