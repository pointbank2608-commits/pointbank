-- Optional until Web Push is configured. Apply after 133_parent_portal.sql and deploying the Edge Function.
begin;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'parent_push_cron_secret'
    and length(decrypted_secret) >= 32) then raise exception 'Set parent_push_cron_secret in Vault'; end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'parent_push_project_url'
    and decrypted_secret ~ '^https://[a-z0-9]+[.]supabase[.]co$') then
    raise exception 'Set parent_push_project_url in Vault'; end if;
end $$;

select cron.schedule('parent-push', '* * * * *', $job$
  select net.http_post(
    url := project.decrypted_secret || '/functions/v1/parent-push',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret', secret.decrypted_secret),
    body := '{}'::jsonb, timeout_milliseconds := 40000
  )
  from vault.decrypted_secrets project cross join vault.decrypted_secrets secret
  where project.name = 'parent_push_project_url' and secret.name = 'parent_push_cron_secret';
$job$);
commit;
