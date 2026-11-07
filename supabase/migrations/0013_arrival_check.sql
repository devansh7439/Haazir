-- Haazir — the arrival check: one call to the chosen hospital, a few minutes after the patient was due, asking whether
-- they have arrived. Adds the purpose and its two outcomes, and allows at most one such call per referral.
alter table call_attempts drop constraint call_attempts_purpose_check;
alter table call_attempts add constraint call_attempts_purpose_check
  check (purpose in ('availability','hold_confirm','release','family_update','arrival_check'));

alter table call_attempts drop constraint call_attempts_outcome_check;
alter table call_attempts add constraint call_attempts_outcome_check
  check (outcome in ('accepted','conditional','declined','redirected','needs_doctor','callback_later','ivr_blocked','unclear',
                     'hold_confirmed','hold_declined','release_ack','family_informed','arrival_confirmed','not_arrived'));

-- Concurrent evaluations plan the same check; the second insert does nothing (insert ... on conflict do nothing).
create unique index call_attempts_one_arrival_check_idx
  on call_attempts (referral_id)
  where purpose = 'arrival_check';
