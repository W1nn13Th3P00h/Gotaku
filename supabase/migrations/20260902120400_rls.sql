-- RLS.
--
-- Référentiels et banque : lecture pour tout utilisateur authentifié, aucune policy
-- d'écriture. Le seed passe par la clé de service, qui contourne la RLS.
--
-- Données utilisateur : une policy par table sur user_id = auth.uid(). Les tables
-- enfants n'ont pas de user_id, elles remontent à leur parent.
--
-- auth.uid() est encapsulé dans un sous-select pour être évalué une fois par requête
-- et non une fois par ligne.

-- Référentiels et banque, lecture seule pour les authentifiés

alter table zones enable row level security;
alter table equipment enable row level security;
alter table exercises enable row level security;
alter table exercise_zones enable row level security;
alter table exercise_equipment enable row level security;

create policy zones_read on zones
  for select to authenticated using (true);

create policy equipment_read on equipment
  for select to authenticated using (true);

create policy exercises_read on exercises
  for select to authenticated using (true);

create policy exercise_zones_read on exercise_zones
  for select to authenticated using (true);

create policy exercise_equipment_read on exercise_equipment
  for select to authenticated using (true);

-- Données utilisateur

alter table sessions enable row level security;
alter table session_items enable row level security;
alter table session_templates enable row level security;
alter table template_items enable row level security;
alter table reminders enable row level security;
alter table reminder_sends enable row level security;
alter table push_subscriptions enable row level security;

create policy sessions_own on sessions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy session_items_own on session_items
  for all to authenticated
  using (
    exists (
      select 1 from sessions s
      where s.id = session_items.session_id and s.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from sessions s
      where s.id = session_items.session_id and s.user_id = (select auth.uid())
    )
  );

create policy session_templates_own on session_templates
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy template_items_own on template_items
  for all to authenticated
  using (
    exists (
      select 1 from session_templates t
      where t.id = template_items.template_id and t.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from session_templates t
      where t.id = template_items.template_id and t.user_id = (select auth.uid())
    )
  );

create policy reminders_own on reminders
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy reminder_sends_own on reminder_sends
  for all to authenticated
  using (
    exists (
      select 1 from reminders r
      where r.id = reminder_sends.reminder_id and r.user_id = (select auth.uid())
    )
  )
  with check (
    exists (
      select 1 from reminders r
      where r.id = reminder_sends.reminder_id and r.user_id = (select auth.uid())
    )
  );

create policy push_subscriptions_own on push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
