import "server-only";
import { NextResponse } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { ApiError } from "@/lib/core/error";
import { createLogger } from "@/lib/core/logger";

const log = createLogger("route");

// Helpers for thin route handlers: parse with zod, map errors to { error: { code, message, details } }.

export function errorResponse(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  // Only JSON: a cross-site <form> can't send application/json, so this blocks form-based CSRF on top of SameSite cookies.
  if (!(req.headers.get("content-type") ?? "").toLowerCase().includes("application/json")) {
    throw ApiError.unsupportedMediaType("Send the request as application/json");
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw ApiError.badRequest("INVALID_JSON", "Request body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    // Name the first problem ("phone: too short") so the console can show something useful.
    const first = parsed.error.issues[0];
    const field = first?.path.filter((p) => typeof p === "string").join(".") || "request";
    const message = first ? `${field.replace(/_/g, " ")}: ${first.message.replace(/^String must contain at least (\d+) character\(s\)$/, "too short (at least $1 characters)")}` : "Invalid request";
    throw ApiError.unprocessable("VALIDATION_FAILED", message, { issues: parsed.error.issues });
  }
  return parsed.data;
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiError) return errorResponse(err.status, err.code, err.message, err.details);
    log.error({ err }, "Route error");
    return errorResponse(500, "INTERNAL", "Something went wrong");
  }
}
