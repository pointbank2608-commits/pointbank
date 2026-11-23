begin;

-- The editor initially needs only registration status and masked suffixes.
create function public.student_info_contacts(p_student uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare account jsonb;
begin
  -- Checks staff role, academy and active student before returning any metadata.
  account := public.parent_account_status(p_student);
  return jsonb_build_object(
    'parent', account,
    'login_last4', (select phone_last4 from public.student_guardian where student_id = p_student),
    'can_reveal', coalesce(public.is_owner(), false)
  );
end $$;

create function public.parent_contact_reveal(p_student uuid) returns text
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  if not coalesce(public.is_owner(), false) then raise exception 'not_owner'; end if;
  perform public.parent_staff_student(p_student);
  return (
    select convert_from(extensions.pgp_sym_decrypt_bytea(a.contact_enc, k.value), 'UTF8')::jsonb ->> 'phone'
      from public.parent_accounts a
      join public.private_config k on k.key = 'guardian_phone_key'
     where a.student_id = p_student
  );
end $$;

revoke all on function public.student_info_contacts(uuid), public.parent_contact_reveal(uuid) from public, anon, authenticated;
grant execute on function public.student_info_contacts(uuid), public.parent_contact_reveal(uuid) to authenticated;
commit;
