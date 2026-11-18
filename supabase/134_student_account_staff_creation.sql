-- Teachers can create student portal access for students in their academy.
-- Changes to an existing student login number still require the owner.
begin;

create or replace function public.student_guardian_set(p_student uuid,p_phone text,p_consent boolean)
returns void
language plpgsql security definer set search_path = pg_catalog, public as $$
declare
  v_academy uuid := public.my_academy_id();
  v_digits text := public.sp_phone_digits(p_phone);
  v_name text;
  v_key text;
begin
  if not coalesce(public.is_staff(), false) or v_academy is null then raise exception 'not_staff'; end if;
  select name into v_name from public.students
  where id = p_student and academy_id = v_academy and archived_at is null
  for no key update;
  if not found then raise exception 'not_found'; end if;
  if not coalesce(public.is_owner(), false)
    and exists (select 1 from public.student_guardian where student_id = p_student)
  then raise exception 'not_owner'; end if;
  if not coalesce(p_consent, false) then raise exception 'consent_required'; end if;
  if coalesce(length(v_digits),0) not between 10 and 11 then raise exception 'bad_phone'; end if;

  perform pg_advisory_xact_lock(hashtextextended(v_academy::text || ':' || public.sp_name_key(v_name),0));
  if exists (
    select 1 from public.student_guardian g join public.students s on s.id = g.student_id
    where s.academy_id = v_academy and s.archived_at is null and s.id <> p_student
      and public.sp_name_key(s.name) = public.sp_name_key(v_name)
      and extensions.crypt(v_digits,g.phone_hash) = g.phone_hash
  ) then raise exception 'duplicate_student'; end if;
  select value into strict v_key from public.private_config where key = 'guardian_phone_key';
  insert into public.student_guardian (student_id,phone_hash,phone_last4,phone_enc,consent_at,consent_by)
  values (p_student,extensions.crypt(v_digits,extensions.gen_salt('bf',8)),right(v_digits,4),
    extensions.pgp_sym_encrypt_bytea(convert_to(v_digits,'UTF8'),v_key),now(),auth.uid())
  on conflict (student_id) do update
    set phone_hash = excluded.phone_hash, phone_last4 = excluded.phone_last4, phone_enc = excluded.phone_enc,
        consent_at = excluded.consent_at, consent_by = excluded.consent_by, updated_at = now();
  delete from public.student_sessions where student_id = p_student;
end $$;

revoke all on function public.student_guardian_set(uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.student_guardian_set(uuid,text,boolean) to authenticated;
commit;
