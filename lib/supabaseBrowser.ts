"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Browser client for Realtime only (anon key, read-only RLS). Absent config = the board polls via tick.
let client: SupabaseClient | null | undefined;

export function browserSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}
