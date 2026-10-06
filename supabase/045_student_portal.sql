-- ============================================================
-- 045 학생 포털(Classbank Student) — 학원 코드 + 이름 + 학부모 전화번호로 로그인
--
-- 결정(2026-10-07): 학생은 Supabase 로그인(이메일 계정) 없이, 원장이 등록한 "학부모 전화번호 전체"로 들어온다.
--  - 전화번호는 두 가지로 저장한다: 로그인 확인용 bcrypt 해시 + 원장이 다시 볼 수 있게 암호화한 값.
--    둘 다 students 가 아니라 student_guardian 에 둔다(students 는 선생님 화면이 select('*') 로 읽는다).
--    student_guardian·private_config 는 RLS 정책이 없어 서버 함수만 읽는다.
--  - 로그인하면 이 기기 열쇠(student_sessions)를 받는다. 90일, 로그아웃하면 지워진다.
--  - 틀리면 학원 코드·이름·번호 중 어느 쪽인지 알려 주지 않는다. 이름별 10분에 8번, 학원 코드별 60번이면 잠깐 막는다.
--  - 번호를 등록할 때 보호자 동의 기록(consent_at)을 남긴다. 만 14세 미만 학생이라 동의 없이 등록하지 않는다.
-- ============================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- 학원 학생 코드(선생님 초대 코드와 다른 값) ----------
alter table public.academies add column if not exists student_code text;
update public.academies set student_code = public.gen_join_code(6) where student_code is null;
alter table public.academies alter column student_code set not null;
alter table public.academies alter column student_code set default public.gen_join_code(6);
create unique index if not exists academies_student_code_key on public.academies (student_code);

-- ---------- 서버만 읽는 설정(암호화 열쇠) ----------
create table if not exists public.private_config (
  key text primary key,
  value text not null
);
alter table public.private_config enable row level security;
revoke all on public.private_config from anon, authenticated;
insert into public.private_config (key, value)
values ('guardian_phone_key', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (key) do nothing;

-- ---------- 학부모 전화번호 + 동의 기록 ----------
create table if not exists public.student_guardian (
  student_id uuid primary key references public.students (id) on delete cascade,
  phone_hash text not null,
  phone_last4 text not null,
  phone_enc bytea not null,
  consent_at timestamptz not null,
  consent_by uuid,
  updated_at timestamptz not null default now()
);
alter table public.student_guardian enable row level security;
revoke all on public.student_guardian from anon, authenticated;

-- ---------- 학생 기기 열쇠 / 로그인 실패 ----------
create table if not exists public.student_sessions (
  token uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  device text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '90 days')
);
create index if not exists student_sessions_student_idx on public.student_sessions (student_id);
alter table public.student_sessions enable row level security;
revoke all on public.student_sessions from anon, authenticated;

create table if not exists public.student_login_failures (
  id bigserial primary key,
  fail_key text not null,
  failed_at timestamptz not null default now()
);
create index if not exists student_login_failures_key_idx on public.student_login_failures (fail_key, failed_at desc);
alter table public.student_login_failures enable row level security;
revoke all on public.student_login_failures from anon, authenticated;

-- ---------- 도우미: 전화번호는 숫자만(+82 는 0 으로), 이름은 공백 없이 소문자 ----------
create or replace function public.sp_phone_digits(p text) returns text
language sql immutable set search_path = public
as $$
  select case
    when d like '82%' and length(d) >= 11 then '0' || substr(d, 3)
    else d
  end
  from (select regexp_replace(coalesce(p, ''), '\D', '', 'g') as d) x
$$;

create or replace function public.sp_name_key(p text) returns text
language sql immutable set search_path = public
as $$ select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', '', 'g')) $$;

-- ---------- 학생: 로그인 ----------
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
        v_sid := r.id;
        exit;
      end if;
    end loop;
  end if;
  if v_sid is null then
    insert into public.student_login_failures (fail_key) values (v_key);
    return jsonb_build_object('error', 'bad_login');
  end if;
  insert into public.student_sessions (student_id, device) values (v_sid, left(p_device, 120)) returning token into v_token;
  delete from public.student_login_failures where fail_key = v_key;
  return jsonb_build_object('token', v_token);
end $$;

-- ---------- 학생: 내 정보(열쇠 확인) + 오늘 할 일 목록 ----------
create or replace function public.student_session_student(p_token uuid) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_sid uuid;
begin
  select s.student_id into v_sid
    from public.student_sessions s
    join public.students st on st.id = s.student_id and st.archived_at is null
   where s.token = p_token and s.expires_at > now();
  if v_sid is null then
    raise exception 'expired';
  end if;
  update public.student_sessions set last_seen_at = now() where token = p_token and last_seen_at < now() - interval '5 minutes';
  return v_sid;
end $$;

create or replace function public.student_home(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_sid uuid;
  v_out jsonb;
begin
  begin
    v_sid := public.student_session_student(p_token);
  exception when others then
    return jsonb_build_object('error', 'expired');
  end;
  select jsonb_build_object(
    'name', st.name,
    'academy', a.name,
    'class_name', c.name,
    'homework', coalesce((
      select jsonb_agg(jsonb_build_object(
               'title', h.title, 'due_at', h.due_at, 'access', g.access_token,
               'done', coalesce(t.finished_at is not null, false)
             ) order by h.created_at desc)
        from public.homework_assignment_targets g
        join public.homework_assignments h on h.id = g.assignment_id
        left join public.homework_attempts t on t.assignment_id = h.id and t.student_id = st.id
       where g.student_id = st.id and h.closed_at is null
         and (h.due_at is null or h.due_at > now() - interval '1 day')
         and (g.token_expires_at is null or g.token_expires_at > now())
    ), '[]'::jsonb)
  ) into v_out
  from public.students st
  join public.academies a on a.id = st.academy_id
  join public.classes c on c.id = st.class_id
  where st.id = v_sid;
  return v_out;
end $$;

create or replace function public.student_logout(p_token uuid) returns void
language sql security definer set search_path = public
as $$ delete from public.student_sessions where token = p_token $$;

-- ---------- 원장·선생님: 학생 코드 / 학부모 번호 ----------
create or replace function public.academy_student_code() returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_staff() or public.my_academy_id() is null then
    raise exception 'not_staff';
  end if;
  select student_code into v_code from public.academies where id = public.my_academy_id();
  return v_code;
end $$;

create or replace function public.academy_student_code_reset() returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
begin
  if not public.is_owner() or public.my_academy_id() is null then
    raise exception 'not_owner';
  end if;
  v_code := public.gen_join_code(6);
  update public.academies set student_code = v_code where id = public.my_academy_id();
  -- 코드를 바꾸면 이미 로그인한 기기는 그대로 둔다(코드는 로그인 때만 쓴다)
  return v_code;
end $$;

-- 학생별 번호 등록 여부와 끝 4자리(전체는 원장이 "보기"를 눌렀을 때만)
create or replace function public.student_guardian_status()
returns table (student_id uuid, last4 text, consent_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_staff() or public.my_academy_id() is null then
    raise exception 'not_staff';
  end if;
  return query
    select g.student_id, g.phone_last4, g.consent_at
      from public.student_guardian g
      join public.students s on s.id = g.student_id
     where s.academy_id = public.my_academy_id();
end $$;

create or replace function public.student_guardian_set(p_student uuid, p_phone text, p_consent boolean)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_digits text := public.sp_phone_digits(p_phone);
  v_key text;
begin
  if not public.is_owner() or public.my_academy_id() is null then
    raise exception 'not_owner';
  end if;
  if not exists (select 1 from public.students where id = p_student and academy_id = public.my_academy_id()) then
    raise exception 'not_found';
  end if;
  if not coalesce(p_consent, false) then
    raise exception 'consent_required';
  end if;
  if length(v_digits) < 10 or length(v_digits) > 11 then
    raise exception 'bad_phone';
  end if;
  select value into v_key from public.private_config where key = 'guardian_phone_key';
  insert into public.student_guardian (student_id, phone_hash, phone_last4, phone_enc, consent_at, consent_by)
  values (p_student, extensions.crypt(v_digits, extensions.gen_salt('bf', 8)), right(v_digits, 4),
          extensions.pgp_sym_encrypt_bytea(convert_to(v_digits, 'UTF8'), v_key), now(), auth.uid())
  on conflict (student_id) do update
    set phone_hash = excluded.phone_hash, phone_last4 = excluded.phone_last4, phone_enc = excluded.phone_enc,
        consent_at = excluded.consent_at, consent_by = excluded.consent_by, updated_at = now();
  -- 번호가 바뀌면 이미 로그인한 기기를 모두 로그아웃시킨다
  delete from public.student_sessions where student_id = p_student;
end $$;

create or replace function public.student_guardian_reveal(p_student uuid) returns text
language plpgsql stable security definer set search_path = public
as $$
declare
  v_key text;
  v_enc bytea;
begin
  if not public.is_owner() or public.my_academy_id() is null then
    raise exception 'not_owner';
  end if;
  select g.phone_enc into v_enc
    from public.student_guardian g join public.students s on s.id = g.student_id
   where g.student_id = p_student and s.academy_id = public.my_academy_id();
  if v_enc is null then
    return null;
  end if;
  select value into v_key from public.private_config where key = 'guardian_phone_key';
  return convert_from(extensions.pgp_sym_decrypt_bytea(v_enc, v_key), 'UTF8');
end $$;

create or replace function public.student_guardian_clear(p_student uuid) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_owner() or public.my_academy_id() is null then
    raise exception 'not_owner';
  end if;
  delete from public.student_guardian g using public.students s
   where g.student_id = s.id and s.id = p_student and s.academy_id = public.my_academy_id();
  delete from public.student_sessions where student_id = p_student;
end $$;

-- ---------- 권한 ----------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.sp_phone_digits(text)', 'public.sp_name_key(text)', 'public.student_login(text, text, text, text)',
    'public.student_session_student(uuid)', 'public.student_home(uuid)', 'public.student_logout(uuid)',
    'public.academy_student_code()', 'public.academy_student_code_reset()', 'public.student_guardian_status()',
    'public.student_guardian_set(uuid, text, boolean)', 'public.student_guardian_reveal(uuid)', 'public.student_guardian_clear(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

grant execute on function public.student_login(text, text, text, text) to anon, authenticated;
grant execute on function public.student_home(uuid) to anon, authenticated;
grant execute on function public.student_logout(uuid) to anon, authenticated;
grant execute on function public.academy_student_code() to authenticated;
grant execute on function public.academy_student_code_reset() to authenticated;
grant execute on function public.student_guardian_status() to authenticated;
grant execute on function public.student_guardian_set(uuid, text, boolean) to authenticated;
grant execute on function public.student_guardian_reveal(uuid) to authenticated;
grant execute on function public.student_guardian_clear(uuid) to authenticated;
