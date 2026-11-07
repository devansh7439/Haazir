-- Haazir — structured clinical facts on a referral (airway, SpO2, GCS, oxygen, payer, medico-legal case).
-- None are identifiers. Airway, SpO2, GCS and oxygen are read to every desk in the spoken summary; payer and the
-- medico-legal flag are only given to the agent to answer a desk that asks. Existing rows keep "unknown" / null.
alter table referrals add column if not exists airway text not null default 'unknown' check (airway in ('intubated', 'own', 'unknown'));
alter table referrals add column if not exists spo2 smallint check (spo2 between 0 and 100);
alter table referrals add column if not exists gcs smallint check (gcs between 3 and 15);
alter table referrals add column if not exists on_oxygen boolean;
alter table referrals add column if not exists payer text not null default 'unknown' check (payer in ('free_govt', 'pmjay', 'insurance', 'cash', 'unknown'));
alter table referrals add column if not exists medico_legal boolean;
