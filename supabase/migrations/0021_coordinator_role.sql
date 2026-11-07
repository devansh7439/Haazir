-- Haazir — the coordinator role and the record of who keyed a referral in.
-- A coordinator (an ambulance dispatcher, a transfer-desk nurse) places referrals for the doctors of their organisation but
-- cannot administer it. entered_by names the console user who typed the referral, so a referral placed under a doctor's
-- name always has a trace. It is null for a doctor's own referral made before this column existed.
alter table app_users drop constraint if exists app_users_role_check;
alter table app_users add constraint app_users_role_check check (role in ('admin', 'doctor', 'coordinator'));

alter table referrals add column if not exists entered_by uuid references app_users(id) on delete set null;
