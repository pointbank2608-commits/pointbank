-- 074: 닫힌 기능은 학생 쪽에서도 막는다 — 학생 열쇠로 들어오는 모든 함수가 거치는 두 곳(개별수업·숙제).
-- 닫히면 'feature_closed' 로 거절한다(선생님이 닫은 학원의 학생 링크는 열리지 않는다).

create or replace function public.solo_assignment_for(p_token uuid, p_assignment uuid) returns public.solo_assignments
language plpgsql security definer set search_path = public
as $fn$
declare
  v_sid uuid;
  v_a public.solo_assignments;
begin
  v_sid := public.student_session_student(p_token);
  select * into v_a from public.solo_assignments where id = p_assignment and student_id = v_sid;
  if v_a.id is null then
    raise exception 'not_found';
  end if;
  if not public.academy_feature(v_a.academy_id, 'solo') then
    raise exception 'feature_closed';
  end if;
  return v_a;
end $fn$;

create or replace function public.hw_attempt_for(p_token uuid, p_read boolean default false) returns public.homework_attempts
language plpgsql stable security definer set search_path = public
as $fn$
declare
  v_t public.homework_attempts;
  v_a public.homework_assignments;
begin
  select * into v_t from public.homework_attempts where token = p_token;
  if v_t.id is null then
    raise exception 'not_found';
  end if;
  select * into v_a from public.homework_assignments where id = v_t.assignment_id;
  if not public.academy_feature(v_a.academy_id, 'homework') then
    raise exception 'feature_closed';
  end if;
  if p_read and v_t.finished_at is not null then
    return v_t;
  end if;
  if v_a.closed_at is not null then
    raise exception 'closed';
  end if;
  if v_a.due_at is not null and v_a.due_at < now() then
    raise exception 'past_due';
  end if;
  return v_t;
end $fn$;
