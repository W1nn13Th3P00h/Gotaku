-- Rappel quotidien et abonnements Web Push. Tables posées au lot 0, exploitées au lot 5.

create table reminders (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  time_local time not null,
  weekdays   int[] not null,      -- 1 = lundi, 7 = dimanche
  timezone   text not null,
  active     boolean not null default true
);

create index reminders_active_idx on reminders (active) where active;

-- L'idempotence de l'envoi repose sur cette table, pas sur un état porté par le rappel.
create table reminder_sends (
  reminder_id uuid not null references reminders(id) on delete cascade,
  sent_on     date not null,
  sent_at     timestamptz not null default now(),
  primary key (reminder_id, sent_on)
);

create table push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  endpoint        text unique not null,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count   int not null default 0
);

comment on column push_subscriptions.failure_count is
  'Un 404 ou 410 supprime l''abonnement. Les autres échecs incrémentent, abandon au cinquième consécutif.';

create index push_subscriptions_user_idx on push_subscriptions (user_id);
