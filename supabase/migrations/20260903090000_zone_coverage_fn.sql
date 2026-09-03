-- Tableau de couverture par zone (écran Banque, Lot 1). Une fonction SQL dédiée
-- plutôt qu'un `.select()` PostgREST avec agrégation embarquée : le `left join`
-- garantit qu'une zone sans exercice apparaît avec un compte de zéro (FR-008 de
-- `specs/001-exercise-bank-browse/spec.md`), et c'est testable contre PGlite,
-- contrairement à l'agrégation embarquée PostgREST (voir research.md de la feature).

create or replace function zone_coverage()
returns table (
  zone_code text,
  zone_label text,
  region_code text,
  exercise_count int
)
language sql
stable
as $$
  select
    z.code as zone_code,
    z.label as zone_label,
    z.region as region_code,
    count(e.id)::int as exercise_count
  from zones z
  left join exercise_zones ez on ez.zone_code = z.code
  left join exercises e on e.id = ez.exercise_id and e.active
  group by z.code, z.label, z.region, z.sort
  order by z.sort;
$$;

comment on function zone_coverage() is
  'Nombre d''exercices actifs par zone du référentiel, zones à zéro incluses. Lecture seule.';

-- Lecture pour l'utilisateur authentifié, comme le reste des référentiels et de la
-- banque (`exercises_read`, etc. dans 20260902120400_rls.sql).
revoke all on function zone_coverage() from public, anon;
grant execute on function zone_coverage() to authenticated;
