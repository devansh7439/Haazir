-- Haazir — simulation mode and the Demo console are gone. Remove what they left behind.
-- Simulated referrals and Demo-page test calls were fictional or self-test calls; their calls, events and messages
-- go with them (on delete cascade).
delete from referrals where is_simulated or close_reason = 'test_call';
delete from call_attempts where bolna_execution_id like 'sim\_%';

drop table if exists test_matrix_results;

create or replace view facility_stats as
select
  f.id                                                                                         as facility_id,
  count(a.id) filter (where a.purpose = 'availability')                                        as availability_calls,
  count(a.id) filter (where a.purpose = 'availability' and a.answered_at is not null)          as answered,
  count(a.id) filter (where a.purpose = 'availability' and a.outcome in ('accepted','conditional')) as accepted,
  max(a.created_at)                                                                            as last_called_at
from facilities f
left join call_attempts a on a.facility_id = f.id
group by f.id;
alter view facility_stats set (security_invoker = true);

alter table referrals drop column is_simulated;

alter table call_attempts drop constraint if exists call_attempts_outcome_source_check;
alter table call_attempts add constraint call_attempts_outcome_source_check
  check (outcome_source in ('function', 'extraction', 'manual', 'whatsapp'));
