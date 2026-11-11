// Checks a Bolna agent against what we meant to push (pure; used by scripts/bolna-agents.ts).
//
// Unverified against live Bolna: GET /v2/agent/{id} is assumed to return the same agent_config / agent_prompts shape as
// the create payload. Anything it leaves out is reported as missing, so a different shape shows up as differences
// rather than as a silent pass. Bolna drops some documented fields without an error (CLAUDE.md), hence the read-back.

import { isRecord, readField, readText } from "@/lib/core/normalize";

const PRIVATE_IPV4 = /^(0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/;

/**
 * Why Bolna cannot reach `appUrl` from outside, or null when it looks public. Every agent keeps its webhook and tool URLs
 * inside it, so an agent created against a private address answers calls but never writes anything back.
 */
export function unreachableUrlProblem(appUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(appUrl);
  } catch {
    return `APP_BASE_URL "${appUrl}" is not a URL`;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return `APP_BASE_URL must start with https:// (got ${url.protocol})`;
  const host = url.hostname;
  const isPrivate = host === "localhost" || host === "[::1]" || host.endsWith(".local") || PRIVATE_IPV4.test(host);
  return isPrivate ? `APP_BASE_URL host "${host}" is not reachable from Bolna; start ngrok or cloudflared and use its https URL` : null;
}

/** The value at `path` below `value`, or undefined when any step is missing. */
const at = (value: unknown, ...path: string[]): unknown => path.reduce((node, key) => readField(node, key), value);

/** The first task of an agent, which holds the tools, voice and languages. */
const firstTask = (agent: unknown): unknown => {
  const tasks = at(agent, "agent_config", "tasks");
  return Array.isArray(tasks) ? tasks[0] : undefined;
};

/** Sorted, comma-joined strings from `items`, or null when `items` is not a non-empty list of them. */
const joined = (items: unknown[]): string | null => {
  const texts = items.filter((item): item is string => typeof item === "string");
  return texts.length ? texts.sort().join(", ") : null;
};

/** A URL without its query, so a secret in `?token=` never reaches the screen. */
const withoutQuery = (value: string): string => {
  try {
    const url = new URL(value);
    return `${url.origin}${url.pathname}`;
  } catch {
    return value;
  }
};

const SECRET_DIFFERS = "the secret in the URL differs";

interface AgentField {
  label: string;
  /** What this agent holds for the field; null when it has none. */
  read: (agent: unknown) => string | null;
  /** How a value is shown in a difference. Defaults to the value itself. */
  show?: (value: string) => string;
  /** Added when two different values print the same, so the line never reads "has X, expected X" without a reason. */
  whenSame?: string;
}

const toolsOf = (agent: unknown): unknown[] => {
  const tools = at(firstTask(agent), "tools_config", "api_tools", "tools");
  return Array.isArray(tools) ? tools : [];
};

const toolParamsOf = (agent: unknown): unknown[] => {
  const params = at(firstTask(agent), "tools_config", "api_tools", "tools_params");
  return isRecord(params) ? Object.values(params) : [];
};

const vectorIdsOf = (agent: unknown): unknown[] => {
  const store = at(firstTask(agent), "tools_config", "llm_agent", "llm_config", "rag_config", "vector_store");
  const ids = at(store, "provider_config", "vector_ids");
  return Array.isArray(ids) ? ids : [];
};

const languagesOf = (agent: unknown): string[] => {
  const languages = at(firstTask(agent), "tools_config", "multilingual_config", "languages");
  return isRecord(languages) ? Object.keys(languages) : [];
};

const AGENT_FIELDS: AgentField[] = [
  {
    label: "webhook URL",
    read: (a) => readText(at(a, "agent_config"), "webhook_url"),
    show: withoutQuery,
    whenSame: SECRET_DIFFERS,
  },
  {
    label: "system prompt",
    read: (a) => readText(at(a, "agent_prompts", "task_1"), "system_prompt"),
    show: (v) => `${v.length} characters`,
    whenSame: "same length, different text",
  },
  { label: "agent type", read: (a) => readText(at(firstTask(a), "tools_config", "llm_agent"), "agent_type") },
  { label: "tools", read: (a) => joined(toolsOf(a).map((tool) => readText(tool, "name"))) },
  {
    label: "tool URLs",
    read: (a) => joined(toolParamsOf(a).map((p) => readText(p, "url"))),
    show: (v) => v.split(", ").map(withoutQuery).join(", "),
    whenSame: SECRET_DIFFERS,
  },
  { label: "languages", read: (a) => joined(languagesOf(a)) },
  { label: "knowledge base", read: (a) => joined(vectorIdsOf(a)) },
];

/**
 * What differs between the agent we pushed (`sent`) and the one Bolna returns (`stored`), one line per field. Empty when
 * they match. Secrets in URLs and the prompt text are never printed, and a tool's `api_token` is not compared.
 */
export function agentDifferences(sent: unknown, stored: unknown): string[] {
  const lines: string[] = [];
  for (const field of AGENT_FIELDS) {
    const want = field.read(sent);
    const have = field.read(stored);
    if (want === have) continue;
    const show = (value: string | null): string => (value === null ? "nothing" : (field.show ?? ((v) => v))(value));
    const same = want !== null && have !== null && show(want) === show(have) && field.whenSame ? ` (${field.whenSame})` : "";
    lines.push(`${field.label}: Bolna has ${show(have)}, expected ${show(want)}${same}`);
  }
  return lines;
}
