import type { ZodType, ZodTypeDef } from "zod";

/** A failed call: the server's stable error code and message, or NETWORK, TIMEOUT or BAD_RESPONSE. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiConfig {
  baseUrl: string;
  token: string | null;
  /** Called on a 401 for a signed-in call, so the app can return to the sign-in screen. */
  onUnauthorized: () => void;
}

const TIMEOUT_MS = 20_000;
let config: ApiConfig | null = null;

/** Sets the server and token every later call uses. Called by the session provider. */
export function configureApi(next: ApiConfig | null): void {
  config = next;
}

export interface CallOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Send the mobile marker so the server returns the session token in the body. */
  mobileLogin?: boolean;
  signal?: AbortSignal;
  /** Overrides the configured server (sign-in runs before one is configured). */
  baseUrl?: string;
}

const messageOf = (body: unknown, fallback: string): { code: string; message: string } => {
  const e = body && typeof body === "object" ? (body as { error?: { code?: unknown; message?: unknown } }).error : undefined;
  return { code: typeof e?.code === "string" ? e.code : "ERROR", message: typeof e?.message === "string" ? e.message : fallback };
};

/**
 * Calls the Haazir API and checks the answer against a schema. Throws ApiError, never returns an unchecked value.
 * Every console route answers `{ error: { code, message } }` on failure.
 */
export async function api<T>(path: string, schema: ZodType<T, ZodTypeDef, unknown>, opts: CallOptions = {}): Promise<T> {
  const baseUrl = opts.baseUrl ?? config?.baseUrl;
  if (!baseUrl) throw new ApiError(0, "NO_SERVER", "Enter the Haazir server address first");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  opts.signal?.addEventListener("abort", () => ctl.abort());
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.mobileLogin) headers["x-haazir-client"] = "mobile";
  if (config?.token && !opts.baseUrl) headers.Authorization = `Bearer ${config.token}`;
  let res: Response;
  try {
    res = await fetch(baseUrl + path, {
      method: opts.method ?? (opts.body === undefined ? "GET" : "POST"),
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: ctl.signal,
    });
  } catch (err) {
    if (opts.signal?.aborted) throw err;
    const timedOut = ctl.signal.aborted;
    throw new ApiError(0, timedOut ? "TIMEOUT" : "NETWORK", timedOut ? "The server took too long to answer" : "Can't reach the server. Check the address and your connection.");
  } finally {
    clearTimeout(timer);
  }
  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const { code, message } = messageOf(data, `Request failed (${res.status})`);
    if (res.status === 401 && !opts.baseUrl && !opts.mobileLogin) config?.onUnauthorized();
    throw new ApiError(res.status, code, message);
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) {
    throw new ApiError(res.status, "BAD_RESPONSE", "The server sent something this version of the app doesn't understand. Update the app.");
  }
  return parsed.data;
}
