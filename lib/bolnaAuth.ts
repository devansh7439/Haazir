import "server-only";
import { timingSafeEqual } from "node:crypto";
import { env } from "./config";

// Bolna → app authentication (docs/02-architecture.md §11).
// Webhook: ?token=<BOLNA_WEBHOOK_SECRET> or an x-haazir-token header. Functions: Authorization: Bearer <BOLNA_FUNCTION_SECRET>.
// An unset secret rejects everything, so a misconfigured deploy fails closed.

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function webhookAuthorized(req: Request): boolean {
  const secret = env.bolnaWebhookSecret;
  if (!secret) return false;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-haazir-token") ?? "";
  return same(token, secret);
}

export function functionAuthorized(req: Request): boolean {
  const secret = env.bolnaFunctionSecret;
  if (!secret) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return same(token, secret);
}
