-- ============================================================
-- 047 개별수업("오늘의 수업") — 선생님이 만들어 학생에게 내고, 학생이 /s 에서 혼자 한다
--
-- 단체수업(curriculum_lessons)과 따로 둔다: 단체수업의 슬라이드는 선생님이 보여 주는 자료이고,
-- 개별수업의 단계(steps)는 화면이 선생님이 되어 학생이 직접 하게 한다(듣기·고르기·철자 쓰기 …).
--  - solo_lessons       : 개별수업 내용(단계 목록 steps jsonb). 미리 만든 커리큘럼에서 가져오거나 복사해 고친다.
--  - solo_assignments   : 학생에게 낸 수업 + 진행(몇 번째 단계까지)
--  - solo_step_events   : 단계마다 답·"모르겠어요" 기록(추가만)
--  학생은 테이블을 직접 읽지 않고 security definer 함수로만(열쇠 = 045 의 student_sessions).
--  채점은 서버가 한다 — 학생에게 가는 단계에는 정답을 뺀다(solo_public_step).
-- ============================================================

create table if not exists public.solo_lessons (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  class_id uuid references public.classes (id) on delete set null,
  name text not null,
  level text,
  minutes int not null default 15,
  steps jsonb not null default '[]'::jsonb,
  -- 미리 만든 커리큘럼에서 가져왔으면 그 id(예: w-fruit)
  source text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists solo_lessons_academy_idx on public.solo_lessons (academy_id, class_id);
alter table public.solo_lessons enable row level security;
drop policy if exists solo_lessons_staff on public.solo_lessons;
create policy solo_lessons_staff on public.solo_lessons
  for all using (academy_id = public.my_academy_id() and public.is_staff())
          with check (academy_id = public.my_academy_id() and public.is_staff());

create table if not exists public.solo_assignments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  lesson_id uuid not null references public.solo_lessons (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  assigned_by uuid default auth.uid(),
  assigned_at timestamptz not null default now(),
  due_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  -- 끝낸 단계 수(0..단계 수)
  progress int not null default 0,
  unique (lesson_id, student_id)
);
create index if not exists solo_assignments_student_idx on public.solo_assignments (student_id);
alter table public.solo_assignments enable row level security;
drop policy if exists solo_assignments_staff on public.solo_assignments;
create policy solo_assignments_staff on public.solo_assignments
  for select using (academy_id = public.my_academy_id() and public.is_staff());
drop policy if exists solo_assignments_staff_del on public.solo_assignments;
create policy solo_assignments_staff_del on public.solo_assignments
  for delete using (academy_id = public.my_academy_id() and public.is_staff());

create table if not exists public.solo_step_events (
  id bigserial primary key,
  assignment_id uuid not null references public.solo_assignments (id) on delete cascade,
  step_index int not null,
  step_type text not null,
  -- answer: 정답/오답, unsure: "모르겠어요", seen: 보기만 하는 단계를 지나감
  kind text not null check (kind in ('answer', 'unsure', 'seen')),
  correct boolean,
  value text,
  created_at timestamptz not null default now()
);
create index if not exists solo_step_events_assignment_idx on public.solo_step_events (assignment_id, step_index);
alter table public.solo_step_events enable row level security;
revoke all on public.solo_step_events from anon, authenticated;

-- ---------- 도우미 ----------
create or replace function public.solo_norm(p text) returns text
language sql immutable set search_path = public
as $$ select lower(regexp_replace(btrim(coalesce(p, '')), '\s+', ' ', 'g')) $$;

-- 학생에게 보내는 단계: 정답을 뺀다(듣고 고르기는 읽어 줄 낱말이 필요해서 word 는 남는다)
create or replace function public.solo_public_step(p jsonb) returns jsonb
language sql immutable set search_path = public
as $$
  select case
    when p->>'t' in ('pickWord', 'pickMeaning', 'listenPick') then p - 'answer'
    when p->>'t' = 'spell' then p - 'word'
    else p
  end
$$;

-- 단계 하나를 채점한다(보기만 하는 단계는 채점 없음)
create or replace function public.solo_grade(p_step jsonb, p_value text) returns boolean
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick') then
    return (p_step->>'answer')::int = nullif(p_value, '')::int;
  elsif p_step->>'t' = 'spell' then
    return public.solo_norm(p_step->>'word') = public.solo_norm(p_value);
  end if;
  return null;
end $$;

create or replace function public.solo_correct_text(p_step jsonb) returns text
language plpgsql immutable set search_path = public
as $$
begin
  if p_step->>'t' in ('pickWord', 'pickMeaning', 'listenPick') then
    return p_step->'options'->>((p_step->>'answer')::int);
  elsif p_step->>'t' = 'spell' then
    return p_step->>'word';
  end if;
  return null;
end $$;

-- 학생 열쇠로 이 학생의 낸 수업을 찾는다
create or replace function public.solo_assignment_for(p_token uuid, p_assignment uuid) returns public.solo_assignments
language plpgsql security definer set search_path = public
as $$
declare
  v_sid uuid;
  v_a public.solo_assignments;
begin
  v_sid := public.student_session_student(p_token);
  select * into v_a from public.solo_assignments where id = p_assignment and student_id = v_sid;
  if v_a.id is null then
    raise exception 'not_found';
  end if;
  return v_a;
end $$;

-- ---------- 학생: 오늘의 수업 목록 ----------
create or replace function public.solo_list(p_token uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_sid uuid;
begin
  begin
    v_sid := public.student_session_student(p_token);
  exception when others then
    return jsonb_build_object('error', 'expired');
  end;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', a.id, 'name', l.name, 'minutes', l.minutes, 'progress', a.progress,
             'total', jsonb_array_length(l.steps), 'done', a.finished_at is not null, 'due_at', a.due_at
           ) order by (a.finished_at is not null), a.assigned_at desc)
      from public.solo_assignments a
      join public.solo_lessons l on l.id = a.lesson_id
     where a.student_id = v_sid
  ), '[]'::jsonb);
end $$;

-- ---------- 학생: 수업 열기(정답 없이) ----------
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
    'steps', (select coalesce(jsonb_agg(public.solo_public_step(s) order by n), '[]'::jsonb)
                from jsonb_array_elements(v_l.steps) with ordinality as x(s, n))
  );
end $$;

-- ---------- 학생: 답 내기(서버 채점) ----------
create or replace function public.solo_answer(p_token uuid, p_assignment uuid, p_step int, p_value text)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
  v_step jsonb;
  v_ok boolean;
begin
  v_a := public.solo_assignment_for(p_token, p_assignment);
  select s into v_step from public.solo_lessons l, jsonb_array_elements(l.steps) with ordinality as x(s, n)
   where l.id = v_a.lesson_id and n = p_step + 1;
  if v_step is null then
    raise exception 'not_found';
  end if;
  v_ok := public.solo_grade(v_step, p_value);
  insert into public.solo_step_events (assignment_id, step_index, step_type, kind, correct, value)
  values (v_a.id, p_step, v_step->>'t', 'answer', v_ok, left(p_value, 80));
  return jsonb_build_object('correct', coalesce(v_ok, true));
end $$;

-- ---------- 학생: 단계 넘기기("모르겠어요" 포함) — 정답을 알려 주고 진행을 기록 ----------
create or replace function public.solo_advance(p_token uuid, p_assignment uuid, p_step int, p_unsure boolean default false)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
  v_l public.solo_lessons;
  v_step jsonb;
  v_total int;
  v_done boolean;
begin
  v_a := public.solo_assignment_for(p_token, p_assignment);
  select * into v_l from public.solo_lessons where id = v_a.lesson_id;
  v_total := jsonb_array_length(v_l.steps);
  if p_step < 0 or p_step >= v_total then
    raise exception 'not_found';
  end if;
  v_step := v_l.steps->p_step;
  insert into public.solo_step_events (assignment_id, step_index, step_type, kind)
  values (v_a.id, p_step, v_step->>'t', case when p_unsure then 'unsure' else 'seen' end);
  v_done := p_step + 1 >= v_total;
  update public.solo_assignments
     set progress = greatest(progress, p_step + 1),
         finished_at = case when v_done then coalesce(finished_at, now()) else finished_at end
   where id = v_a.id;
  return jsonb_build_object('answer', case when p_unsure then public.solo_correct_text(v_step) end, 'done', v_done);
end $$;

-- 틀린 답을 낸 뒤 "정답 보기"로 넘어갈 때도 정답을 알려 준다(두 번 틀린 경우)
create or replace function public.solo_reveal(p_token uuid, p_assignment uuid, p_step int)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
  v_step jsonb;
begin
  v_a := public.solo_assignment_for(p_token, p_assignment);
  select s into v_step from public.solo_lessons l, jsonb_array_elements(l.steps) with ordinality as x(s, n)
   where l.id = v_a.lesson_id and n = p_step + 1;
  -- 이 단계에서 이미 답을 두 번 이상 냈을 때만
  if (select count(*) from public.solo_step_events where assignment_id = v_a.id and step_index = p_step and kind = 'answer') < 2 then
    raise exception 'too_early';
  end if;
  return jsonb_build_object('answer', public.solo_correct_text(v_step));
end $$;

-- ---------- 선생님: 학생에게 내기 / 현황 ----------
create or replace function public.solo_assign(p_lesson uuid, p_students uuid[], p_due timestamptz default null)
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_n int;
begin
  if not exists (select 1 from public.solo_lessons where id = p_lesson and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  insert into public.solo_assignments (academy_id, lesson_id, student_id, due_at)
  select v_academy, p_lesson, s.id, p_due
    from public.students s
   where s.academy_id = v_academy and s.archived_at is null and s.id = any (p_students)
  on conflict (lesson_id, student_id) do update set due_at = coalesce(excluded.due_at, public.solo_assignments.due_at);
  get diagnostics v_n = row_count;
  return v_n;
end $$;

create or replace function public.solo_status(p_lesson uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.solo_lessons where id = p_lesson and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.name)
      from (
        select a.id as assignment_id, s.id as student_id, s.name,
               a.progress, jsonb_array_length(l.steps) as total,
               a.started_at, a.finished_at, a.due_at,
               count(*) filter (where e.kind = 'answer' and e.correct is true) as right_count,
               count(*) filter (where e.kind = 'answer' and e.correct is false) as wrong_count,
               count(*) filter (where e.kind = 'unsure') as unsure_count,
               -- 모르겠어요를 누른 단계 번호(1부터)
               coalesce(array_agg(distinct e.step_index + 1) filter (where e.kind = 'unsure'), '{}') as unsure_steps
          from public.solo_assignments a
          join public.solo_lessons l on l.id = a.lesson_id
          join public.students s on s.id = a.student_id
          left join public.solo_step_events e on e.assignment_id = a.id
         where a.lesson_id = p_lesson
         group by a.id, s.id, s.name, l.steps
      ) r
  ), '[]'::jsonb);
end $$;

-- ---------- 학생 홈이 낸 수업 수를 같이 주도록 student_home 확장 ----------
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
    'lessons', public.solo_list(p_token),
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

-- ---------- 권한 ----------
do $$
declare
  f text;
begin
  foreach f in array array[
    'public.solo_norm(text)', 'public.solo_public_step(jsonb)', 'public.solo_grade(jsonb, text)', 'public.solo_correct_text(jsonb)',
    'public.solo_assignment_for(uuid, uuid)', 'public.solo_list(uuid)', 'public.solo_open(uuid, uuid)',
    'public.solo_answer(uuid, uuid, int, text)', 'public.solo_advance(uuid, uuid, int, boolean)', 'public.solo_reveal(uuid, uuid, int)',
    'public.solo_assign(uuid, uuid[], timestamptz)', 'public.solo_status(uuid)', 'public.student_home(uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
  end loop;
end $$;

grant execute on function public.solo_open(uuid, uuid) to anon, authenticated;
grant execute on function public.solo_answer(uuid, uuid, int, text) to anon, authenticated;
grant execute on function public.solo_advance(uuid, uuid, int, boolean) to anon, authenticated;
grant execute on function public.solo_reveal(uuid, uuid, int) to anon, authenticated;
grant execute on function public.student_home(uuid) to anon, authenticated;
grant execute on function public.solo_assign(uuid, uuid[], timestamptz) to authenticated;
grant execute on function public.solo_status(uuid) to authenticated;
