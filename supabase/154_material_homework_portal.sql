-- Material homework uses the student session even when opened from a personal link.
begin;
-- Remember the login requirement across edits, even if the last material
-- activity is replaced before anyone starts the homework.
create table public.homework_material_assignments (
  assignment_id uuid primary key references public.homework_assignments(id) on delete cascade
);
alter table public.homework_material_assignments enable row level security;
revoke all on public.homework_material_assignments from public,anon,authenticated;
create function public.hw_mark_material_assignment() returns trigger
language plpgsql security definer set search_path=pg_catalog,public as $$
begin
  insert into public.homework_material_assignments(assignment_id)
  select distinct assignment_id from new_items
  where assignment_id is not null and config->'block' ? 'groupKey'
  on conflict do nothing;
  return null;
end $$;
revoke all on function public.hw_mark_material_assignment() from public,anon,authenticated;
create trigger hw_mark_material_assignment after insert on public.homework_items
  referencing new table as new_items for each statement execute function public.hw_mark_material_assignment();
insert into public.homework_material_assignments(assignment_id)
select distinct coalesce(assignment_id,retired_from) from public.homework_items where config->'block' ? 'groupKey';

-- The copy can contain only legacy activities after an edit. Inherit its source's
-- login and workload policy in the same transaction as the new assignment.
create function public.hw_reissue_publication(p_source uuid,p_draft jsonb,p_students uuid[],p_due timestamptz,p_request uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare source_class uuid; repeat_policy jsonb; draft jsonb; result jsonb;
begin
  select a.class_id,a.settings->'shortRepeat' into source_class,repeat_policy
    from public.homework_assignments a
    where a.id=p_source and a.academy_id=public.hw_staff_academy() for share;
  if not found then raise exception 'not_found'; end if;
  perform public.hw_block_academy(source_class);
  if coalesce(cardinality(p_students),0)=0 then raise exception 'no_students'; end if;
  -- Include source in the existing request fingerprint so retrying another
  -- publication with the same request cannot reuse or reclassify its assignment.
  draft:=(p_draft-'shortRepeat')||jsonb_build_object('reissuedFrom',p_source);
  if repeat_policy is not null and repeat_policy<>'null'::jsonb then
    result:=public.hw_assign_short(source_class,draft||jsonb_build_object('shortRepeat',repeat_policy),p_students,p_due,p_request);
  else
    result:=public.hw_assign_draft(source_class,draft,p_students,p_due,p_request);
  end if;
  if exists(select id from unnest(p_students) id except select t.student_id
    from public.homework_assignment_targets t where t.assignment_id=(result->>'id')::uuid) then
    raise exception 'bad_student';
  end if;
  insert into public.homework_material_assignments(assignment_id)
    select (result->>'id')::uuid from public.homework_material_assignments where assignment_id=p_source
    on conflict do nothing;
  return result;
end $$;
revoke all on function public.hw_reissue_publication(uuid,jsonb,uuid[],timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.hw_reissue_publication(uuid,jsonb,uuid[],timestamptz,uuid) to authenticated;
-- The teacher snapshot retains the answer for grading. Cloze, ordering and
-- full-writing prompts expose only the fields needed to solve the exercise.
create or replace function public.hw_public_item(i public.homework_items) returns jsonb
language sql stable as $$
 select jsonb_build_object('id',i.id,'kind',i.kind,'title',i.title,
   'config',case when i.config ? 'block' then jsonb_set(i.config,'{block}',((i.config->'block') - 'source' - 'spellingHints') - case when i.config->'block'->>'completion' = 'answers' then 'text' else '__unused' end) else i.config end,
   'content',(i.content - 'questions') || jsonb_build_object('questions',coalesce((
     select jsonb_agg(case when q->'guidedSpelling'='true'::jsonb or q->'missingLetter'='true'::jsonb
       or i.config->'block'->>'method' in ('material:spell','material:order','material:write')
       then (q - 'correct' - 'card' - 'speak' - 'contentId') || '{"word":""}'::jsonb
       else q - 'correct' - 'card' end order by ord)
     from jsonb_array_elements(coalesce(i.content->'questions','[]')) with ordinality t(q,ord)),'[]')))
$$;
revoke all on function public.hw_public_item(public.homework_items) from public,anon,authenticated;

alter function public.hw_open_personal(text) rename to hw_open_legacy_target;
revoke all on function public.hw_open_legacy_target(text) from public,anon,authenticated;

create function public.hw_open_personal(p_access text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare assignment_code text;
begin
  select a.code into assignment_code from homework_assignment_targets g
    join homework_assignments a on a.id=g.assignment_id
    join public.homework_material_assignments m on m.assignment_id=a.id
    where g.access_token=btrim(p_access);
  if found then return jsonb_build_object('code',assignment_code,'requires_login',true); end if;
  return public.hw_open_legacy_target(p_access);
end $$;

create function public.student_open_homework_target(p_token uuid,p_access text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare student uuid := public.student_session_student(p_token); target record;
begin
  select a.id,a.code,a.academy_id,t.token,t.finished_at into target
    from homework_assignment_targets g join homework_assignments a on a.id=g.assignment_id
    join students s on s.id=g.student_id and s.academy_id=a.academy_id and s.archived_at is null
    left join homework_attempts t on t.assignment_id=a.id and t.student_id=g.student_id
    where g.student_id=student and g.access_token=btrim(p_access);
  if not found then return jsonb_build_object('error','not_found'); end if;
  if not academy_feature(target.academy_id,'homework') then return jsonb_build_object('error','feature_closed'); end if;
  if target.finished_at is not null then return jsonb_build_object('code',target.code,'token',target.token); end if;
  return public.hw_open_legacy_target(p_access);
end $$;

create or replace function public.student_open_homework(p_token uuid,p_code text) returns jsonb
language plpgsql security definer set search_path=public as $$
declare student uuid := public.student_session_student(p_token); access text;
begin
  select g.access_token into access from homework_assignment_targets g join homework_assignments a on a.id=g.assignment_id
    where a.code=btrim(p_code) and g.student_id=student order by (a.closed_at is null) desc,a.created_at desc,a.id limit 1;
  if not found then return jsonb_build_object('error','not_found'); end if;
  return public.student_open_homework_target(p_token,access);
end $$;

-- The portal's older list filters by open deadline. Include historical submissions for this student.
alter function public.student_home(uuid) rename to student_home_before_material_history;
revoke all on function public.student_home_before_material_history(uuid) from public,anon,authenticated;
create function public.student_home(p_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb:=public.student_home_before_material_history(p_token); history jsonb; student uuid;
begin
  if result ? 'error' or result->'features'->>'homework' is distinct from 'true' then return result; end if;
  student:=public.student_session_student(p_token);
  select coalesce(jsonb_agg(jsonb_build_object('title',a.title,'access',g.access_token,'due_at',a.due_at,'done',true)
    order by t.finished_at desc),'[]'::jsonb) into history
    from homework_attempts t join homework_assignments a on a.id=t.assignment_id
    join homework_assignment_targets g on g.assignment_id=a.id and g.student_id=t.student_id
    where t.student_id=student and t.finished_at is not null and not exists (
      select 1 from jsonb_array_elements(result->'homework') r where r->>'access'=g.access_token);
  return jsonb_set(result,'{homework}',coalesce(result->'homework','[]'::jsonb)||history);
end $$;
revoke all on function public.hw_open_personal(text), public.student_home(uuid), public.student_open_homework_target(uuid,text) from public;
grant execute on function public.hw_open_personal(text), public.student_home(uuid), public.student_open_homework_target(uuid,text) to anon,authenticated;
commit;
