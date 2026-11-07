-- Haazir — what each call cost and how long the conversation ran, as Bolna reports it at `completed`.
-- Feeds the Analytics proof figures (median call length, cost per referral). Neither is an identifier.
alter table call_attempts add column if not exists cost double precision;
alter table call_attempts add column if not exists duration_s integer;
