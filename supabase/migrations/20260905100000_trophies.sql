-- Gamification (issue #18) : trophées débloqués après chaque séance terminée,
-- persistés en base plutôt que recalculés à la volée pour l'affichage (l'écran
-- /trophies ne fait que lire `user_trophies`). Trois familles, référentiel
-- fermé côté TypeScript dans `lib/trophies/definitions.ts` :
--   - streak (jours consécutifs)
--   - région (nombre de séances touchant chaque région, via la zone primaire)
--   - volume horaire total, toutes séances confondues
--
-- `user_trophies` ne connaît que la clé de trophée (`trophy_key`, miroir des
-- `key` de `TROPHY_DEFINITIONS`), jamais le calcul lui-même.

create table user_trophies (
  user_id     uuid not null references auth.users(id) on delete cascade,
  trophy_key  text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, trophy_key)
);

alter table user_trophies enable row level security;

-- Même formulation que les policies de 20260902120400_rls.sql (auth.uid()
-- encapsulé dans un sous-select, évalué une fois par requête). Select et insert
-- seulement : un trophée débloqué n'est jamais modifié ni retiré depuis le
-- client, `unlockTrophies` ne fait qu'un upsert idempotent à l'insertion.
create policy user_trophies_select_own on user_trophies
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy user_trophies_insert_own on user_trophies
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Progression pour l'évaluation des trophées région/volume (Lot gamification).
-- Même principe exact que `session_history_summary()` : part des régions
-- distinctes de `zones` (`left join`) pour qu'une région sans séance apparaisse
-- à zéro plutôt que de disparaître, `cross join` avec un total global calculé
-- une seule fois. Le comptage par région est un `count(distinct session_id)` :
-- une séance avec deux exercices de la même région ne doit compter qu'une fois.
--
-- Une séance compte pour une région si elle contient au moins un
-- `session_items` dont l'exercice a une zone primaire (`exercise_zones.is_primary`)
-- appartenant à cette région.
--
-- Pas de qualificatif `security definer` : une fonction SQL est `security
-- invoker` par défaut, donc la RLS de `sessions`/`session_items` s'applique
-- normalement à l'appelant.

create or replace function trophy_region_progress()
returns table (
  region_code text,
  region_session_count int,
  total_volume_s int
)
language sql
stable
as $$
  with relevant_sessions as (
    select id, actual_duration_s
    from sessions
    where status = 'completed'
  ),
  relevant_primary_items as (
    select distinct si.session_id, ez.zone_code
    from session_items si
    join relevant_sessions rs on rs.id = si.session_id
    join exercise_zones ez on ez.exercise_id = si.exercise_id and ez.is_primary
  ),
  region_sessions as (
    select
      z.region as region_code,
      count(distinct rpi.session_id)::int as region_session_count
    from relevant_primary_items rpi
    join zones z on z.code = rpi.zone_code
    group by z.region
  ),
  distinct_regions as (
    select region as region_code, min(sort) as region_sort
    from zones
    group by region
  ),
  totals as (
    select coalesce(sum(actual_duration_s), 0)::int as total_volume_s
    from relevant_sessions
  )
  select
    r.region_code,
    coalesce(rs.region_session_count, 0) as region_session_count,
    t.total_volume_s
  from distinct_regions r
  left join region_sessions rs on rs.region_code = r.region_code
  cross join totals t
  order by r.region_sort;
$$;

comment on function trophy_region_progress() is
  'Nombre de séances completed touchant chaque région (via la zone primaire des exercices) et volume horaire total, régions à zéro incluses. Lecture seule.';

revoke all on function trophy_region_progress() from public, anon;
grant execute on function trophy_region_progress() to authenticated;
