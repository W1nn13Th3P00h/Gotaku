-- Réglages globaux par utilisateur. Un seul réglage en v1 : le matériel disponible,
-- remonté du formulaire de génération vers un paramètre global (voir docs/generator.md
-- pour son usage comme valeur initiale de `GeneratorInput.equipment`).

create table user_settings (
  user_id             uuid primary key references auth.users(id) on delete cascade,
  available_equipment text[] not null default '{}',
  updated_at          timestamptz not null default now()
);

alter table user_settings enable row level security;

create policy user_settings_own on user_settings
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
