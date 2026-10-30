import "server-only";
import { timingSafeEqual } from "node:crypto";
import { BOLNA_IPS, env } from "./config";

// Bolna → app authentication (docs/02-architecture.md §11).
// Webhook: ?token=<BOLNA_WEBHOOK_SECRET> or an x-haazir-token header. Functions: Authorization: Bearer <BOLNA_FUNCTION_SECRET>.
// An unset secret rejects everything, so a misconfigured deploy fails closed.

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** The caller's IP as Vercel (or any proxy) reports it: the first entry of x-forwarded-for. */
export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return (req.headers.get("x-real-ip") ?? "").trim();
}

/** Optional extra check (BOLNA_IP_ALLOWLIST=on): requests must come from Bolna's documented IPs. Never the only check. */
export function ipAllowed(req: Request): boolean {
  if (!env.bolnaIpAllowlist) return true;
  return [...BOLNA_IPS, ...env.bolnaExtraIps].includes(clientIp(req));
}

export function webhookAuthorized(req: Request): boolean {
  const secret = env.bolnaWebhookSecret;
  if (!secret || !ipAllowed(req)) return false;
  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-haazir-token") ?? "";
  return same(token, secret);
}

export function functionAuthorized(req: Request): boolean {
  const secret = env.bolnaFunctionSecret;
  if (!secret || !ipAllowed(req)) return false;
  const header = req.headers.get("authorization") ?? "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  return same(token, secret);
}
