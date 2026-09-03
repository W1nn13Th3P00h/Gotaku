-- Lot 5 : job Supabase Cron déclenchant l'Edge Function send-reminders toutes
-- les cinq minutes. L'Edge Function vérifie un JWT (verify_jwt par défaut),
-- donc l'appel doit porter un en-tête Authorization valide ; la clé elle-même
-- n'est jamais en clair ici, seulement le nom du secret Vault qui la contient
-- (créé hors migration, voir docs/roadmap.md Lot 5 / quickstart.md).
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- cron.schedule() est idempotent sur le nom du job : un ré-appel remplace
-- simplement l'horaire/la commande existants, pas de garde nécessaire.
select
  cron.schedule(
    'send-reminders',
    '*/5 * * * *',
    $$
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
    $$
  );
