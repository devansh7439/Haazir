-- Haazir — concurrency guards and server-only settings
-- Webhooks, function calls and console ticks can run evaluateReferral at the same time.
-- These indexes make the follow-up calls it creates idempotent (insert ... on conflict do nothing).

-- At most one redial/callback child and one release call per attempt.
create unique index call_attempts_one_child_idx
  on call_attempts (parent_attempt_id, purpose)
  where parent_attempt_id is not null and purpose in ('availability', 'release');

-- Events that must be logged once per referral.
create unique index events_once_per_referral_idx
  on events (referral_id, type)
  where type in ('hold_expired', 'options_ready', 'referral_exhausted');

-- Small key/value store for demo settings (e.g. the family phone). Server-only: no RLS policy.
create table app_settings (
  key         text primary key,
  value       text,
  updated_at  timestamptz not null default now()
);
alter table app_settings enable row level security;
