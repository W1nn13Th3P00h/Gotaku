-- Synthèse 30 jours (écran Historique, Lot 3). Une fonction SQL dédiée, sur le
-- même principe que `zone_coverage()` (Lot 1) : part du référentiel `zones`
-- (`left join`) pour qu'une zone sans volume sur la fenêtre apparaisse à zéro
-- plutôt que de disparaître du résultat, et c'est testable contre PGlite,
-- contrairement à une agrégation embarquée PostgREST (voir research.md de
-- `specs/002-session-execution-history/`).
--
-- Pas de qualificatif `security definer` : une fonction SQL est `security
-- invoker` par défaut, donc la RLS de `sessions`/`session_items` s'applique
-- normalement à l'appelant.

create or replace function session_history_summary(since timestamptz)
returns table (
  zone_code text,
  seconds_worked int,
  session_count int,
  total_volume_s int
)
language sql
stable
as $$
  with relevant_sessions as (
    select id, actual_duration_s
    from sessions
    where status = 'completed' and completed_at >= since
  ),
  relevant_items as (
    select si.exercise_id, si.duration_s, si.per_side
    from session_items si
    join relevant_sessions rs on rs.id = si.session_id
  ),
  zone_seconds as (
    select
      ez.zone_code,
      sum(ri.duration_s * case when ri.per_side then 2 else 1 end)::int as seconds_worked
    from relevant_items ri
    join exercise_zones ez on ez.exercise_id = ri.exercise_id
    group by ez.zone_code
  ),
  totals as (
    select
      count(*)::int as session_count,
      coalesce(sum(actual_duration_s), 0)::int as total_volume_s
    from relevant_sessions
  )
  select
    z.code as zone_code,
    coalesce(zs.seconds_worked, 0) as seconds_worked,
    t.session_count,
    t.total_volume_s
  from zones z
  left join zone_seconds zs on zs.zone_code = z.code
  cross join totals t
  order by z.sort;
$$;

comment on function session_history_summary(timestamptz) is
  'Volume de temps travaillé par zone sur les séances completed depuis `since`, zones à zéro incluses. Lecture seule.';

revoke all on function session_history_summary(timestamptz) from public, anon;
grant execute on function session_history_summary(timestamptz) to authenticated;
