-- Seed transactionnel de la banque.
--
-- `npm run seed` valide data/exercises.json avec Zod puis envoie le tableau entier
-- dans un seul appel RPC. Un appel RPC PostgREST est une transaction : soit tout
-- passe, soit rien n'est écrit. C'est la seule façon d'obtenir « pas d'écriture
-- partielle » sans ouvrir une connexion Postgres directe depuis le script.
--
-- Idempotent sur le slug. Un slug disparu du JSON n'est pas supprimé mais désactivé :
-- session_items le référence, et l'historique ne se réécrit pas.

create or replace function public._bank_parse(payload jsonb)
returns table (
  slug              text,
  name              text,
  type              exercise_type,
  position          body_position,
  symmetry          symmetry_type,
  intensity         int,
  duration_target_s int,
  duration_min_s    int,
  duration_max_s    int,
  contraindications text,
  notes             text,
  media_url         text,
  primary_zone      text,
  instructions      text[],
  zones             text[],
  equipment         text[]
)
language sql
immutable
set search_path = public, pg_temp
as $$
  select
    e ->> 'slug',
    e ->> 'name',
    (e ->> 'type')::exercise_type,
    (e ->> 'position')::body_position,
    (e ->> 'symmetry')::symmetry_type,
    (e ->> 'intensity')::int,
    (e ->> 'duration_target_s')::int,
    (e ->> 'duration_min_s')::int,
    (e ->> 'duration_max_s')::int,
    e ->> 'contraindications',
    e ->> 'notes',
    e ->> 'media_url',
    e ->> 'primary_zone',
    array(select jsonb_array_elements_text(e -> 'instructions')),
    array(select jsonb_array_elements_text(e -> 'zones')),
    array(select jsonb_array_elements_text(coalesce(e -> 'equipment', '[]'::jsonb)))
  from jsonb_array_elements(payload) as e;
$$;

create or replace function public.seed_exercises(payload jsonb)
returns jsonb
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_incoming    int;
  v_inserted    int;
  v_updated     int;
  v_deactivated int;
  v_zones       int;
  v_equipment   int;
begin
  if payload is null or jsonb_typeof(payload) <> 'array' then
    raise exception 'payload doit être un tableau JSON';
  end if;

  select count(*) into v_incoming from public._bank_parse(payload);

  if v_incoming = 0 then
    raise exception 'payload vide, refus d''écrire';
  end if;

  with upserted as (
    insert into exercises (
      slug, name, instructions, type, position, symmetry, intensity,
      duration_target_s, duration_min_s, duration_max_s,
      contraindications, notes, media_url, active, updated_at
    )
    select
      p.slug, p.name, p.instructions, p.type, p.position, p.symmetry, p.intensity,
      p.duration_target_s, p.duration_min_s, p.duration_max_s,
      p.contraindications, p.notes, p.media_url, true, now()
    from public._bank_parse(payload) p
    on conflict (slug) do update set
      name              = excluded.name,
      instructions      = excluded.instructions,
      type              = excluded.type,
      position          = excluded.position,
      symmetry          = excluded.symmetry,
      intensity         = excluded.intensity,
      duration_target_s = excluded.duration_target_s,
      duration_min_s    = excluded.duration_min_s,
      duration_max_s    = excluded.duration_max_s,
      contraindications = excluded.contraindications,
      notes             = excluded.notes,
      media_url         = excluded.media_url,
      active            = true,
      updated_at        = now()
    returning (xmax = 0) as was_insert
  )
  select
    count(*) filter (where was_insert),
    count(*) filter (where not was_insert)
  into v_inserted, v_updated
  from upserted;

  -- Les rattachements sont remplacés, pas fusionnés : le JSON fait foi.
  delete from exercise_zones z
  using exercises x, public._bank_parse(payload) p
  where z.exercise_id = x.id and x.slug = p.slug;

  insert into exercise_zones (exercise_id, zone_code, is_primary)
  select x.id, zone_code, zone_code = p.primary_zone
  from public._bank_parse(payload) p
  join exercises x on x.slug = p.slug
  cross join unnest(p.zones) as zone_code;

  get diagnostics v_zones = row_count;

  delete from exercise_equipment q
  using exercises x, public._bank_parse(payload) p
  where q.exercise_id = x.id and x.slug = p.slug;

  insert into exercise_equipment (exercise_id, equipment_code)
  select x.id, equipment_code
  from public._bank_parse(payload) p
  join exercises x on x.slug = p.slug
  cross join unnest(p.equipment) as equipment_code;

  get diagnostics v_equipment = row_count;

  update exercises
  set active = false, updated_at = now()
  where active
    and slug not in (select p.slug from public._bank_parse(payload) p);

  get diagnostics v_deactivated = row_count;

  return jsonb_build_object(
    'incoming', v_incoming,
    'inserted', v_inserted,
    'updated', v_updated,
    'deactivated', v_deactivated,
    'zone_links', v_zones,
    'equipment_links', v_equipment
  );
end;
$$;

-- Réservé à la clé de service utilisée par le seed. Ni anon ni authenticated
-- n'écrivent dans la banque.
revoke all on function public._bank_parse(jsonb) from public, anon, authenticated;
revoke all on function public.seed_exercises(jsonb) from public, anon, authenticated;
grant execute on function public._bank_parse(jsonb) to service_role;
grant execute on function public.seed_exercises(jsonb) to service_role;
