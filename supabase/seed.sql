-- Haazir — reference data and demo directory
-- All hospitals below are FICTIONAL and marked is_demo = true. Coordinates are around Hoskote/Bengaluru.
-- Before any real call: replace every +9100000001xx / +9100000002xx placeholder with a phone you control
-- (or use the Demo page, which does this for you).

-- ------------------------------------------------------------
-- Capabilities (static; live availability is asked on the call)
-- ------------------------------------------------------------
insert into capabilities (code, label, spoken_en, category) values
  ('icu_bed',             'ICU bed',                   'an ICU bed',                     'bed'),
  ('hdu_bed',             'HDU bed',                   'a high-dependency bed',          'bed'),
  ('nicu_l3',             'NICU (level III)',          'a level-three NICU bed',         'bed'),
  ('burns_unit',          'Burns unit',                'a burns unit bed',               'bed'),
  ('ventilator',          'Ventilator',                'a ventilator',                   'equipment'),
  ('neonatal_ventilator', 'Neonatal ventilator',       'a neonatal ventilator',          'equipment'),
  ('ct_24x7',             'CT scan (24x7)',            'a CT scan available now',        'service'),
  ('cath_lab_24x7',       'Cath lab (24x7)',           'a cath lab team available now',  'service'),
  ('ot_24x7',             'Emergency OT',              'an emergency operation theatre', 'service'),
  ('blood_bank',          'Blood bank',                'blood available',                'service'),
  ('dialysis',            'Dialysis',                  'dialysis',                       'service'),
  ('neurosurgeon',        'Neurosurgeon on call',      'a neurosurgeon',                 'specialist'),
  ('cardiologist',        'Cardiologist on call',      'a cardiologist',                 'specialist'),
  ('neurologist',         'Neurologist on call',       'a neurologist',                  'specialist'),
  ('obstetrician',        'Obstetrician (24x7)',       'an obstetrician',                'specialist'),
  ('paediatrician',       'Paediatrician on call',     'a paediatrician',                'specialist'),
  ('trauma_team',         'Trauma team',               'a trauma team',                  'specialist'),
  ('asv_stock',           'Anti-snake venom in stock', 'anti-snake venom',               'drug')
on conflict (code) do nothing;

-- ------------------------------------------------------------
-- Case templates (defaults the doctor can edit; NOT clinician-reviewed yet)
-- ------------------------------------------------------------
insert into case_templates (case_type, label, spoken_en, default_capabilities) values
  ('snakebite_neuro', 'Snakebite - neurotoxic signs',      'suspected snakebite with neurotoxic signs', '{icu_bed,ventilator}'),
  ('snakebite_haemo', 'Snakebite - bleeding signs',        'suspected snakebite with bleeding signs',   '{icu_bed,blood_bank,dialysis}'),
  ('head_injury',     'Severe head injury',                'severe head injury',                        '{ct_24x7,neurosurgeon,icu_bed}'),
  ('stemi',           'Heart attack (STEMI)',              'suspected heart attack',                    '{cath_lab_24x7,cardiologist,icu_bed}'),
  ('stroke',          'Acute stroke',                      'suspected acute stroke',                    '{ct_24x7,neurologist,icu_bed}'),
  ('preterm_newborn', 'Preterm / sick newborn',            'sick preterm newborn',                      '{nicu_l3,neonatal_ventilator}'),
  ('obstetric_bleed', 'Obstetric haemorrhage',             'obstetric emergency with heavy bleeding',   '{obstetrician,blood_bank,ot_24x7,icu_bed}'),
  ('major_burns',     'Major burns',                       'major burns',                               '{burns_unit,icu_bed}'),
  ('poisoning',       'Poisoning (e.g. organophosphate)',  'suspected poisoning',                       '{icu_bed,ventilator}'),
  ('polytrauma',      'Major trauma',                      'major trauma',                              '{trauma_team,ct_24x7,ot_24x7,blood_bank,icu_bed}'),
  ('other',           'Other',                             'an emergency',                              '{}')
on conflict (case_type) do nothing;

-- ------------------------------------------------------------
-- Demo facilities (fictional)
-- ------------------------------------------------------------
insert into facilities (id, name, kind, ownership, address, city, district, lat, lng, call_language, is_demo, notes) values
  ('00000000-0000-4000-8000-000000000100', 'Hoskote PHC (Demo)',                          'phc',               'public',  'Demo address', 'Hoskote',   'Bengaluru Rural', 13.0707, 77.7982, 'kn', true, 'Referring facility in the demo story'),
  ('00000000-0000-4000-8000-000000000101', 'Banyan Multispeciality Hospital (Demo)',      'private_hospital',  'private', 'Demo address', 'Bengaluru', 'Bengaluru Urban', 12.9698, 77.7500, 'en', true, 'Judge card 2: accepts'),
  ('00000000-0000-4000-8000-000000000102', 'Neem Trauma & Neuro Centre (Demo)',           'private_hospital',  'private', 'Demo address', 'Bengaluru', 'Bengaluru Urban', 13.0050, 77.6960, 'en', true, 'Judge card 3: declines'),
  ('00000000-0000-4000-8000-000000000103', 'Tamarind District Hospital (Demo)',           'district_hospital', 'public',  'Demo address', 'Hoskote',   'Bengaluru Rural', 13.1180, 77.7650, 'kn', true, 'Judge card 1: Kannada, accepts with a condition'),
  ('00000000-0000-4000-8000-000000000104', 'Mango Grove Medical College Hospital (Demo)', 'medical_college',   'public',  'Demo address', 'Bengaluru', 'Bengaluru Urban', 13.0360, 77.6200, 'en', true, 'Judge card 5: hold on, then accepts'),
  ('00000000-0000-4000-8000-000000000105', 'Jasmine Heart Institute (Demo)',              'private_hospital',  'private', 'Demo address', 'Bengaluru', 'Bengaluru Urban', 12.9560, 77.7010, 'en', true, 'Judge card 4: asks for the doctor'),
  ('00000000-0000-4000-8000-000000000106', 'Lotus Burns & Plastic Centre (Demo)',         'private_hospital',  'private', 'Demo address', 'Bengaluru', 'Bengaluru Urban', 12.9900, 77.5700, 'hi', true, 'Judge card 6: does not answer'),
  ('00000000-0000-4000-8000-000000000107', 'Peepal Women & Child Hospital (Demo)',        'private_hospital',  'private', 'Demo address', 'Bengaluru', 'Bengaluru Urban', 12.9784, 77.6408, 'en', true, 'Filtered out of the snakebite demo: no adult ICU'),
  ('00000000-0000-4000-8000-000000000108', 'Sandal Nursing Home (Demo)',                  'nursing_home',      'private', 'Demo address', 'Hoskote',   'Bengaluru Rural', 13.0600, 77.7700, 'kn', true, 'Filtered out: no ICU')
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- Contacts (PLACEHOLDER numbers; replace before calling)
-- ------------------------------------------------------------
insert into facility_contacts (facility_id, role, phone_e164, priority, is_ivr) values
  ('00000000-0000-4000-8000-000000000101', 'casualty_desk', '+910000000101', 1, false),
  ('00000000-0000-4000-8000-000000000101', 'reception',     '+910000000111', 2, true),
  ('00000000-0000-4000-8000-000000000102', 'casualty_desk', '+910000000102', 1, false),
  ('00000000-0000-4000-8000-000000000103', 'casualty_desk', '+910000000103', 1, false),
  ('00000000-0000-4000-8000-000000000104', 'referral_desk', '+910000000104', 1, false),
  ('00000000-0000-4000-8000-000000000105', 'casualty_desk', '+910000000105', 1, false),
  ('00000000-0000-4000-8000-000000000106', 'casualty_desk', '+910000000106', 1, false),
  ('00000000-0000-4000-8000-000000000107', 'casualty_desk', '+910000000107', 1, false),
  ('00000000-0000-4000-8000-000000000108', 'reception',     '+910000000108', 1, false)
on conflict (facility_id, phone_e164) do nothing;

-- ------------------------------------------------------------
-- Static capabilities per demo facility
-- ------------------------------------------------------------
insert into facility_capabilities (facility_id, capability_code)
select f.id, c.code
from (values
  ('00000000-0000-4000-8000-000000000100'::uuid, '{asv_stock}'::text[]),
  ('00000000-0000-4000-8000-000000000101'::uuid, '{icu_bed,hdu_bed,ventilator,ct_24x7,ot_24x7,blood_bank,dialysis,neurosurgeon,trauma_team,asv_stock}'::text[]),
  ('00000000-0000-4000-8000-000000000102'::uuid, '{icu_bed,ventilator,ct_24x7,ot_24x7,blood_bank,neurosurgeon,trauma_team}'::text[]),
  ('00000000-0000-4000-8000-000000000103'::uuid, '{icu_bed,ventilator,blood_bank,dialysis,obstetrician,paediatrician,asv_stock}'::text[]),
  ('00000000-0000-4000-8000-000000000104'::uuid, '{icu_bed,hdu_bed,nicu_l3,burns_unit,ventilator,neonatal_ventilator,ct_24x7,cath_lab_24x7,ot_24x7,blood_bank,dialysis,neurosurgeon,cardiologist,neurologist,obstetrician,paediatrician,trauma_team,asv_stock}'::text[]),
  ('00000000-0000-4000-8000-000000000105'::uuid, '{icu_bed,ventilator,cath_lab_24x7,cardiologist}'::text[]),
  ('00000000-0000-4000-8000-000000000106'::uuid, '{burns_unit,icu_bed,ventilator}'::text[]),
  ('00000000-0000-4000-8000-000000000107'::uuid, '{nicu_l3,neonatal_ventilator,obstetrician,paediatrician,blood_bank,ot_24x7}'::text[]),
  ('00000000-0000-4000-8000-000000000108'::uuid, '{}'::text[])
) as f(id, caps)
cross join lateral unnest(f.caps) as c(code)
on conflict do nothing;

-- ------------------------------------------------------------
-- Demo referring doctor (fictional)
-- ------------------------------------------------------------
insert into referrers (id, name, phone_e164, facility_id, languages) values
  ('00000000-0000-4000-8000-000000000201', 'Dr. Meera Rao (Demo)', '+910000000201', '00000000-0000-4000-8000-000000000100', '{en,kn,hi}')
on conflict (id) do nothing;
