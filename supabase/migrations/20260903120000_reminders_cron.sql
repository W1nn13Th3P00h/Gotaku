-- Lot 5 : job Supabase Cron déclenchant l'Edge Function send-reminders toutes
-- les cinq minutes. L'Edge Function vérifie un JWT (verify_jwt par défaut),
-- donc l'appel doit porter un en-tête Authorization valide ; la clé elle-même
-- n'est jamais en clair ici, seulement le nom du secret Vault qui la contient
-- (créé hors migration, voir docs/roadmap.md Lot 5 / quickstart.md).
--
-- Tout le corps est gardé par la disponibilité de pg_cron/pg_net dans
-- pg_available_extensions : sur le projet Supabase hébergé, les deux sont
-- disponibles et le bloc s'exécute normalement (comportement de prod
-- inchangé). Sous PGlite (utilisée par createTestDb() pour les tests, voir
-- lib/db/test-db.ts), ces extensions ne sont pas compilées et n'apparaissent
-- pas dans pg_available_extensions : le bloc est alors sauté, y compris
-- l'appel à cron.schedule() dont le corps référence les schémas cron/vault —
-- en PL/pgSQL, un appel jamais atteint n'est jamais résolu/compilé, donc
-- leur absence sous PGlite ne fait pas échouer la migration.
do $conv$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron with schema pg_catalog;
    create extension if not exists pg_net with schema extensions;

    -- cron.schedule() est idempotent sur le nom du job : un ré-appel remplace
    -- simplement l'horaire/la commande existants, pas de garde nécessaire.
    perform cron.schedule(
      'send-reminders',
      '*/5 * * * *',
      $sched$
      select
        net.http_post(
          url := 'https://rcuwzjqwupkzagwsywdv.supabase.co/functions/v1/send-reminders',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization',
            'Bearer ' || (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'edge_function_auth_key'
            )
          )
        ) as request_id;
      $sched$
    );
  end if;
end
$conv$;
