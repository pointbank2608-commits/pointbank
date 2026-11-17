begin;

-- The detail screen only needs the four status values for one academy.
create or replace function public.admin_academy_status(p_academy_id uuid)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if public.is_platform_admin() is not true then
    raise sqlstate '42501' using message = 'not_admin';
  end if;

  return (
    select jsonb_build_object(
      'academy_id', f.id,
      'is_test', f.is_test,
      'entitlement', f.entitlement,
      'source', f.source,
      'billing_state', f.billing_state
    )
    from public.admin_academy_facts f
    where f.id = p_academy_id
  );
end;
$$;

revoke all on function public.admin_academy_status(uuid) from public, anon, authenticated;
grant execute on function public.admin_academy_status(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
