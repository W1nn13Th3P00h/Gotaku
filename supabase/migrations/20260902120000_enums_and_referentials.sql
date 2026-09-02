-- Enums et référentiels fermés.
-- Miroir de docs/data-model.md. Aucune valeur ne s'ajoute ici sans être d'abord
-- ajoutée au document de référence et à lib/referentials.ts.

create type exercise_type as enum (
  'active_stretch', 'passive_stretch', 'massage', 'muscle_activation'
);

create type body_position as enum (
  'standing', 'wall', 'seated', 'quadruped', 'supine', 'prone', 'side_lying', 'hanging'
);

create type symmetry_type as enum ('symmetric', 'asymmetric');

create type session_status as enum ('draft', 'in_progress', 'completed', 'abandoned');

create type session_source as enum ('generated', 'manual', 'template');

create type item_status as enum ('pending', 'done', 'skipped');

create table zones (
  code   text primary key,
  label  text not null,
  region text not null,
  sort   int  not null
);

comment on column zones.region is
  'Regroupement d''interface et équilibrage de couverture du générateur. Jamais taggé sur un exercice.';

create table equipment (
  code  text primary key,
  label text not null,
  sort  int  not null
);

comment on table equipment is
  'Aucune valeur ne signifie l''absence de matériel. « Sans matériel » est une entrée d''interface, jamais une donnée.';

-- 26 zones, dans l'ordre d'affichage.
insert into zones (code, label, region, sort) values
  ('feet',              'Pieds',                       'foot_ankle',     10),
  ('ankles',            'Chevilles',                   'foot_ankle',     20),
  ('calves',            'Mollets',                     'lower_leg',      30),
  ('shins',             'Tibias antérieurs',           'lower_leg',      40),
  ('post_shins',        'Tibias postérieurs',          'lower_leg',      50),
  ('hamstrings',        'Ischio-jambiers',             'thigh',          60),
  ('quads',             'Quadriceps',                  'thigh',          70),
  ('adductors',         'Adducteurs',                  'thigh',          80),
  ('it_bands',          'Bandelettes ilio-tibiales',   'thigh',          90),
  ('glutes',            'Fessiers',                    'hip',           100),
  ('hip_flexors',       'Fléchisseurs de hanche',      'hip',           110),
  ('hip_rotators',      'Rotateurs de hanche',         'hip',           120),
  ('abs',               'Abdominaux',                  'core',          130),
  ('obliques',          'Obliques',                    'core',          140),
  ('lumbar',            'Lombaires',                   'back',          150),
  ('thoracic',          'Thoracique',                  'back',          160),
  ('lats',              'Dorsaux',                     'back',          170),
  ('traps',             'Trapèzes',                    'back',          180),
  ('neck',              'Cervicales',                  'neck',          190),
  ('shoulders',         'Épaules',                     'shoulder_chest', 200),
  ('shoulder_rotators', 'Rotateurs d''épaule',         'shoulder_chest', 210),
  ('pecs',              'Pectoraux',                   'shoulder_chest', 220),
  ('biceps',            'Biceps',                      'arm',           230),
  ('triceps',           'Triceps',                     'arm',           240),
  ('forearm_flexors',   'Fléchisseurs d''avant-bras',  'arm',           250),
  ('forearm_extensors', 'Extenseurs d''avant-bras',    'arm',           260);

-- 9 matériels.
insert into equipment (code, label, sort) values
  ('band',           'Élastique',           10),
  ('barbell',        'Barre',               20),
  ('box',            'Box',                 30),
  ('ball',           'Balle',               40),
  ('foam_roller',    'Rouleau de massage',  50),
  ('medicine_ball',  'Medicine ball',       60),
  ('pipe',           'Bâton',               70),
  ('weight',         'Poids',               80),
  ('percussion_gun', 'Pistolet de massage', 90);
