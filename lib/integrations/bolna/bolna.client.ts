import "server-only";
import { z } from "zod";
import { env } from "@/lib/core/config";
import { isRecord, readField, toBolnaStatus } from "@/lib/core/normalize";
import { BOLNA_STATUSES, type BolnaStatus } from "@/lib/core/types";

// Bolna REST client (docs/04-api-spec.md §6).

export interface MakeCallRequest {
  agent_id: string;
  recipient_phone_number: string;
  from_phone_number?: string;
  user_data: Record<string, string>;
  agent_data: { language: string };
  bypass_call_guardrails: true;
}

export { BOLNA_STATUSES, toBolnaStatus, type BolnaStatus };

/** POST /call's answer. A status we don't know becomes null rather than an error: the call was still queued. */
const MakeCallResponseSchema = z
  .object({ execution_id: z.string().min(1), status: z.string().optional() })
  .transform((r) => ({ execution_id: r.execution_id, status: toBolnaStatus(r.status) }));
export type MakeCallResponse = z.infer<typeof MakeCallResponseSchema>;

/** A failed Bolna request: its HTTP status (0 when none was made) and the delay Bolna asked for, if any. */
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

/** One request to Bolna. The caller checks the shape of what comes back; nothing is assumed here. */
async function request(method: string, path: string, body?: unknown): Promise<unknown> {
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
    const reason = readField(data, "message") ?? readField(data, "error") ?? readField(data, "detail");
    const message = String(reason ?? `Bolna ${method} ${path} failed with ${res.status}`);
    const retry = Number(readField(data, "retry_after_seconds") ?? res.headers.get("retry-after"));
    throw new BolnaError(message, res.status, Number.isFinite(retry) && retry > 0 ? retry : null);
  }
  return data;
}

/** Places one call. Waits once and retries when Bolna answers 429 with a short delay; otherwise throws `BolnaError`. */
export async function makeCall(req: MakeCallRequest): Promise<MakeCallResponse> {
  if (!req.agent_id) throw new BolnaError("Bolna agent ID is not configured for this call type", 0);
  const body: MakeCallRequest = { ...req };
  if (!body.from_phone_number) delete body.from_phone_number;
  // retry_config and scheduled_at are omitted on purpose: we redial and schedule ourselves.
  try {
    return MakeCallResponseSchema.parse(await request("POST", "/call", body));
  } catch (err) {
    // 429: a newly bought number still activating. Wait once if the delay is short.
    if (err instanceof BolnaError && err.httpStatus === 429 && err.retryAfterSeconds && err.retryAfterSeconds <= 5) {
      await new Promise((r) => setTimeout(r, err.retryAfterSeconds! * 1000));
      return MakeCallResponseSchema.parse(await request("POST", "/call", body));
    }
    throw err;
  }
}

/** Only works while the call is queued or scheduled. */
export async function stopCall(executionId: string): Promise<void> {
  await request("POST", `/call/${encodeURIComponent(executionId)}/stop`);
}

/** Recover a missed webhook. */
export async function getExecution(executionId: string): Promise<Record<string, unknown>> {
  const data = await request("GET", `/executions/${encodeURIComponent(executionId)}`);
  return isRecord(data) ? data : {};
}
