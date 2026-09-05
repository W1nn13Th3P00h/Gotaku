-- Stats d'usage (écran /stats, gamification streak + volume hebdo). Une
-- fonction SQL dédiée, sur le même principe que `session_history_summary()` :
-- part d'une série de semaines générée (`generate_series`) plutôt que d'une
-- agrégation brute, pour qu'une semaine sans séance apparaisse à zéro plutôt
-- que de disparaître du résultat, et c'est testable contre PGlite.
--
-- Pas de qualificatif `security definer` : une fonction SQL est `security
-- invoker` par défaut, donc la RLS de `sessions` s'applique normalement à
-- l'appelant.

create or replace function session_weekly_volume(weeks int)
returns table (
  week_start date,
  total_volume_s int
)
language sql
stable
as $$
  with weeks_series as (
    select generate_series(
      date_trunc('week', now())::date - ((weeks - 1) * 7),
      date_trunc('week', now())::date,
      interval '7 days'
    )::date as week_start
  ),
  weekly_totals as (
    select
      date_trunc('week', completed_at)::date as week_start,
      sum(actual_duration_s)::int as total_volume_s
    from sessions
    where status = 'completed'
    group by date_trunc('week', completed_at)::date
  )
  select
    ws.week_start,
    coalesce(wt.total_volume_s, 0) as total_volume_s
  from weeks_series ws
  left join weekly_totals wt on wt.week_start = ws.week_start
  order by ws.week_start;
$$;

comment on function session_weekly_volume(int) is
  'Volume de temps travaillé par semaine ISO (lundi) sur les `weeks` dernières semaines glissantes, semaines à zéro incluses. Lecture seule.';

revoke all on function session_weekly_volume(int) from public, anon;
grant execute on function session_weekly_volume(int) to authenticated;
