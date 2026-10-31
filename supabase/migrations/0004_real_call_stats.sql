-- Haazir — hospital track record counts real calls only.
-- Simulated referrals (demo rehearsals, the stage fallback) used to feed facility_stats and the per-number
-- answer counts, which drive ranking ("accepted 3 of 4 recent") and the answer-rate score.

create or replace view facility_stats as
select
  f.id                                                                                         as facility_id,
  count(a.id) filter (where a.purpose = 'availability')                                        as availability_calls,
  count(a.id) filter (where a.purpose = 'availability' and a.answered_at is not null)          as answered,
  count(a.id) filter (where a.purpose = 'availability' and a.outcome in ('accepted','conditional')) as accepted,
  max(a.created_at)                                                                            as last_called_at
from facilities f
left join call_attempts a
  on a.facility_id = f.id
 and not exists (select 1 from referrals r where r.id = a.referral_id and r.is_simulated)
 and coalesce(a.bolna_execution_id, '') not like 'sim\_%'
group by f.id;

-- Recount per-number stats from real, finished calls.
update facility_contacts c
set calls_made = s.made,
    calls_answered = s.answered
from (
  select fc.id,
         count(a.id) filter (where a.status in ('completed','no_answer','busy','failed'))::int as made,
         count(a.id) filter (where a.status in ('completed','no_answer','busy','failed') and a.answered_at is not null)::int as answered
  from facility_contacts fc
  left join call_attempts a
    on a.contact_id = fc.id
   and coalesce(a.bolna_execution_id, '') not like 'sim\_%'
  group by fc.id
) s
where s.id = c.id;
