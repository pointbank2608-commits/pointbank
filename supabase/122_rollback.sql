-- Disable single-session enforcement and keep the QR remote available.
begin;

do $$
declare
  target record;
begin
  if exists (
    select from pg_catalog.pg_db_role_setting
    where setrole = 'authenticator'::regrole and setdatabase = 0
      and 'pgrst.db_pre_request=public.classbank_check_request' = any(setconfig)
  ) then
    alter role authenticator reset pgrst.db_pre_request;
  end if;
  for target in select schemaname, tablename from pg_catalog.pg_policies
    where policyname = 'classbank_current_session' and schemaname in ('public', 'storage')
  loop
    execute format('drop policy classbank_current_session on %I.%I', target.schemaname, target.tablename);
  end loop;
end;
$$;

create or replace function private.classbank_session_matches(p_user uuid, p_session uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select from auth.sessions where id = p_session and user_id = p_user);
$$;

drop trigger if exists classbank_record_session on auth.sessions;
drop function if exists private.classbank_record_session();
-- Keep the pre-request function until PostgREST has reloaded its config.
-- Its check becomes a no-op during the reload window.
create or replace function public.classbank_check_request()
returns void language plpgsql stable set search_path = '' as $$
begin
  return;
end;
$$;
drop table if exists private.classbank_account_sessions;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
commit;
