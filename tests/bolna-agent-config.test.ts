import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeOutcome, normalizeYesNo } from "@/lib/core/normalize";
import { BED_TYPES } from "@/lib/core/types";
import { buildAgent, parsePromptDoc, type BuildOptions, type ToolDef } from "@/lib/integrations/bolna/bolna.agents";
import { EXTRACTIONS, dispositionBody } from "@/lib/integrations/bolna/bolna.extractions";
import { extraction } from "@/lib/modules/call/webhook.helper";

// The agent pieces Bolna stores outside the prompt: languages, and the post-call extractions the app falls back on.

const options: BuildOptions = {
  appUrl: "http://localhost:3000", webhookSecret: "wh", functionSecret: "fn", llmProvider: "openai", llmModel: "m",
  sttProvider: "sarvam", sttModel: "saaras:v4", ttsProvider: "sarvam", ttsModel: "bulbul:v3", ttsVoice: "shubh",
  telephony: "plivo", startLanguage: "en", suffix: "",
};

const build = (key: string, o: Partial<BuildOptions> = {}) => {
  const doc = parsePromptDoc(key, fs.readFileSync(`bolna/prompts/${key}.md`, "utf8"));
  const tools = doc.toolFiles.map((f) => JSON.parse(fs.readFileSync(f, "utf8")) as ToolDef);
  const agent = buildAgent(doc, tools, { ...options, ...o }) as {
    agent_config: { tasks: Array<{ tools_config: { multilingual_config?: Multilingual } }> };
  };
  return { doc, multilingual: agent.agent_config.tasks[0].tools_config.multilingual_config };
};

interface Multilingual {
  enabled: boolean;
  active_language: string;
  languages: Record<string, { welcome_message: string; synthesizer: { provider_config: Record<string, unknown> } }>;
}

describe("languages", () => {
  it("gives every hospital agent English, Hindi, Kannada, Tamil and Telugu, each greeting in its own language with the same voice", () => {
    for (const key of ["availability", "hold-confirm", "release"]) {
      const { doc, multilingual } = build(key);
      expect(multilingual?.enabled).toBe(true);
      expect(Object.keys(multilingual?.languages ?? {}).sort()).toEqual(["en", "hi", "kn", "ta", "te"]);
      for (const [lang, entry] of Object.entries(multilingual?.languages ?? {})) {
        expect(entry.welcome_message).toBe(doc.welcome[lang]);
        expect(entry.synthesizer.provider_config).toMatchObject({ voice_id: "shubh", language: lang, speed: 0.9 });
      }
    }
  });

  it("starts in the hospital's language, so a Kannada desk is greeted in Kannada", () => {
    expect(build("availability", { startLanguage: "kn" }).multilingual?.active_language).toBe("kn");
    // A language the prompt has no welcome for falls back to the first one rather than failing the call.
    expect(build("availability", { startLanguage: "ml" }).multilingual?.active_language).toBe("en");
  });
});

describe("post-call extractions", () => {
  const category = (name: string) => EXTRACTIONS.find((c) => c.name === name)!;
  const names = (name: string) => category(name).dispositions.map((d) => d.name);

  it("uses exactly the category and question names the webhook reads", () => {
    expect(category("Referral outcome").agent).toBe("availability");
    expect(names("Referral outcome")).toEqual([
      "availability_outcome",
      "bed_type",
      "ready_in_minutes",
      "contact_person",
      "conditions",
      "decline_reason",
    ]);
    expect(category("Hold").agent).toBe("hold-confirm");
    expect(names("Hold")).toEqual(["hold_confirmed", "contact_person"]);
    // Bolna's results come back keyed by these names; the webhook's reader finds them.
    const data = { "Referral outcome": { availability_outcome: { objective: "accepted", confidence_label: "High" } } };
    expect(extraction(data, "Referral outcome", "availability_outcome")).toEqual({ value: "accepted", confident: true });
  });

  it("only offers answers the app understands", () => {
    for (const o of category("Referral outcome").dispositions[0].options!) {
      // Every option maps to a real outcome; only "unclear" itself is unclear.
      expect(normalizeOutcome(o.value) === "unclear").toBe(o.value === "unclear");
    }
    const beds = category("Referral outcome").dispositions.find((d) => d.name === "bed_type")!.options!.map((o) => o.value);
    expect([...beds].sort()).toEqual([...BED_TYPES].sort());
    const hold = category("Hold").dispositions[0].options!.map((o) => [o.value, normalizeYesNo(o.value)]);
    expect(hold).toEqual([["yes", "yes"], ["no", "no"], ["unclear", null]]);
  });

  it("sends pre-defined questions as objective and the rest as free text", () => {
    const outcome = dispositionBody(category("Referral outcome").dispositions[0], "agent-1", "cat-1");
    expect(outcome).toMatchObject({ agent_id: "agent-1", category_id: "cat-1", is_objective: true, is_subjective: false });
    const minutes = dispositionBody(category("Referral outcome").dispositions[2], "agent-1", "cat-1");
    expect(minutes).toMatchObject({ is_objective: false, is_subjective: true, subjective_type: "numeric" });
    expect(minutes).not.toHaveProperty("objective_options");
  });
});

describe("call languages", () => {
  it("lists exactly the languages every prompt file has a welcome for, and falls back to English for the rest", async () => {
    const { CALL_LANGUAGES, callLanguage } = await import("@/lib/modules/call/call.helper");
    for (const key of ["availability", "hold-confirm", "release", "family-update", "arrival-check", "inbound-callback"]) {
      expect(Object.keys(build(key).doc.welcome).sort()).toEqual([...CALL_LANGUAGES].sort());
    }
    expect(callLanguage("te")).toBe("te");
    expect(callLanguage("ml")).toBe("en");
  });
});

describe("start language", () => {
  it("uses one language for the welcome, transcriber and voice, English when the prompt has none for the request", () => {
    const task = (o: Partial<BuildOptions>) => {
      const doc = parsePromptDoc("availability", fs.readFileSync("bolna/prompts/availability.md", "utf8"));
      const agent = buildAgent(doc, [], { ...options, ...o }) as {
        agent_config: { agent_welcome_message: string; tasks: Array<{ tools_config: { transcriber: { language: string }; synthesizer: { provider_config: { language: string } } } }> };
      };
      return { welcome: agent.agent_config.agent_welcome_message, tc: agent.agent_config.tasks[0].tools_config, doc };
    };
    const ml = task({ startLanguage: "ml" });
    expect(ml.tc.transcriber.language).toBe("en");
    expect(ml.tc.synthesizer.provider_config.language).toBe("en");
    expect(ml.welcome).toBe(ml.doc.welcome.en);
    const ta = task({ startLanguage: "ta" });
    expect(ta.tc.transcriber.language).toBe("ta");
    expect(ta.welcome).toBe(ta.doc.welcome.ta);
  });
});
