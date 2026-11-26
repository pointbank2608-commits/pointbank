-- A review game may span multiple rows because a flip deck or a graded block has a size limit.
begin;
create or replace function public.hw_validate_items(p_items jsonb, p_draft boolean default false) returns void
language plpgsql immutable set search_path = public, pg_temp as $$
declare chunk jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or octet_length(p_items::text) > 1000000 then
    raise exception 'bad_items';
  end if;
  if jsonb_array_length(p_items) <= 60 then
    perform public.hw_validate_items_before_material_cards(p_items,p_draft);
    return;
  end if;
  -- Existing assignments and editors keep their original 60-item limit.
  -- A teacher can append a legacy activity to a grouped material assignment.
  -- Each legacy row still consumes one whole activity regardless of any groupKey it carries.
  if (select count(distinct case
       when coalesce(i#>>'{config,block,groupKey}','') <> '' and
         (i#>>'{config,block,method}' in ('material:learn','material:choice','material:say','material:spell',
           'material:listen','material:repeat','material:hide','material:order','material:write','material:sceneWords',
           'material:watch','material:echo','material:shadow','material:dub')
          or (i#>>'{config,block,groupKey}'='material-final' and i#>>'{config,block,method}' like 'guided-final:%'))
       then 'group:' || (i#>>'{config,block,groupKey}')
       when i->>'kind'='game' and (
         (i#>>'{config,block,groupKey}'='review-game:flip' and i#>>'{config,block,method}'='flip' and i#>>'{config,block,type}'='study') or
         (i#>>'{config,block,type}'='recall' and (
           (i#>>'{config,block,groupKey}'='review-game:memory' and i#>>'{config,game}'='matchup') or
           (i#>>'{config,block,groupKey}'='review-game:guess' and i#>>'{config,game}'='anagram') or
           (i#>>'{config,block,groupKey}'='review-game:shoot' and i#>>'{config,block,method}'='review:shoot')
         ))) then 'group:' || (i#>>'{config,block,groupKey}') else 'row:' || ord::text end)
      from jsonb_array_elements(p_items) with ordinality t(i,ord)) > 60 then
    raise exception 'no_items';
  end if;
  for chunk in
    select jsonb_agg(i order by ord)
    from jsonb_array_elements(p_items) with ordinality t(i,ord)
    group by (ord-1)/60
  loop
    perform public.hw_validate_items_before_material_cards(chunk,p_draft);
  end loop;
end $$;
revoke all on function public.hw_validate_items(jsonb,boolean),
  public.hw_validate_items_before_material_cards(jsonb,boolean) from public,anon,authenticated;

-- The workload reports practice cards for a multi-card flip deck.
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
                 'practice', coalesce(sum(case when flip_text is not null then
                   (select count(*) from regexp_split_to_table(flip_text, E'\n') as deck(line) where btrim(split_part(line,'|',1)) <> '')
                   when completion in ('confirm','review') then 1
                   when completion is null and not is_watch then lines else 0 end),0)
               ) end as material_workload
        from (
          select i.id, i.position, i.kind, i.config#>>'{block,groupKey}' as group_key,
                 i.config#>>'{block,completion}' as completion,
                 case when i.kind='game' and i.config#>>'{block,groupKey}'='review-game:flip'
                   and i.config#>>'{block,method}'='flip' then i.config#>>'{block,text}' end as flip_text,
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
notify pgrst,'reload schema';
commit;
