begin;
-- Count a teacher-selected material activity once, including when each recording
-- needs a separate item for submission or a large quiz spans multiple items.
create or replace function public.hw_class_overview(p_class_id uuid)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_academy uuid := public.hw_staff_academy();
begin
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc)
    from (
      select a.id, a.title, a.code, a.kind, a.group_id, a.due_at, a.closed_at, a.created_at,
             coalesce(a.target_count, 0) as target_count,
             (select count(*) from public.homework_attempts t where t.assignment_id=a.id and t.finished_at is not null) as done,
             (select count(*) from public.homework_attempts t where t.assignment_id=a.id and t.finished_at is null) as doing,
             (select round(avg(t.score::numeric / nullif(t.total, 0))*100) from public.homework_attempts t where t.assignment_id=a.id and t.finished_at is not null) as avg_pct,
             items.kinds, items.question_count, items.material_workload,
             (select s.name from public.homework_assignment_targets g join public.students s on s.id=g.student_id where g.assignment_id=a.id and a.kind='custom' limit 1) as custom_student
      from public.homework_assignments a
      cross join lateral (
        select jsonb_agg(kind order by position) as kinds, coalesce(sum(q),0) as question_count,
               case when exists(select 1 from public.homework_material_assignments m where m.assignment_id=a.id) then jsonb_build_object(
                 'activities', count(distinct coalesce(group_key,id::text)) filter (where q>0 or completion<>'answers' or is_watch or lines>0),
                 'questions', coalesce(sum(q),0),
                 'recordings', count(*) filter (where completion='recording'),
                 'videos', count(*) filter (where completion='watch' or is_watch),
                 'practice', coalesce(sum(case when completion in ('confirm','review') then 1
                   when completion is null and not is_watch then lines else 0 end),0)
               ) end as material_workload
        from (
          select i.id, i.position, i.kind, i.config#>>'{block,groupKey}' as group_key,
                 i.config#>>'{block,completion}' as completion,
                 coalesce(i.config->>'watch','false')='true' as is_watch,
                 case when i.kind='shadowing' then jsonb_array_length(coalesce(i.content->'lines','[]'::jsonb)) else 0 end as lines,
                 jsonb_array_length(coalesce(i.content->'questions','[]'::jsonb)) as q
          from public.homework_items i where i.assignment_id=a.id
        ) snapshot
      ) items
      where a.class_id=p_class_id and a.academy_id=v_academy
      order by a.created_at desc limit 60
    ) x
  ), '[]'::jsonb);
end $$;

-- A submitted recording may refer to a retired item after an in-place edit.
create function public.hw_recording_originals(p_assignment uuid) returns table(id uuid,config jsonb)
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare cls uuid;
begin
  select h.class_id into cls from public.homework_assignments h
    where h.id=p_assignment and h.academy_id=public.hw_staff_academy();
  if cls is null then raise exception 'not_found'; end if;
  perform public.hw_block_academy(cls);
  return query select i.id,i.config from public.homework_items i
    where (i.assignment_id=p_assignment or i.retired_from=p_assignment)
      and i.config#>>'{block,completion}'='recording';
end $$;
revoke all on function public.hw_recording_originals(uuid) from public,anon,authenticated;
grant execute on function public.hw_recording_originals(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
