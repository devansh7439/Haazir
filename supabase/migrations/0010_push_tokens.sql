-- Haazir — Expo push tokens for the mobile app, so a doctor hears about a first yes, a desk asking for them or a held
-- bed with the app closed. Server-only: row level security with no policies, like login_failures. A token belongs to one
-- device; signing in on it as someone else moves it. user_id is null in passcode mode (one shared sign-in).
create table push_tokens (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organisations(id) on delete cascade,
  user_id      uuid references app_users(id) on delete cascade,
  token        text not null unique,
  platform     text not null check (platform in ('ios', 'android', 'web')),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index push_tokens_org_idx on push_tokens (org_id);
alter table push_tokens enable row level security;
