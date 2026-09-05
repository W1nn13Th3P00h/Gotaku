-- Réglages de personnalisation : pratique sportive et grande zone de mobilité
-- (déficit majeur). Deux nouveaux référentiels fermés, chacun avec sa table
-- d'association vers `zones`, sur le modèle de `20260902120000_enums_and_referentials.sql`.
-- `user_settings` gagne trois colonnes pour porter ces réglages, sur le modèle de
-- `20260904090000_user_settings.sql`.

create table mobility_focuses (
  code  text primary key,
  label text not null,
  sort  int  not null
);

comment on table mobility_focuses is
  'Grandes zones de mobilité de la catégorie "Zones de mobilité" des séances programmées.';

insert into mobility_focuses (code, label, sort) values
  ('posterior_chain', 'Chaîne postérieure', 1),
  ('shoulders', 'Épaules', 2),
  ('overhead', 'Au-dessus de la tête', 3),
  ('hips_pelvis', 'Hanches et bassin', 4);

create table mobility_focus_zones (
  focus_code text not null references mobility_focuses(code),
  zone_code  text not null references zones(code),
  primary key (focus_code, zone_code)
);

insert into mobility_focus_zones (focus_code, zone_code) values
  ('posterior_chain', 'calves'), ('posterior_chain', 'hamstrings'), ('posterior_chain', 'glutes'),
  ('posterior_chain', 'lumbar'), ('posterior_chain', 'lats'),
  ('shoulders', 'neck'), ('shoulders', 'shoulders'), ('shoulders', 'shoulder_rotators'),
  ('shoulders', 'traps'), ('shoulders', 'pecs'),
  ('overhead', 'shoulders'), ('overhead', 'shoulder_rotators'), ('overhead', 'lats'),
  ('overhead', 'thoracic'), ('overhead', 'triceps'),
  ('hips_pelvis', 'hip_flexors'), ('hips_pelvis', 'hip_rotators'), ('hips_pelvis', 'glutes'),
  ('hips_pelvis', 'adductors');

create table practices (
  code  text primary key,
  label text not null,
  sort  int  not null
);

comment on table practices is
  'Pratiques sportives réglables par l''utilisateur, source de la catégorie "Sports" des séances programmées.';

insert into practices (code, label, sort) values
  ('trail', 'Trail', 1),
  ('running', 'Course à pied', 2),
  ('cycling', 'Cyclisme', 3),
  ('mtb', 'VTT', 4),
  ('racquet_sports', 'Sports de raquette', 5),
  ('yoga', 'Yoga', 6),
  ('dance', 'Danse', 7);

create table practice_zones (
  practice_code text not null references practices(code),
  zone_code     text not null references zones(code),
  primary key (practice_code, zone_code)
);

insert into practice_zones (practice_code, zone_code) values
  ('trail', 'calves'), ('trail', 'shins'), ('trail', 'post_shins'), ('trail', 'ankles'),
  ('trail', 'hamstrings'), ('trail', 'quads'), ('trail', 'it_bands'), ('trail', 'glutes'),
  ('trail', 'hip_flexors'),
  ('running', 'calves'), ('running', 'shins'), ('running', 'hamstrings'), ('running', 'quads'),
  ('running', 'it_bands'), ('running', 'hip_flexors'), ('running', 'glutes'),
  ('cycling', 'quads'), ('cycling', 'hip_flexors'), ('cycling', 'lumbar'), ('cycling', 'neck'),
  ('cycling', 'shoulders'), ('cycling', 'hamstrings'),
  ('mtb', 'quads'), ('mtb', 'hip_flexors'), ('mtb', 'lumbar'), ('mtb', 'neck'),
  ('mtb', 'shoulders'), ('mtb', 'forearm_flexors'), ('mtb', 'forearm_extensors'),
  ('racquet_sports', 'shoulders'), ('racquet_sports', 'shoulder_rotators'), ('racquet_sports', 'pecs'),
  ('racquet_sports', 'forearm_flexors'), ('racquet_sports', 'forearm_extensors'),
  ('racquet_sports', 'obliques'), ('racquet_sports', 'hip_rotators'),
  ('yoga', 'hip_flexors'), ('yoga', 'hip_rotators'), ('yoga', 'hamstrings'), ('yoga', 'shoulders'),
  ('yoga', 'thoracic'), ('yoga', 'lumbar'),
  ('dance', 'hip_rotators'), ('dance', 'adductors'), ('dance', 'calves'), ('dance', 'ankles'),
  ('dance', 'thoracic'), ('dance', 'obliques');

-- `main_practice` doit appartenir aux `practices` de l'utilisateur : validé côté
-- application (lib/settings/queries.ts), pas ici, cohérent avec le reste du projet.
alter table user_settings
  add column practices           text[] not null default '{}',
  add column main_practice       text references practices(code),
  add column major_deficit_focus text references mobility_focuses(code);

-- RLS, même pattern que zones/equipment : lecture pour tout utilisateur
-- authentifié, aucune écriture (seed via clé de service uniquement).
alter table mobility_focuses enable row level security;
alter table mobility_focus_zones enable row level security;
alter table practices enable row level security;
alter table practice_zones enable row level security;

create policy mobility_focuses_read on mobility_focuses
  for select to authenticated using (true);
create policy mobility_focus_zones_read on mobility_focus_zones
  for select to authenticated using (true);
create policy practices_read on practices
  for select to authenticated using (true);
create policy practice_zones_read on practice_zones
  for select to authenticated using (true);
