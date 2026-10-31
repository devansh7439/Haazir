// Creates or updates the post-call extractions (lib/integrations/bolna/bolna.extractions.ts) on Haazir's Bolna agents.
//
//   bun run bolna:extractions                  → dry run: prints what would be created or updated
//   bun run bolna:extractions -- --apply       → creates missing categories and questions, updates existing ones
//
// Matches categories and questions by name, so it can be rerun. Needs BOLNA_API_KEY and the BOLNA_AGENT_ID_* of each agent.
// When the app runs locally without a tunnel, these extractions are the only way a call's answer reaches it.
import { AGENT_ENV } from "../lib/integrations/bolna/bolna.agents";
import { EXTRACTIONS, EXTRACTION_MODEL, dispositionBody } from "../lib/integrations/bolna/bolna.extractions";

interface Category {
  id: string;
  name: string;
  dispositions?: Array<{ id: string; name: string }>;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

async function main() {
  const apply = process.argv.includes("--apply");
  const env = (k: string) => (process.env[k] ?? "").trim();
  const key = env("BOLNA_API_KEY");
  if (!key) throw new Error("Set BOLNA_API_KEY");
  const base = env("BOLNA_BASE_URL") || "https://api.bolna.ai";
  const headers = { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };

  /** One Bolna request; throws with Bolna's message on an error status. */
  const call = async (method: string, path: string, body?: unknown): Promise<unknown> => {
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`${method} ${path}: Bolna returned ${res.status}: ${text.slice(0, 300)}`);
    return text ? JSON.parse(text) : null;
  };

  for (const cat of EXTRACTIONS) {
    const agentId = env(AGENT_ENV[cat.agent]);
    if (!agentId) {
      console.log(`skipped ${cat.agent}: ${AGENT_ENV[cat.agent]} is not set`);
      continue;
    }
    const listed = (await call("GET", `/agent/${agentId}/extraction-categories`)) as { categories?: Category[] };
    let category = (listed.categories ?? []).find((c) => sameName(c.name, cat.name));
    if (!category) {
      console.log(`${cat.agent}: create category "${cat.name}"`);
      const body = { name: cat.name, model: EXTRACTION_MODEL };
      if (apply) category = (await call("POST", `/agent/${agentId}/extraction-categories`, body)) as Category;
    }
    for (const d of cat.dispositions) {
      const existing = category?.dispositions?.find((x) => sameName(x.name, d.name));
      console.log(`${cat.agent}: ${existing ? "update" : "create"} "${cat.name} → ${d.name}"`);
      if (!apply || !category) continue;
      const body = dispositionBody(d, agentId, category.id);
      if (existing) await call("PUT", `/dispositions/${existing.id}`, body);
      else await call("POST", "/dispositions/", body);
    }
  }
  console.log(apply ? "\nDone. Check them in the agent's Extractions tab." : "\nDry run only. Rerun with --apply.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
