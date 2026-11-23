begin;

-- Read authentication events recorded by Supabase Auth on the server.
-- The client cannot create or edit these records.
create or replace function public.admin_auth_activity(p_page int default 0)
returns table (id uuid, occurred_at timestamptz, event text, account text, method text)
language plpgsql stable security definer set search_path = '' as $$
begin
  if public.is_platform_admin() is not true then
    raise sqlstate '42501' using message = 'admin_required';
  end if;
  return query
    select a.id, a.created_at, a.payload->>'action',
      coalesce(a.payload->>'actor_username', p.display_name, a.payload->>'actor_id', '–'),
      a.payload->>'log_type'
    from auth.audit_log_entries a
    left join public.profiles p on p.id::text = a.payload->>'actor_id'
    where a.payload->>'action' in ('login', 'logout')
    order by a.created_at desc, a.id desc
    limit 50 offset greatest(0, least(coalesce(p_page, 0), 2000)) * 50;
end $$;

revoke all on function public.admin_auth_activity(int) from public, anon;
grant execute on function public.admin_auth_activity(int) to authenticated;

commit;
