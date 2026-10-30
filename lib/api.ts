import "server-only";
import { NextResponse } from "next/server";
import type { ZodType, ZodTypeDef } from "zod";
import { AppError } from "./repo";

// Helpers for thin route handlers: parse with zod, map errors to { error: { code, message, details } }.

export function errorResponse(status: number, code: string, message: string, details: Record<string, unknown> = {}) {
  return NextResponse.json({ error: { code, message, details } }, { status });
}

export async function parseBody<T>(req: Request, schema: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new AppError(400, "INVALID_JSON", "Request body must be JSON");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError(422, "VALIDATION_FAILED", "Invalid request", { issues: parsed.error.issues });
  }
  return parsed.data;
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AppError) return errorResponse(err.status, err.code, err.message, err.details);
    console.error("[haazir] route error", err instanceof Error ? err.message : err);
    return errorResponse(500, "INTERNAL", "Something went wrong");
  }
}
