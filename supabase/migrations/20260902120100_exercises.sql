-- Banque d'exercices. Jamais éditée depuis l'interface : la source de vérité est
-- data/exercises.json, poussée par `npm run seed`.

create table exercises (
  id                uuid primary key default gen_random_uuid(),
  slug              text unique not null,
  name              text not null,
  instructions      text[] not null check (array_length(instructions, 1) between 1 and 6),
  type              exercise_type not null,
  position          body_position not null,
  symmetry          symmetry_type not null,
  intensity         int not null check (intensity between 1 and 3),
  duration_target_s int not null check (duration_target_s between 10 and 600),
  duration_min_s    int not null,
  duration_max_s    int not null,
  contraindications text,
  notes             text,
  media_url         text,
  active            boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (duration_min_s <= duration_target_s and duration_target_s <= duration_max_s),
  check (duration_min_s >= 10)
);

comment on column exercises.position is
  'Champ interne. Regroupement dans l''ordre de la séance. Jamais affiché, jamais filtrable.';
comment on column exercises.intensity is
  'Champ interne. Consommé par le générateur pour l''ordonnancement. Jamais affiché.';
comment on column exercises.duration_target_s is
  'En secondes. Sur un exercice asymétrique, durée d''un seul côté.';
comment on column exercises.active is
  'Passe à false quand un slug disparaît de data/exercises.json. On ne supprime jamais : session_items référence les exercices.';

create index exercises_active_idx on exercises (active) where active;
create index exercises_type_idx on exercises (type);

create table exercise_zones (
  exercise_id uuid not null references exercises(id) on delete cascade,
  zone_code   text not null references zones(code),
  is_primary  boolean not null default false,
  primary key (exercise_id, zone_code)
);

-- exactement une zone primaire par exercice
create unique index exercise_one_primary_zone
  on exercise_zones (exercise_id) where is_primary;

create index exercise_zones_zone_idx on exercise_zones (zone_code);

create table exercise_equipment (
  exercise_id    uuid not null references exercises(id) on delete cascade,
  equipment_code text not null references equipment(code),
  primary key (exercise_id, equipment_code)
);

create index exercise_equipment_code_idx on exercise_equipment (equipment_code);
