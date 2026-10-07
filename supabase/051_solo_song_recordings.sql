-- ============================================================
-- 051 노래 개별수업 + 녹음 보관 + 학부모 공유 링크 (2026-10-08)
--
-- 1) 단계 종류 추가: lyricBlank(노래 한 줄 듣고 빈칸 고르기, 번호로 고르는 단계)
--    watch(노래 듣기)·lineSing(한 줄 따라 부르기)는 채점 없는 보기·녹음 단계.
-- 2) 녹음 보관: 학생이 따라 부른 녹음을 서버에 둘 수 있다 — 보호자 녹음 동의(student_guardian.record_consent_at)가
--    있는 학생만. 한 단계에 하나(다시 녹음하면 덮어쓴다), 90일 지나면 지운다, 한 개 최대 약 500KB.
-- 3) 학부모 공유 링크: 선생님이 녹음을 듣고 "학부모에게 보내기" → 무작위 열쇠 링크(/r/열쇠), 기본 30일 뒤 만료,
--    선생님이 언제든 닫을 수 있다. 공개 쪽에는 학원 이름·수업 이름·(선택) 학생 이름·녹음만 나간다.
-- ============================================================

-- ---------- 단계 종류 ----------
create or replace function public.solo_public_step(p jsonb) returns jsonb
language sql immutable set search_path = public
as $$
  select case
    when p->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank') then p - 'answer'
    when p->>'t' in ('spell', 'typeWord') then p - 'word'
    when p->>'t' = 'unscramble' then p - 'sentence'
    else p
  end
$$;

create or replace function public.solo_grade(p_step jsonb, p_value text) returns boolean
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank') then
    return (p_step->>'answer')::int = nullif(p_value, '')::int;
  elsif p_step->>'t' in ('spell', 'typeWord', 'dictation') then
    return public.solo_norm(p_step->>'word') = public.solo_norm(p_value);
  elsif p_step->>'t' = 'unscramble' then
    return public.solo_norm(p_step->>'sentence') = public.solo_norm(p_value);
  end if;
  return null;
end $$;

create or replace function public.solo_correct_text(p_step jsonb) returns text
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick', 'fillBlank', 'translatePick', 'pickCorrect', 'lyricBlank') then
    return p_step->'options'->>((p_step->>'answer')::int);
  elsif p_step->>'t' in ('spell', 'typeWord', 'dictation') then
    return p_step->>'word';
  elsif p_step->>'t' = 'unscramble' then
    return p_step->>'sentence';
  end if;
  return null;
end $$;

revoke all on function public.solo_public_step(jsonb) from public, anon, authenticated;
revoke all on function public.solo_grade(jsonb, text) from public, anon, authenticated;
revoke all on function public.solo_correct_text(jsonb) from public, anon, authenticated;

-- ---------- 보호자 녹음 동의 ----------
alter table public.student_guardian add column if not exists record_consent_at timestamptz;

create or replace function public.student_record_consent_set(p_student uuid, p_on boolean) returns void
language plpgsql security definer set search_path = public
as $$
begin
  if not public.is_owner() or public.my_academy_id() is null then
    raise exception 'not_owner';
  end if;
  if not exists (select 1 from public.students where id = p_student and academy_id = public.my_academy_id()) then
    raise exception 'not_found';
  end if;
  update public.student_guardian set record_consent_at = case when p_on then now() else null end where student_id = p_student;
  if not found then
    raise exception 'phone_first';
  end if;
  -- 동의를 거두면 이미 보관한 녹음과 열려 있는 공유 링크도 바로 지운다
  if not p_on then
    delete from public.solo_recordings r using public.solo_assignments a where r.assignment_id = a.id and a.student_id = p_student;
    update public.solo_shares s set revoked_at = now() from public.solo_assignments a
     where s.assignment_id = a.id and a.student_id = p_student and s.revoked_at is null;
  end if;
end $$;

-- 학생별 녹음 동의 상태(선생님 화면용) — 번호 등록 상태 함수에 같이 쓴다(돌려주는 칸이 늘어서 먼저 지우고 다시 만든다)
drop function if exists public.student_guardian_status();
create function public.student_guardian_status()
returns table (student_id uuid, last4 text, consent_at timestamptz, record_consent_at timestamptz)
language plpgsql stable security definer set search_path = public
as $$
begin
  if not public.is_staff() or public.my_academy_id() is null then
    raise exception 'not_staff';
  end if;
  return query
    select g.student_id, g.phone_last4, g.consent_at, g.record_consent_at
      from public.student_guardian g
      join public.students s on s.id = g.student_id
     where s.academy_id = public.my_academy_id();
end $$;

-- ---------- 녹음 보관 ----------
create table if not exists public.solo_recordings (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.solo_assignments (id) on delete cascade,
  step_index int not null,
  mime text not null default 'audio/webm',
  seconds numeric(5, 1),
  audio bytea not null,
  created_at timestamptz not null default now(),
  unique (assignment_id, step_index)
);
alter table public.solo_recordings enable row level security;
revoke all on public.solo_recordings from anon, authenticated;

create table if not exists public.solo_shares (
  token text primary key default encode(extensions.gen_random_bytes(9), 'hex'),
  assignment_id uuid not null references public.solo_assignments (id) on delete cascade,
  academy_id uuid not null references public.academies (id) on delete cascade,
  -- full: 전체 이름 / given: 성을 뺀 이름 / hidden: 이름 없이 "우리 아이"
  name_mode text not null default 'given' check (name_mode in ('full', 'given', 'hidden')),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days'),
  revoked_at timestamptz
);
create index if not exists solo_shares_assignment_idx on public.solo_shares (assignment_id);
alter table public.solo_shares enable row level security;
revoke all on public.solo_shares from anon, authenticated;

-- 학생: 녹음 올리기(동의가 있는 학생만, 90일 지난 녹음은 이때 같이 지운다)
create or replace function public.solo_record_save(p_token uuid, p_assignment uuid, p_step int, p_mime text, p_b64 text, p_seconds numeric)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
  v_audio bytea;
begin
  v_a := public.solo_assignment_for(p_token, p_assignment);
  if not exists (select 1 from public.student_guardian where student_id = v_a.student_id and record_consent_at is not null) then
    return jsonb_build_object('error', 'no_consent');
  end if;
  v_audio := decode(p_b64, 'base64');
  if octet_length(v_audio) > 600000 or octet_length(v_audio) < 200 then
    return jsonb_build_object('error', 'bad_size');
  end if;
  delete from public.solo_recordings where created_at < now() - interval '90 days';
  insert into public.solo_recordings (assignment_id, step_index, mime, seconds, audio)
  values (v_a.id, p_step, left(coalesce(p_mime, 'audio/webm'), 40), p_seconds, v_audio)
  on conflict (assignment_id, step_index) do update
    set mime = excluded.mime, seconds = excluded.seconds, audio = excluded.audio, created_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- 선생님: 이 학생이 낸 수업의 녹음 목록(소리 자체는 따로 가져온다)
create or replace function public.solo_record_list(p_assignment uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.solo_assignments where id = p_assignment and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'step', r.step_index, 'seconds', r.seconds, 'created_at', r.created_at) order by r.step_index)
      from public.solo_recordings r where r.assignment_id = p_assignment
  ), '[]'::jsonb);
end $$;

create or replace function public.solo_record_get(p_recording uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_r public.solo_recordings;
begin
  select r.* into v_r from public.solo_recordings r join public.solo_assignments a on a.id = r.assignment_id
   where r.id = p_recording and a.academy_id = v_academy;
  if v_r.id is null then
    raise exception 'not_found';
  end if;
  return jsonb_build_object('mime', v_r.mime, 'b64', encode(v_r.audio, 'base64'));
end $$;

-- 선생님: 학부모 공유 링크 만들기/닫기/목록
create or replace function public.solo_share_create(p_assignment uuid, p_name_mode text default 'given', p_days int default 30)
returns text
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_token text;
begin
  if not exists (select 1 from public.solo_assignments where id = p_assignment and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  if not exists (select 1 from public.solo_recordings where assignment_id = p_assignment) then
    raise exception 'no_recordings';
  end if;
  insert into public.solo_shares (assignment_id, academy_id, name_mode, expires_at)
  values (p_assignment, v_academy, case when p_name_mode in ('full', 'given', 'hidden') then p_name_mode else 'given' end,
          now() + make_interval(days => greatest(1, least(coalesce(p_days, 30), 90))))
  returning token into v_token;
  return v_token;
end $$;

create or replace function public.solo_share_revoke(p_token text) returns void
language plpgsql security definer set search_path = public
as $$
begin
  update public.solo_shares set revoked_at = now() where token = p_token and academy_id = public.hw_staff_academy();
end $$;

create or replace function public.solo_share_list(p_assignment uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('token', s.token, 'name_mode', s.name_mode, 'created_at', s.created_at,
                                         'expires_at', s.expires_at, 'revoked', s.revoked_at is not null) order by s.created_at desc)
      from public.solo_shares s where s.assignment_id = p_assignment and s.academy_id = v_academy
  ), '[]'::jsonb);
end $$;

-- 공개: 학부모가 링크로 보는 내용(로그인 없음). 만료·닫힘이면 not_found
create or replace function public.solo_share_get(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_s public.solo_shares;
  v_a public.solo_assignments;
  v_l public.solo_lessons;
  v_name text;
  v_student text;
begin
  select * into v_s from public.solo_shares where token = btrim(coalesce(p_token, '')) and revoked_at is null and expires_at > now();
  if v_s.token is null then
    return jsonb_build_object('error', 'not_found');
  end if;
  select * into v_a from public.solo_assignments where id = v_s.assignment_id;
  select * into v_l from public.solo_lessons where id = v_a.lesson_id;
  select name into v_student from public.students where id = v_a.student_id;
  v_name := case v_s.name_mode
    when 'full' then v_student
    when 'given' then case when char_length(v_student) >= 3 and v_student ~ '^[가-힣]+$' then substr(v_student, 2) else v_student end
    else null
  end;
  return jsonb_build_object(
    'academy', (select name from public.academies where id = v_s.academy_id),
    'lesson', v_l.name,
    'student', v_name,
    'expires_at', v_s.expires_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'step', r.step_index,
               'seconds', r.seconds,
               'mime', r.mime,
               'b64', encode(r.audio, 'base64'),
               'line', jsonb_build_object('en', st.s->>'en', 'ko', st.s->>'ko', 'videoId', st.s->>'videoId',
                                          'start', st.s->'start', 'end', st.s->'end')
             ) order by r.step_index)
        from public.solo_recordings r
        left join lateral (select s from jsonb_array_elements(v_l.steps) with ordinality as x(s, n) where n = r.step_index + 1) st on true
       where r.assignment_id = v_a.id
    ), '[]'::jsonb)
  );
end $$;

-- ---------- solo_open: 이 학생이 녹음을 올릴 수 있는지 같이 알린다 ----------
create or replace function public.solo_open(p_token uuid, p_assignment uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
  v_l public.solo_lessons;
begin
  begin
    v_a := public.solo_assignment_for(p_token, p_assignment);
  exception when others then
    return jsonb_build_object('error', case when sqlerrm like '%expired%' then 'expired' else 'not_found' end);
  end;
  select * into v_l from public.solo_lessons where id = v_a.lesson_id;
  if v_a.started_at is null then
    update public.solo_assignments set started_at = now() where id = v_a.id;
  end if;
  return jsonb_build_object(
    'name', v_l.name,
    'progress', v_a.progress,
    'done', v_a.finished_at is not null,
    'can_record', exists (select 1 from public.student_guardian where student_id = v_a.student_id and record_consent_at is not null),
    'steps', (select coalesce(jsonb_agg(public.solo_public_step(s) order by n), '[]'::jsonb)
                from jsonb_array_elements(v_l.steps) with ordinality as x(s, n))
  );
end $$;

-- ---------- 권한 ----------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.student_record_consent_set(uuid, boolean)', 'public.student_guardian_status()',
    'public.solo_record_save(uuid, uuid, int, text, text, numeric)', 'public.solo_record_list(uuid)', 'public.solo_record_get(uuid)',
    'public.solo_share_create(uuid, text, int)', 'public.solo_share_revoke(text)', 'public.solo_share_list(uuid)',
    'public.solo_share_get(text)', 'public.solo_open(uuid, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

grant execute on function public.student_record_consent_set(uuid, boolean) to authenticated;
grant execute on function public.student_guardian_status() to authenticated;
grant execute on function public.solo_record_save(uuid, uuid, int, text, text, numeric) to anon, authenticated;
grant execute on function public.solo_record_list(uuid) to authenticated;
grant execute on function public.solo_record_get(uuid) to authenticated;
grant execute on function public.solo_share_create(uuid, text, int) to authenticated;
grant execute on function public.solo_share_revoke(text) to authenticated;
grant execute on function public.solo_share_list(uuid) to authenticated;
grant execute on function public.solo_share_get(text) to anon, authenticated;
grant execute on function public.solo_open(uuid, uuid) to anon, authenticated;

-- 확인(읽기 전용): 표 2개·함수 8개, 녹음 표가 브라우저에서 막혀 있는지, 새 단계 종류가 정답을 빼는지
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name in ('solo_recordings', 'solo_shares')) as tables_2,
  (select count(*) from pg_proc where proname in ('solo_record_save', 'solo_record_list', 'solo_record_get', 'solo_share_create', 'solo_share_revoke', 'solo_share_list', 'solo_share_get', 'student_record_consent_set')) as functions_8,
  not has_table_privilege('anon', 'public.solo_recordings', 'select') as recordings_hidden,
  not has_table_privilege('anon', 'public.solo_shares', 'select') as shares_hidden,
  (public.solo_public_step('{"t":"lyricBlank","options":["a","b"],"answer":1}'::jsonb) ? 'answer') = false as lyric_answer_stripped;
