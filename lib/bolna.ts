import "server-only";
import { randomUUID } from "node:crypto";
import { env } from "./config";

// Bolna REST client (docs/04-api-spec.md §6). In simulation, makeCall returns sim_<uuid> and never calls Bolna.

export interface MakeCallRequest {
  agent_id: string;
  recipient_phone_number: string;
  from_phone_number?: string;
  user_data: Record<string, string>;
  agent_data: { language: string };
  bypass_call_guardrails: true;
}

export interface MakeCallResponse {
  status: string;
  execution_id: string;
}

export class BolnaError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "BolnaError";
  }
}

export const SIM_PREFIX = "sim_";

export function isSimulatedExecution(executionId: string | null | undefined): boolean {
  return !!executionId && executionId.startsWith(SIM_PREFIX);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!env.bolnaApiKey) throw new BolnaError("BOLNA_API_KEY is not configured", 0);
  const res = await fetch(`${env.bolnaBaseUrl}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.bolnaApiKey}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    const d = (data ?? {}) as Record<string, unknown>;
    const message = String(d.message ?? d.error ?? d.detail ?? `Bolna ${method} ${path} failed with ${res.status}`);
    const retry = Number(d.retry_after_seconds ?? res.headers.get("retry-after"));
    throw new BolnaError(message, res.status, Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  return data as T;
}

export async function makeCall(req: MakeCallRequest, opts: { simulate: boolean }): Promise<MakeCallResponse> {
  if (opts.simulate) return { status: "queued", execution_id: `${SIM_PREFIX}${randomUUID()}` };
  if (!req.agent_id) throw new BolnaError("Bolna agent ID is not configured for this call type", 0);
  const body: MakeCallRequest = { ...req };
  if (!body.from_phone_number) delete body.from_phone_number;
  // retry_config and scheduled_at are omitted on purpose: we redial and schedule ourselves.
  try {
    return await request<MakeCallResponse>("POST", "/call", body);
  } catch (err) {
    // 429: a newly bought number still activating. Wait once if the delay is short.
    if (err instanceof BolnaError && err.httpStatus === 429 && err.retryAfterSeconds && err.retryAfterSeconds <= 5) {
      await new Promise((r) => setTimeout(r, err.retryAfterSeconds! * 1000));
      return request<MakeCallResponse>("POST", "/call", body);
    }
    throw err;
  }
}

/** Only works while the call is queued or scheduled. */
export async function stopCall(executionId: string): Promise<void> {
  if (isSimulatedExecution(executionId)) return;
  await request("POST", `/call/${encodeURIComponent(executionId)}/stop`);
}

/** Recover a missed webhook. */
export async function getExecution(executionId: string): Promise<Record<string, unknown>> {
  return request("GET", `/executions/${encodeURIComponent(executionId)}`);
}
