-- 093d: 선생님 화면용 — 숙제 대상 학생 × 영상별 본 횟수·마지막 날·이번에 본 정도(%).

create or replace function public.hw_watch_summary(p_assignment_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $fn$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  if not exists (select 1 from public.homework_assignments where id = p_assignment_id and academy_id = v_academy) then
    raise exception 'not_found';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'student_id', s.id, 'name', s.name, 'item_id', i.id,
      'target', greatest(1, least(coalesce((i.config->>'targetViews')::int, 1), 10)),
      'views', (select count(*) from public.homework_watch_views w where w.attempt_id = t.id and w.item_id = i.id and w.completed_at is not null),
      'last_at', (select max(w.completed_at) from public.homework_watch_views w where w.attempt_id = t.id and w.item_id = i.id),
      'partial_pct', (select round(100.0 * max(w.watched_sec) / nullif(max(w.duration_sec), 0)) from public.homework_watch_views w where w.attempt_id = t.id and w.item_id = i.id and w.completed_at is null)
    ) order by s.name, i.position)
    from public.homework_assignment_targets g
    join public.students s on s.id = g.student_id
    join public.homework_items i on i.assignment_id = p_assignment_id and coalesce(i.config->>'watch', '') = 'true'
    left join public.homework_attempts t on t.assignment_id = p_assignment_id and t.student_id = s.id
    where g.assignment_id = p_assignment_id
  ), '[]'::jsonb);
end $fn$;
