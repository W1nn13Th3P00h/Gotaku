-- Séances, items et modèles réutilisables.

create table sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  status              session_status not null default 'draft',
  source              session_source not null,
  target_duration_s   int not null,
  actual_duration_s   int,
  requested_zones     text[] not null default '{}',
  available_equipment text[] not null default '{}',
  excluded_types      exercise_type[] not null default '{}',
  seed                bigint not null,
  created_at          timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz
);

comment on column sessions.seed is
  'Graine du PRNG du générateur. Rejouer la même graine avec les mêmes paramètres redonne la même séance.';

create index sessions_user_created_idx on sessions (user_id, created_at desc);
create index sessions_user_status_idx on sessions (user_id, status);

create table session_items (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  ord         int not null,
  duration_s  int not null,   -- snapshot, par côté si per_side
  per_side    boolean not null default false,
  status      item_status not null default 'pending',
  unique (session_id, ord)
);

comment on column session_items.duration_s is
  'Snapshot de la durée retenue. Modifier un exercice dans la banque ne réécrit jamais l''historique.';

create index session_items_session_idx on session_items (session_id, ord);
create index session_items_exercise_idx on session_items (exercise_id);

create table session_templates (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create index session_templates_user_idx on session_templates (user_id, created_at desc);

create table template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references session_templates(id) on delete cascade,
  exercise_id uuid not null references exercises(id),
  ord         int not null,
  duration_s  int not null,
  per_side    boolean not null default false,
  unique (template_id, ord)
);

create index template_items_template_idx on template_items (template_id, ord);

-- Alimente la pondération de fraîcheur du générateur. `security_invoker` pour que
-- la RLS des tables sous-jacentes s'applique à l'appelant, pas au propriétaire.
create view exercise_last_performed
with (security_invoker = true) as
select si.exercise_id, max(s.completed_at) as last_performed_at
from session_items si
join sessions s on s.id = si.session_id
where s.status = 'completed' and si.status = 'done'
group by si.exercise_id;
