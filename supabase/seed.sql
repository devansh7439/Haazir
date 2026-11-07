-- Haazir — reference data: the capabilities a hospital can have and the case types a doctor can pick.
-- No hospitals, desk numbers or doctors live here: add your own, or load the fictional demo directory with
-- `bun run db:setup -- --demo` (supabase/demo-directory.sql).

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
