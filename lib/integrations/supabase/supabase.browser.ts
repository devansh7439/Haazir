"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser client for Realtime only. Rows are filtered by org-scoped RLS using a short-lived token from
// /api/realtime-token. No Supabase config, or no token = the board refreshes on each tick instead.
let client: SupabaseClient | null | undefined;

export function browserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
  return client;
}

/** Fetches the org-scoped token and applies it to Realtime. Returns false when realtime isn't available. */
export async function authorizeRealtime(sb: SupabaseClient): Promise<boolean> {
  try {
    const res = await fetch("/api/realtime-token", { cache: "no-store" });
    if (!res.ok) return false;
    const { token } = (await res.json()) as { token: string | null };
    if (!token) return false;
    await sb.realtime.setAuth(token);
    return true;
  } catch {
    return false;
  }
}
