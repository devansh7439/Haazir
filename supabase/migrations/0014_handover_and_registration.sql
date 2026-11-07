-- Haazir — handover facts on a referral, and the referring doctor's medical registration.
-- Handover facts (pregnancy, trauma mechanism, infectious risk, treatment given, blood group, blood needed) are what a
-- receiving doctor asks after the vitals. None identify the patient. Pregnancy, trauma mechanism, infectious risk and
-- blood needed are read to every desk; treatment given and blood group are only given to the agent to answer a desk
-- that asks. Existing rows keep "unknown" / null.
alter table referrals add column if not exists pregnancy_weeks smallint check (pregnancy_weeks between 1 and 45);
alter table referrals add column if not exists trauma_mechanism text not null default 'unknown'
  check (trauma_mechanism in ('not_trauma', 'road_accident', 'fall', 'assault', 'burn', 'penetrating', 'other', 'unknown'));
alter table referrals add column if not exists infectious_risk text not null default 'unknown'
  check (infectious_risk in ('none', 'airborne', 'contact', 'bloodborne', 'unknown'));
alter table referrals add column if not exists treatment_given text check (char_length(treatment_given) <= 160);
alter table referrals add column if not exists blood_group text not null default 'unknown'
  check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'));
alter table referrals add column if not exists blood_needed boolean;

-- Registration of the referring doctor. A doctor who has not been checked is "unverified"; an admin sets
-- "verified" or "rejected" after looking the number up in the NMC Indian Medical Register or the state council's.
alter table referrers add column if not exists registration_no text check (char_length(registration_no) <= 32);
alter table referrers add column if not exists registration_council text check (char_length(registration_council) <= 60);
alter table referrers add column if not exists verification_status text not null default 'unverified'
  check (verification_status in ('unverified', 'pending', 'verified', 'rejected'));
alter table referrers add column if not exists verified_at timestamptz;
alter table referrers add column if not exists verified_by uuid references app_users(id);
