-- Deploy admin-ai first with --no-verify-jwt. Set ADMIN_AI_CRON_SECRET in Edge
-- Function Secrets and store the same random value in Vault as admin_ai_cron_secret.
-- Store this project's https://<project-ref>.supabase.co in Vault as admin_ai_project_url.
-- The two secrets belong to the same Supabase project. No OpenAI key goes in Vault.

begin;

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets
    where name = 'admin_ai_cron_secret' and length(decrypted_secret) >= 32) then
    raise exception 'Set admin_ai_cron_secret in Vault first';
  end if;
  if not exists (select 1 from vault.decrypted_secrets
    where name = 'admin_ai_project_url' and decrypted_secret ~ '^https://[a-z0-9]+\.supabase\.co$') then
    raise exception 'Set admin_ai_project_url in Vault first';
  end if;
end $$;

select cron.schedule('admin-ai', '*/5 * * * *', $$
  select net.http_post(
    url := project.decrypted_secret || '/functions/v1/admin-ai',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', secret.decrypted_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 50000
  )
  from vault.decrypted_secrets project cross join vault.decrypted_secrets secret
  where project.name = 'admin_ai_project_url' and secret.name = 'admin_ai_cron_secret';
$$);

commit;
