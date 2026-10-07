-- 046 동명이인 처리 (2026-10-07)
--  로그인은 학원 안에서 "이름이 같은 학생들" 중 전화번호가 맞는 학생을 찾는다.
--  - 이름이 같아도 보호자 번호가 다르면 문제 없이 각자 로그인된다.
--  - 이름과 번호가 둘 다 같은 학생이 둘이면 누구인지 알 수 없으므로, 번호를 등록하는 순간 막는다(duplicate_student).
--    그럴 때는 이름 뒤에 구분(예: 김민성A, 김민성B)을 붙이고, 학생은 그 이름으로 로그인한다.
--  - 그래도 둘이 겹쳐 있으면(이름을 나중에 바꿨을 때 등) 로그인은 어느 쪽도 열어 주지 않는다.

create or replace function public.student_guardian_set(p_student uuid, p_phone text, p_consent boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_digits text := public.sp_phone_digits(p_phone);
  v_key text;
  v_name text;
begin
  if not public.is_owner() or public.my_academy_id() is null then
    raise exception 'not_owner';
  end if;
  select name into v_name from public.students where id = p_student and academy_id = public.my_academy_id();
  if v_name is null then
    raise exception 'not_found';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'consent_required';
  end if;
  if length(v_digits) < 10 or length(v_digits) > 11 then
    raise exception 'bad_phone';
  end if;
  -- 같은 학원에 이름과 번호가 둘 다 같은 다른 학생이 이미 있으면 거절
  if exists (
    select 1
      from public.student_guardian g
      join public.students s on s.id = g.student_id
     where s.academy_id = public.my_academy_id()
       and s.archived_at is null
       and s.id <> p_student
       and public.sp_name_key(s.name) = public.sp_name_key(v_name)
       and extensions.crypt(v_digits, g.phone_hash) = g.phone_hash
  ) then
    raise exception 'duplicate_student';
  end if;
  select value into v_key from public.private_config where key = 'guardian_phone_key';
  insert into public.student_guardian (student_id, phone_hash, phone_last4, phone_enc, consent_at, consent_by)
  values (p_student, extensions.crypt(v_digits, extensions.gen_salt('bf', 8)), right(v_digits, 4),
          extensions.pgp_sym_encrypt_bytea(convert_to(v_digits, 'UTF8'), v_key), now(), auth.uid())
  on conflict (student_id) do update
    set phone_hash = excluded.phone_hash, phone_last4 = excluded.phone_last4, phone_enc = excluded.phone_enc,
        consent_at = excluded.consent_at, consent_by = excluded.consent_by, updated_at = now();
  delete from public.student_sessions where student_id = p_student;
end $$;

revoke all on function public.student_guardian_set(uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.student_guardian_set(uuid, text, boolean) to authenticated;

-- 로그인: 이름·번호가 모두 같은 학생이 둘 이상이면 열어 주지 않는다
create or replace function public.student_login(p_code text, p_name text, p_phone text, p_device text default null)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_key text := v_code || ':' || public.sp_name_key(p_name);
  v_digits text := public.sp_phone_digits(p_phone);
  v_academy uuid;
  v_sid uuid;
  v_matches int := 0;
  v_token uuid;
  r record;
begin
  if (select count(*) from public.student_login_failures where fail_key = v_key and failed_at > now() - interval '10 minutes') >= 8
     or (select count(*) from public.student_login_failures where fail_key like v_code || ':%' and failed_at > now() - interval '10 minutes') >= 60 then
    return jsonb_build_object('error', 'locked');
  end if;
  select id into v_academy from public.academies where student_code = v_code;
  if v_academy is not null and length(v_digits) >= 9 then
    for r in
      select s.id, g.phone_hash
        from public.students s
        join public.student_guardian g on g.student_id = s.id
       where s.academy_id = v_academy and s.archived_at is null
         and public.sp_name_key(s.name) = public.sp_name_key(p_name)
    loop
      if extensions.crypt(v_digits, r.phone_hash) = r.phone_hash then
        v_matches := v_matches + 1;
        v_sid := r.id;
      end if;
    end loop;
  end if;
  if v_matches <> 1 then
    insert into public.student_login_failures (fail_key) values (v_key);
    return jsonb_build_object('error', 'bad_login');
  end if;
  insert into public.student_sessions (student_id, device) values (v_sid, left(p_device, 120)) returning token into v_token;
  delete from public.student_login_failures where fail_key = v_key;
  return jsonb_build_object('token', v_token);
end $$;

revoke all on function public.student_login(text, text, text, text) from public, anon, authenticated;
grant execute on function public.student_login(text, text, text, text) to anon, authenticated;
