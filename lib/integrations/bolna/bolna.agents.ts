// Builds Bolna agent definitions from bolna/prompts/*.md and bolna/tools/*.json (pure; used by scripts/bolna-agents.ts).
//
// VERIFY BEFORE --apply: the request shape below follows Bolna's v2 agent API as documented when this was written
// (agent_config + agent_prompts, tools_config.api_tools, toolchain.pipelines as an array of arrays). Bolna's docs
// were not reachable from the build environment, so compare one generated file with
// https://www.bolna.ai/docs/api-reference before creating agents, and adjust `buildAgent` if fields have moved.

export interface PromptDoc {
  key: string;
  title: string;
  welcome: Record<string, string>;
  systemPrompt: string;
  hangupPrompt: string | null;
  finalMessage: Record<string, string>;
  toolFiles: string[];
}

function section(md: string, heading: string): string {
  const lines = md.split("\n");
  const start = lines.findIndex((l) => l.startsWith("## ") && l.slice(3).toLowerCase().startsWith(heading.toLowerCase()));
  if (start < 0) return "";
  const end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
  return lines.slice(start + 1, end < 0 ? undefined : end).join("\n");
}

function codeBlock(text: string): string | null {
  const m = text.match(/```(?:text)?\n([\s\S]*?)```/);
  return m ? m[1].trim() : null;
}

function perLanguage(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of text.matchAll(/^- \*\*([a-z]{2}):\*\* `([^`]*)`/gm)) out[m[1]] = m[2];
  return out;
}

export function parsePromptDoc(key: string, raw: string): PromptDoc {
  // Git on Windows (core.autocrlf) checks the prompts out with CRLF; every parser below expects "\n".
  const md = raw.replace(/\r\n/g, "\n");
  const title = (md.match(/^# (.*)$/m)?.[1] ?? key).trim();
  const systemPrompt = codeBlock(section(md, "System prompt"));
  if (!systemPrompt) throw new Error(`${key}: no System prompt code block`);
  return {
    key,
    title,
    welcome: perLanguage(section(md, "Welcome message")),
    systemPrompt,
    hangupPrompt: codeBlock(section(md, "Hangup prompt")),
    finalMessage: perLanguage(section(md, "Final call message")),
    toolFiles: [...section(md, "Tools").matchAll(/`(bolna\/tools\/[^`]+\.json)`/g)].map((m) => m[1]),
  };
}

export interface ToolDef {
  name: string;
  description: string;
  pre_call_message?: string;
  parameters: unknown;
  key: string;
  value: { method: string; param: Record<string, string>; url: string; api_token: string; headers?: Record<string, string> };
}

/** Fills YOUR_APP_URL and YOUR_BOLNA_FUNCTION_SECRET in a tool definition. */
export function fillTool(tool: ToolDef, appUrl: string, functionSecret: string): ToolDef {
  const host = appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return {
    ...tool,
    value: {
      ...tool.value,
      url: tool.value.url.replace("YOUR_APP_URL", host),
      api_token: tool.value.api_token.replace("YOUR_BOLNA_FUNCTION_SECRET", functionSecret),
    },
  };
}

/** Max call length per agent (docs/05-voice-agents.md §1). */
export const CALL_LIMIT_S: Record<string, number> = {
  availability: 180,
  "hold-confirm": 120,
  release: 60,
  "family-update": 120,
  "inbound-callback": 90,
};

export interface BuildOptions {
  appUrl: string;
  webhookSecret: string;
  functionSecret: string;
  llmProvider: string;
  llmModel: string;
  sttProvider: string;
  sttModel: string;
  ttsProvider: string;
  ttsModel: string;
  ttsVoice: string;
  telephony: string;
  startLanguage: string;
  suffix: string; // e.g. " (dev)" or " (demo)"
}

export function buildAgent(doc: PromptDoc, tools: ToolDef[], o: BuildOptions): Record<string, unknown> {
  const app = o.appUrl.replace(/\/$/, "");
  const filled = tools.map((t) => fillTool(t, app, o.functionSecret));
  // The welcome message is per call language in the pack; Bolna takes one, so the start language's version is used and
  // the prompt tells the agent to follow the desk's language. Variables like {doctor_name} come from user_data.
  const welcome = doc.welcome[o.startLanguage] ?? doc.welcome.en ?? "";
  const languageNote =
    "\n\n# Languages\nStart in the language of the welcome message. Switch to English, Hindi or Kannada as soon as the person does. " +
    "In Hindi and Kannada use polite plural forms.";
  return {
    agent_config: {
      agent_name: `Haazir · ${doc.title.replace(/^Agent:\s*Haazir\s*·\s*/i, "")}${o.suffix}`,
      agent_type: "other",
      agent_welcome_message: welcome,
      webhook_url: `${app}/api/bolna/webhook?token=${encodeURIComponent(o.webhookSecret)}`,
      tasks: [
        {
          task_type: "conversation",
          tools_config: {
            llm_agent: {
              agent_type: "simple_llm_agent",
              agent_flow_type: "streaming",
              llm_config: { provider: o.llmProvider, model: o.llmModel, max_tokens: 200, temperature: 0.2 },
            },
            transcriber: { provider: o.sttProvider, model: o.sttModel, language: o.startLanguage, stream: true, endpointing: 300 },
            synthesizer: {
              provider: o.ttsProvider,
              provider_config: { model: o.ttsModel, voice: o.ttsVoice, language: o.startLanguage },
              stream: true,
            },
            input: { provider: o.telephony, format: "wav" },
            output: { provider: o.telephony, format: "wav" },
            ...(filled.length
              ? {
                  api_tools: {
                    tools: filled.map((t) => ({
                      name: t.name, description: t.description, pre_call_message: t.pre_call_message, parameters: t.parameters, key: t.key,
                    })),
                    tools_params: Object.fromEntries(filled.map((t) => [t.name, t.value])),
                  },
                }
              : {}),
          },
          toolchain: { execution: "parallel", pipelines: [["transcriber", "llm", "synthesizer"]] },
          task_config: {
            call_terminate: CALL_LIMIT_S[doc.key] ?? 120,
            hangup_after_silence: 40,
            ambient_noise: false,
            voicemail: false,
            call_cancellation_prompt: doc.hangupPrompt,
            optimize_latency: true,
            number_of_words_for_interruption: 2,
            trigger_user_online_message_after: 15,
            check_user_online_message: "I'm still here, please take your time.",
          },
        },
      ],
    },
    agent_prompts: { task_1: { system_prompt: doc.systemPrompt + languageNote } },
  };
}

/** Which env var each agent's id goes into. */
export const AGENT_ENV: Record<string, string> = {
  availability: "BOLNA_AGENT_ID_AVAILABILITY",
  "hold-confirm": "BOLNA_AGENT_ID_HOLD_CONFIRM",
  release: "BOLNA_AGENT_ID_RELEASE",
  "family-update": "BOLNA_AGENT_ID_FAMILY",
  "inbound-callback": "BOLNA_AGENT_ID_INBOUND",
};
