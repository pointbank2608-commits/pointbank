-- ============================================================
-- 057 개별수업: 낱말 단위 기록 · 복습/누적 테스트 · 도움이 필요한 학생 (2026-10-11)
--
-- 선생님이 정한 표준 50분 흐름의 1단계(어제 복습)·2단계(누적 테스트)·10단계(숙제 안내)를 학생이 자기 자리에서
-- 하고, 선생님은 자기 자리에서 결과를 확인하며 막힌 학생을 돕는다.
--  - solo_step_events.word        : 단계마다 다룬 낱말(트리거가 채움, 기존 기록도 채움) → 낱말별 맞힘·틀림·모르겠어요
--  - solo_review_pool             : (학생) 내가 만난 낱말과 기록 — 앱이 복습·누적 테스트·다시 배우기를 만든다
--  - solo_start_review            : (학생) 앱이 만든 복습 수업을 내 것으로 등록(내가 만난 낱말만 허용)
--  - solo_help / solo_attention   : (학생) 도와주세요 / (선생님) 도움이 필요한 학생 목록
--  - solo_review_list / _check    : (선생님) 복습·누적 테스트 결과 보기·확인
--  - solo_student_words           : (선생님) 한 학생의 약한 낱말·잘하는 낱말(숙제 처방용)
-- 실행 순서: 이 파일 하나. 끝의 select 가 모두 true 여야 한다.
-- ============================================================

-- ---------- 1) 낱말 단위 기록 ----------
alter table public.solo_step_events add column if not exists word text;

-- 단계가 다루는 낱말(소문자). 그림 보고 낱말 고르기·빈칸은 정답 보기, 나머지는 word 칸. 문장 단계는 null.
create or replace function public.solo_step_word(p_step jsonb) returns text
language sql immutable set search_path = public
as $$
  select nullif(lower(btrim(coalesce(
    case when p_step->>'t' in ('pickWord', 'fillBlank') and p_step ? 'options' and p_step ? 'answer'
         then p_step->'options'->>((p_step->>'answer')::int)
         else p_step->>'word' end, ''))), '')
$$;

create or replace function public.solo_event_set_word() returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_step jsonb;
begin
  select x.s into v_step
    from public.solo_assignments a
    join public.solo_lessons l on l.id = a.lesson_id,
         jsonb_array_elements(l.steps) with ordinality as x(s, n)
   where a.id = new.assignment_id and x.n = new.step_index + 1;
  if v_step is not null then
    new.word := public.solo_step_word(v_step);
  end if;
  return new;
end $$;

drop trigger if exists solo_step_events_word on public.solo_step_events;
create trigger solo_step_events_word before insert on public.solo_step_events
  for each row execute function public.solo_event_set_word();

-- 기존 기록도 낱말을 채운다(이미 채워진 것은 건드리지 않음)
update public.solo_step_events e
   set word = public.solo_step_word(x.s)
  from public.solo_assignments a
  join public.solo_lessons l on l.id = a.lesson_id,
       jsonb_array_elements(l.steps) with ordinality as x(s, n)
 where e.assignment_id = a.id and x.n = e.step_index + 1 and e.word is null;

create index if not exists solo_step_events_word_idx on public.solo_step_events (assignment_id, word);

-- ---------- 2) 종류·도움 칸 ----------
alter table public.solo_assignments drop constraint if exists solo_assignments_kind_check;
alter table public.solo_assignments add constraint solo_assignments_kind_check check (kind in ('lesson', 'homework', 'review'));
alter table public.solo_assignments add column if not exists help_at timestamptz;
alter table public.solo_assignments add column if not exists help_step int;
alter table public.solo_assignments add column if not exists checked_at timestamptz;

-- 학생 목록: 끝낸 복습은 숨긴다(복습은 학생 홈의 버튼으로 시작한다)
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
             'total', jsonb_array_length(l.steps), 'done', a.finished_at is not null, 'due_at', a.due_at,
             'kind', a.kind
           ) order by (a.finished_at is not null), a.assigned_at desc)
      from public.solo_assignments a
      join public.solo_lessons l on l.id = a.lesson_id
     where a.student_id = v_sid
       and (a.kind <> 'review' or a.finished_at is null)
  ), '[]'::jsonb);
end $$;

-- ---------- 3) 낱말별 기록(내부 도우미) ----------
-- 한 학생이 만난 낱말마다: 뜻·그림·예문, 맞힘·틀림·모르겠어요 수, 마지막으로 본 때, 최근 수업에 나왔는지,
-- p_assignment 에서 틀렸거나 모르겠다고 했는지.
create or replace function public.solo_word_stats(p_student uuid, p_assignment uuid default null)
returns table (
  word text, meaning text, image_url text, example text, pos text,
  right_n bigint, wrong_n bigint, unsure_n bigint, last_at timestamptz, is_recent boolean, missed_here boolean
)
language sql stable security definer set search_path = public
as $$
  with recent_lessons as (
    select a.lesson_id
      from public.solo_assignments a
     where a.student_id = p_student and a.kind <> 'review' and a.started_at is not null
     order by coalesce(a.finished_at, a.started_at) desc
     limit 3
  ),
  steps as (
    select public.solo_step_word(x.s) as w, x.s, l.id as lesson_id, l.source
      from public.solo_assignments a
      join public.solo_lessons l on l.id = a.lesson_id,
           jsonb_array_elements(l.steps) as x(s)
     where a.student_id = p_student
  ),
  known as (
    select distinct on (w) w,
           s->>'meaning' as meaning, s->>'imageUrl' as image_url, s->>'example' as example, s->>'pos' as pos
      from steps
     where w is not null and s ? 'meaning' and coalesce(s->>'meaning', '') <> ''
     order by w, (s->>'t' = 'meet') desc, (coalesce(s->>'imageUrl', '') <> '') desc
  ),
  recent_words as (
    select distinct w from steps where lesson_id in (select lesson_id from recent_lessons) and w is not null
  ),
  ev as (
    select e.word as w,
           count(*) filter (where e.kind = 'answer' and e.correct is true) as right_n,
           count(*) filter (where e.kind = 'answer' and e.correct is false) as wrong_n,
           count(*) filter (where e.kind = 'unsure') as unsure_n,
           max(e.created_at) as last_at,
           coalesce(bool_or(a.id = p_assignment and (e.kind = 'unsure' or e.correct is false)), false) as missed_here
      from public.solo_step_events e
      join public.solo_assignments a on a.id = e.assignment_id
     where a.student_id = p_student and e.word is not null
     group by e.word
  )
  select k.w, k.meaning, k.image_url, k.example, k.pos,
         coalesce(v.right_n, 0), coalesce(v.wrong_n, 0), coalesce(v.unsure_n, 0), v.last_at,
         (k.w in (select w from recent_words)), coalesce(v.missed_here, false)
    from known k
    left join ev v on v.w = k.w
$$;

-- ---------- 4) 학생: 내 낱말 기록 ----------
create or replace function public.solo_review_pool(p_token uuid, p_assignment uuid default null)
returns jsonb
language plpgsql stable security definer set search_path = public
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
             'word', r.word, 'meaning', r.meaning, 'image_url', r.image_url, 'example', r.example, 'pos', r.pos,
             'right', r.right_n, 'wrong', r.wrong_n, 'unsure', r.unsure_n, 'last_at', r.last_at,
             'recent', r.is_recent, 'missed_here', r.missed_here
           ) order by (r.wrong_n + r.unsure_n) desc, r.last_at nulls first)
      from public.solo_word_stats(v_sid, p_assignment) r
  ), '[]'::jsonb);
end $$;

-- ---------- 5) 학생: 앱이 만든 복습 수업 등록 ----------
create or replace function public.solo_start_review(p_token uuid, p_name text, p_minutes int, p_steps jsonb)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_sid uuid;
  v_st public.students;
  v_known text[];
  v_lesson uuid;
  v_a uuid;
begin
  begin
    v_sid := public.student_session_student(p_token);
  exception when others then
    return jsonb_build_object('error', 'expired');
  end;
  select * into v_st from public.students where id = v_sid;
  if v_st.id is null then
    raise exception 'not_found';
  end if;
  if jsonb_typeof(p_steps) <> 'array' or jsonb_array_length(p_steps) < 2 or jsonb_array_length(p_steps) > 80 then
    raise exception 'bad_steps';
  end if;
  -- 복습에 쓸 수 있는 단계 종류만
  if exists (
    select 1 from jsonb_array_elements(p_steps) s
     where s->>'t' not in ('intro', 'meet', 'pickMeaning', 'pickWord', 'listenPick', 'spell')
  ) then
    raise exception 'bad_steps';
  end if;
  -- 낱말은 이 학생이 만난 것만
  select coalesce(array_agg(distinct w), '{}') into v_known
    from (
      select public.solo_step_word(x.s) as w
        from public.solo_assignments a
        join public.solo_lessons l on l.id = a.lesson_id,
             jsonb_array_elements(l.steps) as x(s)
       where a.student_id = v_sid
    ) q
   where w is not null;
  if exists (
    select 1 from jsonb_array_elements(p_steps) s
     where s->>'t' <> 'intro'
       and (public.solo_step_word(s) is null or not (public.solo_step_word(s) = any (v_known)))
  ) then
    raise exception 'bad_words';
  end if;
  -- 하루에 너무 많이 만들지 않게
  if (select count(*) from public.solo_assignments where student_id = v_sid and kind = 'review' and assigned_at > now() - interval '1 day') >= 30 then
    raise exception 'too_many';
  end if;
  -- 끝내지 않은 예전 복습은 지운다
  delete from public.solo_lessons l
   using public.solo_assignments a
   where a.lesson_id = l.id and a.student_id = v_sid and a.kind = 'review' and a.finished_at is null and l.source = 'review';

  insert into public.solo_lessons (academy_id, class_id, name, level, minutes, steps, source, created_by)
  values (v_st.academy_id, v_st.class_id, left(coalesce(nullif(btrim(p_name), ''), '복습'), 60), null,
          greatest(1, least(coalesce(p_minutes, 5), 30)), p_steps, 'review', null)
  returning id into v_lesson;
  insert into public.solo_assignments (academy_id, lesson_id, student_id, kind, started_at)
  values (v_st.academy_id, v_lesson, v_sid, 'review', now())
  returning id into v_a;
  return jsonb_build_object('assignment', v_a);
end $$;

-- ---------- 6) 학생: 도와주세요 ----------
create or replace function public.solo_help(p_token uuid, p_assignment uuid, p_step int default 0)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_a public.solo_assignments;
begin
  begin
    v_a := public.solo_assignment_for(p_token, p_assignment);
  exception when others then
    return jsonb_build_object('error', case when sqlerrm like '%expired%' then 'expired' else 'not_found' end);
  end;
  update public.solo_assignments set help_at = now(), help_step = greatest(0, coalesce(p_step, 0)) where id = v_a.id;
  return jsonb_build_object('ok', true);
end $$;

-- ---------- 7) 선생님: 도움이 필요한 학생 ----------
create or replace function public.solo_attention()
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.priority, r.last_event_at desc)
      from (
        select a.id as assignment_id, s.id as student_id, s.name, l.name as lesson_name, a.kind,
               a.progress, jsonb_array_length(l.steps) as total,
               case when a.help_at is not null and a.help_at > now() - interval '40 minutes' then 'help'
                    when coalesce(rc.unsure_n, 0) >= 2 then 'unsure'
                    else 'struggling' end as reason,
               case when a.help_at is not null and a.help_at > now() - interval '40 minutes' then 0
                    when coalesce(rc.unsure_n, 0) >= 2 then 1 else 2 end as priority,
               coalesce(a.help_at, rc.last_at) as last_event_at,
               a.help_step, coalesce(rc.wrong_n, 0) as wrong_recent, coalesce(rc.unsure_n, 0) as unsure_recent
          from public.solo_assignments a
          join public.students s on s.id = a.student_id and s.archived_at is null
          join public.solo_lessons l on l.id = a.lesson_id
          left join (
            select e.assignment_id,
                   count(*) filter (where e.kind = 'answer' and e.correct is false) as wrong_n,
                   count(*) filter (where e.kind = 'unsure') as unsure_n,
                   max(e.created_at) as last_at
              from public.solo_step_events e
             where e.created_at > now() - interval '15 minutes'
             group by e.assignment_id
          ) rc on rc.assignment_id = a.id
         where a.academy_id = v_academy and a.finished_at is null
           and ((a.help_at is not null and a.help_at > now() - interval '40 minutes')
                or coalesce(rc.unsure_n, 0) >= 2 or coalesce(rc.wrong_n, 0) >= 4)
      ) r
  ), '[]'::jsonb);
end $$;

create or replace function public.solo_help_clear(p_assignment uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  update public.solo_assignments set help_at = null, help_step = null
   where id = p_assignment and academy_id = v_academy;
end $$;

-- ---------- 8) 선생님: 복습·누적 테스트 결과 ----------
create or replace function public.solo_review_list(p_days int default 7)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  return coalesce((
    select jsonb_agg(row_to_json(r) order by r.assigned_at desc)
      from (
        select a.id as assignment_id, s.id as student_id, s.name, l.name as lesson_name,
               a.assigned_at, a.finished_at, a.checked_at, a.progress, jsonb_array_length(l.steps) as total,
               count(*) filter (where e.kind = 'answer' and e.correct is true) as right_count,
               count(*) filter (where e.kind = 'answer' and e.correct is false) as wrong_count,
               count(*) filter (where e.kind = 'unsure') as unsure_count,
               coalesce(array_agg(distinct e.word) filter (where e.word is not null and (e.kind = 'unsure' or e.correct is false)), '{}') as missed_words
          from public.solo_assignments a
          join public.students s on s.id = a.student_id and s.archived_at is null
          join public.solo_lessons l on l.id = a.lesson_id
          left join public.solo_step_events e on e.assignment_id = a.id
         where a.academy_id = v_academy and a.kind = 'review'
           and a.assigned_at > now() - make_interval(days => greatest(1, least(coalesce(p_days, 7), 60)))
         group by a.id, s.id, s.name, l.name, l.steps
      ) r
  ), '[]'::jsonb);
end $$;

create or replace function public.solo_review_check(p_assignments uuid[])
returns int
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
  v_n int;
begin
  update public.solo_assignments set checked_at = now()
   where id = any (p_assignments) and academy_id = v_academy and kind = 'review';
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ---------- 9) 선생님: 한 학생의 낱말 기록(처방용) ----------
create or replace function public.solo_student_words(p_student uuid)
returns jsonb
language plpgsql stable security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.students where id = p_student and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'word', r.word, 'meaning', r.meaning, 'image_url', r.image_url, 'example', r.example, 'pos', r.pos,
             'right', r.right_n, 'wrong', r.wrong_n, 'unsure', r.unsure_n, 'last_at', r.last_at
           ) order by (r.wrong_n + r.unsure_n) desc, r.last_at nulls first)
      from public.solo_word_stats(p_student, null) r
  ), '[]'::jsonb);
end $$;

-- ---------- 권한 ----------
revoke all on function public.solo_step_word(jsonb) from public, anon, authenticated;
revoke all on function public.solo_event_set_word() from public, anon, authenticated;
revoke all on function public.solo_word_stats(uuid, uuid) from public, anon, authenticated;
revoke all on function public.solo_list(uuid) from public, anon, authenticated;
revoke all on function public.solo_review_pool(uuid, uuid) from public, anon, authenticated;
revoke all on function public.solo_start_review(uuid, text, int, jsonb) from public, anon, authenticated;
revoke all on function public.solo_help(uuid, uuid, int) from public, anon, authenticated;
revoke all on function public.solo_attention() from public, anon, authenticated;
revoke all on function public.solo_help_clear(uuid) from public, anon, authenticated;
revoke all on function public.solo_review_list(int) from public, anon, authenticated;
revoke all on function public.solo_review_check(uuid[]) from public, anon, authenticated;
revoke all on function public.solo_student_words(uuid) from public, anon, authenticated;

grant execute on function public.solo_review_pool(uuid, uuid) to anon, authenticated;
grant execute on function public.solo_start_review(uuid, text, int, jsonb) to anon, authenticated;
grant execute on function public.solo_help(uuid, uuid, int) to anon, authenticated;
grant execute on function public.solo_attention() to authenticated;
grant execute on function public.solo_help_clear(uuid) to authenticated;
grant execute on function public.solo_review_list(int) to authenticated;
grant execute on function public.solo_review_check(uuid[]) to authenticated;
grant execute on function public.solo_student_words(uuid) to authenticated;

-- 확인(읽기 전용): 모두 true 여야 한다
select
  exists (select 1 from information_schema.columns where table_name = 'solo_step_events' and column_name = 'word') as has_word_col,
  exists (select 1 from pg_trigger where tgname = 'solo_step_events_word') as has_trigger,
  exists (select 1 from information_schema.columns where table_name = 'solo_assignments' and column_name = 'help_at') as has_help_col,
  (select count(*) from pg_proc where proname in ('solo_review_pool', 'solo_start_review', 'solo_help', 'solo_attention', 'solo_review_list', 'solo_review_check', 'solo_student_words', 'solo_help_clear')) = 8 as has_functions,
  (select count(*) filter (where word is not null) from public.solo_step_events) >= 0 as backfilled;
