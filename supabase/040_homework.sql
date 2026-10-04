-- ============================================================
--  040: Classbank Student ② 학생 숙제 링크 — 2026-10-04
--
--  선생님이 단어장으로 숙제(문제 묶음)를 만들면 6자리 숙제 번호·링크·QR 이 생긴다.
--  학생은 가입·로그인 없이 /hw/번호 → 반 명단에서 자기 이름 → 4자리 PIN → 문제를 푼다
--  (만 14세 미만 회원가입·법정대리인 동의를 피하려고 계정을 만들지 않는다).
--  학생 쪽은 테이블을 직접 못 읽고 아래 security definer 함수(hw_open / hw_login / hw_state /
--  hw_answer / hw_finish)로만 드나든다. 답마다 스탯 태그(skill)·낱말이 남아 ③ 학생 스탯의 재료가 된다.
--  선생님은 로그인한 staff 라 RLS 로 숙제·진행·답을 직접 읽는다.
--
--  SQL Editor 에서 한 번 실행. 여러 번 실행해도 안전.
-- ============================================================

-- 학생 PIN(4자리 숫자) — 선생님이 학생관리·숙제 화면에서 보고 다시 만들 수 있다
alter table public.students add column if not exists hw_pin text;
update public.students set hw_pin = lpad((floor(random() * 10000))::int::text, 4, '0') where hw_pin is null;
alter table public.students alter column hw_pin set default lpad((floor(random() * 10000))::int::text, 4, '0');

create table if not exists public.homework_assignments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  title text not null default '',
  -- 6자리 숫자(휴대폰 숫자 자판으로 치기 쉽게). 열려 있는 숙제끼리는 겹치지 않는다.
  code text not null,
  -- 문제 전체(LiveQuestion[] 과 같은 모양 + skill). 만들 때 복사해 두므로 단어장을 고쳐도 숙제는 그대로.
  questions jsonb not null default '[]'::jsonb,
  word_list_id uuid references public.word_lists(id) on delete set null,
  -- 어떤 활동을 몇 문제씩 냈는지(다시 만들기·화면 표시용)
  settings jsonb not null default '{}'::jsonb,
  due_at timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists homework_assignments_class_idx on public.homework_assignments (class_id, created_at desc);
create unique index if not exists homework_assignments_open_code on public.homework_assignments (code) where closed_at is null;

create table if not exists public.homework_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.homework_assignments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  -- 학생 기기가 들고 있는 열쇠(이걸로만 답을 낸다)
  token uuid not null default gen_random_uuid() unique,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  finished_at timestamptz,
  score int not null default 0,
  total int not null default 0,
  unique (assignment_id, student_id)
);
create index if not exists homework_attempts_assignment_idx on public.homework_attempts (assignment_id);

create table if not exists public.homework_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.homework_attempts(id) on delete cascade,
  q_index int not null,
  -- 스탯 태그(예: vocab.meaning, vocab.spelling, listening.word, vocab.context)
  skill text not null default '',
  word text not null default '',
  correct boolean not null,
  response text,
  -- 문제를 본 뒤 답하기까지 걸린 시간(ms)
  ms int,
  answered_at timestamptz not null default now(),
  unique (attempt_id, q_index)
);
create index if not exists homework_answers_attempt_idx on public.homework_answers (attempt_id);

-- PIN 을 너무 많이 틀리면 잠깐 막는다(이름별 10분에 8번)
create table if not exists public.homework_pin_failures (
  id bigserial primary key,
  student_id uuid not null references public.students(id) on delete cascade,
  failed_at timestamptz not null default now()
);
create index if not exists homework_pin_failures_idx on public.homework_pin_failures (student_id, failed_at desc);

alter table public.homework_assignments enable row level security;
alter table public.homework_attempts enable row level security;
alter table public.homework_answers enable row level security;
alter table public.homework_pin_failures enable row level security;

drop policy if exists homework_assignments_staff on public.homework_assignments;
create policy homework_assignments_staff on public.homework_assignments
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());

drop policy if exists homework_attempts_staff on public.homework_attempts;
create policy homework_attempts_staff on public.homework_attempts
  for all using (exists (
    select 1 from public.homework_assignments a
    where a.id = assignment_id and a.academy_id = public.my_academy_id() and public.is_staff()
  ));

drop policy if exists homework_answers_staff on public.homework_answers;
create policy homework_answers_staff on public.homework_answers
  for all using (exists (
    select 1 from public.homework_attempts t
    join public.homework_assignments a on a.id = t.assignment_id
    where t.id = attempt_id and a.academy_id = public.my_academy_id() and public.is_staff()
  ));

-- ---------- 선생님: 숙제 내기 ----------
create or replace function public.hw_create(
  p_class_id uuid,
  p_title text,
  p_questions jsonb,
  p_word_list_id uuid default null,
  p_settings jsonb default '{}'::jsonb,
  p_due_at timestamptz default null
) returns public.homework_assignments
language plpgsql security definer set search_path = public
as $$
declare
  v_code text;
  v_row public.homework_assignments;
begin
  if not public.is_staff() or public.my_academy_id() is null then
    raise exception 'not_staff';
  end if;
  if not exists (select 1 from public.classes c where c.id = p_class_id and c.academy_id = public.my_academy_id()) then
    raise exception 'bad_class';
  end if;
  if jsonb_typeof(p_questions) <> 'array' or jsonb_array_length(p_questions) = 0 then
    raise exception 'no_questions';
  end if;
  loop
    v_code := lpad((floor(random() * 900000) + 100000)::int::text, 6, '0');
    exit when not exists (select 1 from public.homework_assignments where code = v_code and closed_at is null);
  end loop;
  insert into public.homework_assignments (academy_id, class_id, title, code, questions, word_list_id, settings, due_at)
  values (public.my_academy_id(), p_class_id, coalesce(p_title, ''), v_code, p_questions, p_word_list_id, coalesce(p_settings, '{}'::jsonb), p_due_at)
  returning * into v_row;
  return v_row;
end $$;

-- ---------- 학생: 숙제 번호로 열기(제목·반 이름·명단 이름만) ----------
create or replace function public.hw_open(p_code text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.homework_assignments;
begin
  select * into v_a from public.homework_assignments where code = trim(p_code) and closed_at is null order by created_at desc limit 1;
  if v_a.id is null then
    raise exception 'not_found';
  end if;
  return jsonb_build_object(
    'title', v_a.title,
    'class_name', (select name from public.classes where id = v_a.class_id),
    'due_at', v_a.due_at,
    'count', jsonb_array_length(v_a.questions),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'name', s.name,
        'done', exists (select 1 from public.homework_attempts t where t.assignment_id = v_a.id and t.student_id = s.id and t.finished_at is not null)
      ) order by s.name)
      from public.students s where s.class_id = v_a.class_id
    ), '[]'::jsonb)
  );
end $$;

-- ---------- 학생: 이름 + PIN 으로 들어가기 → 열쇠 ----------
create or replace function public.hw_login(p_code text, p_student_id uuid, p_pin text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.homework_assignments;
  v_s public.students;
  v_t public.homework_attempts;
begin
  select * into v_a from public.homework_assignments where code = trim(p_code) and closed_at is null order by created_at desc limit 1;
  if v_a.id is null then
    raise exception 'not_found';
  end if;
  select * into v_s from public.students where id = p_student_id and class_id = v_a.class_id;
  if v_s.id is null then
    raise exception 'not_found';
  end if;
  if (select count(*) from public.homework_pin_failures where student_id = v_s.id and failed_at > now() - interval '10 minutes') >= 8 then
    raise exception 'locked';
  end if;
  if coalesce(v_s.hw_pin, '') <> trim(coalesce(p_pin, '')) then
    insert into public.homework_pin_failures (student_id) values (v_s.id);
    raise exception 'wrong_pin';
  end if;
  insert into public.homework_attempts (assignment_id, student_id, total)
  values (v_a.id, v_s.id, jsonb_array_length(v_a.questions))
  on conflict (assignment_id, student_id) do update set last_seen_at = now()
  returning * into v_t;
  return jsonb_build_object('token', v_t.token, 'name', v_s.name);
end $$;

-- ---------- 학생: 숙제 내용 + 지금까지 낸 답 ----------
-- 숙제는 바로바로 정답을 알려 주는 연습이라 정답도 같이 보낸다(대회 퀴즈쇼와 다르다).
create or replace function public.hw_state(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_t public.homework_attempts;
  v_a public.homework_assignments;
begin
  select * into v_t from public.homework_attempts where token = p_token;
  if v_t.id is null then
    raise exception 'not_found';
  end if;
  select * into v_a from public.homework_assignments where id = v_t.assignment_id;
  update public.homework_attempts set last_seen_at = now() where id = v_t.id;
  return jsonb_build_object(
    'title', v_a.title,
    'name', (select name from public.students where id = v_t.student_id),
    'questions', v_a.questions,
    'closed', v_a.closed_at is not null,
    'finished', v_t.finished_at is not null,
    'answers', coalesce((
      select jsonb_agg(jsonb_build_object('q_index', q_index, 'correct', correct, 'response', response) order by q_index)
      from public.homework_answers where attempt_id = v_t.id
    ), '[]'::jsonb)
  );
end $$;

-- ---------- 학생: 답 하나 ----------
create or replace function public.hw_answer(
  p_token uuid,
  p_q_index int,
  p_correct boolean,
  p_response text,
  p_skill text,
  p_word text,
  p_ms int
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_t public.homework_attempts;
begin
  select * into v_t from public.homework_attempts where token = p_token;
  if v_t.id is null then
    raise exception 'not_found';
  end if;
  if v_t.finished_at is not null then
    return; -- 끝낸 숙제는 그대로(다시 풀기는 기록하지 않는다)
  end if;
  insert into public.homework_answers (attempt_id, q_index, skill, word, correct, response, ms)
  values (v_t.id, p_q_index, left(coalesce(p_skill, ''), 40), left(coalesce(p_word, ''), 80), p_correct, left(p_response, 200), p_ms)
  on conflict (attempt_id, q_index) do nothing;
  update public.homework_attempts set last_seen_at = now() where id = v_t.id;
end $$;

-- ---------- 학생: 다 풀었어요 ----------
create or replace function public.hw_finish(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_t public.homework_attempts;
  v_score int;
begin
  select * into v_t from public.homework_attempts where token = p_token;
  if v_t.id is null then
    raise exception 'not_found';
  end if;
  select count(*) into v_score from public.homework_answers where attempt_id = v_t.id and correct;
  update public.homework_attempts
     set finished_at = coalesce(finished_at, now()), score = v_score, last_seen_at = now()
   where id = v_t.id;
  return jsonb_build_object('score', v_score, 'total', v_t.total);
end $$;

grant execute on function public.hw_open(text) to anon, authenticated;
grant execute on function public.hw_login(text, uuid, text) to anon, authenticated;
grant execute on function public.hw_state(uuid) to anon, authenticated;
grant execute on function public.hw_answer(uuid, int, boolean, text, text, text, int) to anon, authenticated;
grant execute on function public.hw_finish(uuid) to anon, authenticated;
grant execute on function public.hw_create(uuid, text, jsonb, uuid, jsonb, timestamptz) to authenticated;
