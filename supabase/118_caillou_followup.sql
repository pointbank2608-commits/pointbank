-- Caillou 1: delayed, unsupported first response and teacher-reviewed follow-up.
begin;

create table public.caillou_followups (
  assignment_id uuid primary key references public.solo_assignments(id) on delete cascade,
  lesson_hash text not null,
  item_version text not null default 'caillou-by-myself-schoolbag-v1',
  rule_version text not null default 'caillou-transfer-v1',
  enabled_by uuid not null,
  enabled_at timestamptz not null default now(),
  first_answer text,
  first_grade text check (first_grade in ('matched', 'missing', 'review')),
  first_at timestamptz,
  hint_at timestamptz,
  retry_answer text,
  retry_grade text check (retry_grade in ('matched', 'missing', 'review')),
  finished_at timestamptz,
  approved_lesson text,
  approved_homework text,
  approved_by uuid,
  approved_at timestamptz
);
alter table public.caillou_followups enable row level security;
revoke all on public.caillou_followups from public, anon, authenticated;

create function public.caillou_followup_opens(p_finished timestamptz) returns timestamptz
language sql immutable set search_path = pg_catalog, public as $$
  select ((p_finished at time zone 'Asia/Seoul')::date + 1)::timestamp at time zone 'Asia/Seoul';
$$;

create function public.caillou_followup_steps(p_assignment uuid, p_current jsonb) returns jsonb
language sql stable set search_path = pg_catalog, public as $$
  select coalesce((select s.definition->'grading'->'steps' from public.learning_solo_versions v
    join public.learning_sensor_snapshots s on s.id=v.snapshot_id where v.assignment_id=p_assignment),p_current);
$$;

-- Incomplete/novel answers that include the target need human review. This is not a general grammar grader.
create function public.caillou_followup_grade(p_value text) returns text
language sql immutable set search_path = pg_catalog, public as $$
  with normalized as (
    select btrim(regexp_replace(lower(replace(p_value, '’', chr(39))), '[[:space:]]+', ' ', 'g'), ' .!?') as answer
  )
  select case
    when answer ~ $pattern$^(i (want to|would like to)|i'd like to) (pack( up)?|get|prepare) my (school ?bag|backpack|bag)( all)? by myself( for school)?$pattern$ then 'matched'
    when answer !~ '\mby myself\M' then 'missing'
    else 'review'
  end from normalized;
$$;

create function public.caillou_followup_state(f public.caillou_followups, p_opens timestamptz) returns jsonb
language sql stable set search_path = pg_catalog, public as $$
  select jsonb_build_object(
    'assignment_id', f.assignment_id, 'item_version', f.item_version, 'rule_version', f.rule_version, 'opens_at', p_opens,
    'available', coalesce(p_opens <= now(), false), 'first_grade', f.first_grade,
    'hint_used', f.hint_at is not null, 'retry_grade', f.retry_grade,
    'hint', case when f.hint_at is not null and f.finished_at is null
      then '‘혼자서’는 영어로 by myself예요. ‘가방을 챙기다’는 pack my bag으로 말할 수 있어요.' end,
    'done', f.finished_at is not null
  );
$$;

create function public.caillou_followup_teacher(p_lesson uuid, p_assignment uuid default null,
  p_action text default 'list', p_lesson_plan text default null, p_homework_plan text default null) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare ac uuid := public.hw_staff_academy(); lesson public.solo_lessons; a public.solo_assignments; steps jsonb;
begin
  select * into lesson from public.solo_lessons where id=p_lesson and academy_id=ac;
  if lesson.source is null or lesson.source !~ '^verified-video-0ca33141-ab1b-40bb-b361-8be0ff158da6-v[0-9]+-(10|20|40)-1$'
    then raise exception 'not_found'; end if;
  if p_action <> 'list' then
    select sa.* into a from public.solo_assignments sa join public.students s on s.id=sa.student_id
      where sa.id=p_assignment and sa.lesson_id=p_lesson and sa.kind='lesson' and sa.academy_id=ac
        and s.academy_id=ac and s.archived_at is null for update of sa;
    if a.id is null then raise exception 'not_found'; end if;
    if not coalesce(public.academy_feature(ac,'solo'),false) or not coalesce(public.academy_feature(ac,'homework'),false)
      then raise exception 'feature_closed'; end if;
    if p_action='enable' then
      steps := public.caillou_followup_steps(a.id,lesson.steps);
      if not steps @> '[{"t":"meet","word":"by myself","meaning":"혼자서"}]' then raise exception 'target_missing'; end if;
      insert into public.caillou_followups(assignment_id,lesson_hash,enabled_by)
        values(a.id,md5(steps::text),auth.uid()) on conflict(assignment_id) do nothing;
    elsif p_action='approve' then
      if coalesce(length(btrim(p_lesson_plan)),0) not between 1 and 1000
        or coalesce(length(btrim(p_homework_plan)),0) not between 1 and 1000 then raise exception 'invalid_plan'; end if;
      update public.caillou_followups set approved_lesson=btrim(p_lesson_plan), approved_homework=btrim(p_homework_plan),
        approved_by=auth.uid(), approved_at=coalesce(approved_at,now())
        where assignment_id=a.id and finished_at is not null and approved_at is null;
      if not found and not exists(select 1 from public.caillou_followups where assignment_id=a.id
        and approved_lesson=btrim(p_lesson_plan) and approved_homework=btrim(p_homework_plan))
        then raise exception 'approval_unavailable'; end if;
    else raise exception 'invalid_action';
    end if;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('assignment_id', sa.id, 'name', s.name, 'enabled', f.assignment_id is not null,
    'target_selected', version.steps @> '[{"t":"meet","word":"by myself","meaning":"혼자서"}]', 'lesson_changed', not v.valid,
    'state', case when f.assignment_id is not null then public.caillou_followup_state(f,case when v.valid then public.caillou_followup_opens(sa.finished_at) end) end,
    'first_answer', f.first_answer, 'first_at', f.first_at, 'retry_answer', f.retry_answer,
    'lesson_version_recorded', exists(select 1 from public.learning_solo_versions where assignment_id=sa.id),
    'approved_lesson', f.approved_lesson, 'approved_homework', f.approved_homework) order by s.name, sa.id)
    from public.solo_assignments sa join public.students s on s.id=sa.student_id
    left join public.caillou_followups f on f.assignment_id=sa.id
    cross join lateral (select public.caillou_followup_steps(sa.id,lesson.steps) as steps) version
    cross join lateral (select f.assignment_id is null or f.first_at is not null or f.lesson_hash=md5(version.steps::text) as valid) v
    where sa.lesson_id=p_lesson and sa.academy_id=ac and sa.kind='lesson' and s.academy_id=ac and s.archived_at is null),'[]'::jsonb);
end;
$$;

create function public.caillou_followup_student(p_token uuid, p_assignment uuid default null,
  p_action text default 'list', p_value text default null) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare sid uuid := public.student_session_student(p_token); ac uuid; a public.solo_assignments;
  f public.caillou_followups; opens timestamptz; value text := regexp_replace(p_value,'^[[:space:]]+|[[:space:]]+$','','g'); grade text;
begin
  select academy_id into ac from public.students where id=sid and archived_at is null;
  if ac is null then raise exception 'not_found'; end if;
  if not coalesce(public.academy_feature(ac,'solo'),false) or not coalesce(public.academy_feature(ac,'homework'),false)
    then raise exception 'feature_closed'; end if;
  if p_action='list' then
    return coalesce((select jsonb_agg(public.caillou_followup_state(cf,public.caillou_followup_opens(sa.finished_at)) order by sa.assigned_at desc)
      from public.caillou_followups cf join public.solo_assignments sa on sa.id=cf.assignment_id
      join public.solo_lessons l on l.id=sa.lesson_id
      where sa.student_id=sid and sa.academy_id=ac and sa.kind='lesson' and l.academy_id=ac
        and (cf.first_at is not null or cf.lesson_hash=md5(public.caillou_followup_steps(sa.id,l.steps)::text))),'[]'::jsonb);
  end if;
  select * into a from public.solo_assignments where id=p_assignment and student_id=sid and academy_id=ac and kind='lesson' for update;
  if a.id is null then raise exception 'not_found'; end if;
  select * into f from public.caillou_followups where assignment_id=a.id for update;
  if f.assignment_id is null or not exists(select 1 from public.solo_lessons l where l.id=a.lesson_id and l.academy_id=ac
    and (f.first_at is not null or f.lesson_hash=md5(public.caillou_followup_steps(a.id,l.steps)::text))) then raise exception 'not_found'; end if;
  opens := public.caillou_followup_opens(a.finished_at);
  if opens is null or opens > now() then raise exception 'not_open'; end if;

  if p_action in ('first','retry') then
    if coalesce(length(value),0) not between 1 and 300 then raise exception 'invalid_answer'; end if;
    grade := public.caillou_followup_grade(value);
    if p_action='first' then
      if f.first_at is null then
        update public.caillou_followups set first_answer=value, first_grade=grade, first_at=now(),
          finished_at=case when grade='matched' then now() end where assignment_id=a.id returning * into f;
      elsif f.first_answer <> value then raise exception 'already_answered'; end if;
    elsif f.first_at is null or f.first_grade='matched' then raise exception 'retry_unavailable';
    elsif f.retry_answer is null then
      update public.caillou_followups set retry_answer=value, retry_grade=grade, finished_at=now()
        where assignment_id=a.id returning * into f;
    elsif f.retry_answer <> value then raise exception 'already_answered';
    end if;
  elsif p_action='hint' then
    if f.first_at is null or f.finished_at is not null then raise exception 'hint_unavailable'; end if;
    update public.caillou_followups set hint_at=coalesce(hint_at,now()) where assignment_id=a.id returning * into f;
  else raise exception 'invalid_action';
  end if;
  return public.caillou_followup_state(f,opens);
end;
$$;

revoke execute on function public.caillou_followup_opens(timestamptz), public.caillou_followup_grade(text), public.caillou_followup_steps(uuid,jsonb),
  public.caillou_followup_state(public.caillou_followups,timestamptz),
  public.caillou_followup_teacher(uuid,uuid,text,text,text), public.caillou_followup_student(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.caillou_followup_teacher(uuid,uuid,text,text,text) to authenticated;
grant execute on function public.caillou_followup_student(uuid,uuid,text,text) to anon, authenticated;
commit;
