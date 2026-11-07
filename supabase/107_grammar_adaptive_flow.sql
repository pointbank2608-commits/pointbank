-- Versioned adaptive grammar assignments. Positions 0–5 remain reserved for version 1.
begin;

alter table public.grammar_assignments drop constraint grammar_assignments_position_check;
alter table public.grammar_assignments add constraint grammar_assignments_position_check check (position between 0 and 45);

create or replace function public.grammar_normalize_written(value text) returns text
language sql immutable strict set search_path=pg_catalog as $$
  select lower(btrim(regexp_replace(translate(value, chr(8216)||chr(8217), chr(39)||chr(39)), '[[:space:]]+', ' ', 'g')));
$$;
revoke all on function public.grammar_normalize_written(text) from public, anon, authenticated;

create or replace function public.grammar_catalog() returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.hw_staff_academy();
  return coalesce((select jsonb_agg(jsonb_build_object('goalId',goal_id,'version',version,
    'title',content->>'title','objective',content->>'objective','grammarIds',content->'grammarIds','adaptive',content ? 'adaptive')
    order by goal_id) from (
      select distinct on (goal_id) * from public.grammar_content_versions
      where retired_at is null order by goal_id,version desc
    ) v), '[]'::jsonb);
end $$;

create or replace function public.grammar_assign(p_request_id uuid,p_class_id uuid,p_student_ids uuid[],
  p_mode text,p_goal_id text,p_version integer,p_initial_due_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare ac uuid := public.hw_staff_academy(); actor uuid := auth.uid();
  selected_students uuid[]; approved jsonb; previous public.grammar_plans; plan uuid; selected_rule text;
begin
  if actor is null or p_request_id is null or p_mode is null or p_mode not in ('homework','individual')
    or p_goal_id is null or p_version is null or p_student_ids is null
    or cardinality(p_student_ids)=0 or array_position(p_student_ids,null) is not null
    then raise exception 'bad_plan'; end if;
  if not public.grammar_feature_open(ac,p_mode) then raise exception 'feature_closed'; end if;
  select array_agg(distinct id order by id) into selected_students from unnest(p_student_ids) as x(id);
  approved := jsonb_build_array(actor,p_class_id,selected_students,p_mode,p_goal_id,p_version,p_initial_due_at);
  perform pg_advisory_xact_lock(hashtextextended('grammar-approval:'||ac::text||':'||p_request_id::text,0));
  select * into previous from public.grammar_plans where academy_id=ac and request_id=p_request_id;
  if previous.id is not null then
    if previous.approval_input is distinct from approved then raise exception 'request_changed'; end if;
    return jsonb_build_object('planId',previous.id,'duplicate',true);
  end if;
  if not exists(select 1 from public.classes where id=p_class_id and academy_id=ac for share)
    then raise exception 'bad_class'; end if;
  if (select count(*) from (
    select id from public.students where id=any(selected_students) and class_id=p_class_id
      and academy_id=ac and archived_at is null order by id for share
  ) eligible) <> cardinality(selected_students) then raise exception 'bad_student'; end if;
  if p_initial_due_at is not null and (not isfinite(p_initial_due_at) or p_initial_due_at<=clock_timestamp())
    then raise exception 'bad_due'; end if;
  select case when content ? 'adaptive' then 'grammar-v2' else 'grammar-v1' end
    into selected_rule from public.grammar_content_versions
    where goal_id=p_goal_id and version=p_version and retired_at is null for share;
  if not found then raise exception 'content_unavailable'; end if;
  insert into public.grammar_plans(academy_id,class_id,approved_by,request_id,approval_input,
    mode,goal_id,version,initial_due_at,rule_version)
    values(ac,p_class_id,actor,p_request_id,approved,p_mode,p_goal_id,p_version,p_initial_due_at,selected_rule)
    returning id into plan;
  insert into public.grammar_assignments(plan_id,student_id) select plan,id from unnest(selected_students) as x(id);
  return jsonb_build_object('planId',plan,'duplicate',false);
end $$;

create or replace function public.grammar_item(p_content jsonb,p_position integer) returns jsonb
language sql immutable set search_path = pg_catalog, public as $$
  select case
    when p_position = 1 then p_content->'reasoning'
    when p_position = 3 then p_content#>'{repair,practice}'
    when p_position = 4 then p_content->'transfer'
    when p_position = 5 then p_content->'delayed'
    when p_position between 10 and 12 then (p_content#>'{adaptive,reasoning}')->(p_position-10)
    when p_position between 21 and 29 then (p_content#>'{adaptive,practice}')->(p_position-21)
    when p_position between 30 and 33 then (p_content#>'{adaptive,transfer}')->(p_position-30)
    when p_position between 40 and 45 then (p_content#>'{adaptive,delayed}')->(p_position-40)
  end;
$$;

create or replace function public.grammar_state(p_assignment uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare a public.grammar_assignments; content jsonb; item jsonb; choice jsonb; response jsonb;
  answer public.grammar_answers; offered public.grammar_presentations; ids text[]; options jsonb;
  phase text; state jsonb; adaptive boolean;
begin
  select * into strict a from public.grammar_assignments where id=p_assignment;
  response := jsonb_build_object('assignmentId',a.id,'runId',a.run_id,'revision',a.revision,
    'initialCompletedAt',a.initial_completed_at,'reviewDueAt',a.review_due_at);
  select p.rule_version = 'grammar-v2', v.content into strict adaptive, content
    from public.grammar_plans p join public.grammar_content_versions v using (goal_id,version) where p.id=a.plan_id;
  response := response || jsonb_build_object('adaptive', adaptive);
  if a.finished_at is not null then
    return response||jsonb_build_object('state',jsonb_build_object('kind','finished','finishedAt',a.finished_at));
  end if;
  if not a.feedback_pending and (a.position=5 or a.position between 40 and 45) and (a.review_due_at is null or a.review_due_at>clock_timestamp()) then
    return response||jsonb_build_object('state',jsonb_build_object('kind','waiting','dueAt',a.review_due_at));
  end if;
  item := public.grammar_item(content,a.position);
  if a.feedback_pending then
    select * into strict answer from public.grammar_answers where assignment_id=a.id and position=a.position;
    if item ? 'answerText' then
      choice := item;
    else
      select o into strict choice from jsonb_array_elements(item->'options') o where o->>'id'=answer.option_id;
    end if;
    return response||jsonb_build_object('state',jsonb_build_object('kind','feedback','position',a.position,
      'feedback',jsonb_build_object('correct',answer.correct,'explanation',choice->>'feedback')));
  end if;
  phase := case
    when a.position between 10 and 12 then 'reasoning'
    when a.position=20 then 'repair'
    when a.position between 21 and 29 then 'practice'
    when a.position between 30 and 33 then 'transfer'
    when a.position between 40 and 45 then 'delayed'
    else (array['explain','reasoning','repair','practice','transfer','delayed'])[a.position+1]
  end;
  select * into offered from public.grammar_presentations where assignment_id=a.id and position=a.position;
  if offered.assignment_id is null then
    select array_agg(o->>'id' order by random()) into ids from jsonb_array_elements(item->'options') o;
    insert into public.grammar_presentations(assignment_id,position,item_id,option_order)
      values(a.id,a.position,item->>'id',ids) returning * into offered;
    insert into public.learning_delivery_items(run_id,position,skill,step_type)
      values(a.run_id,a.position,'grammar',phase);
  end if;
  if a.position=0 then
    state := jsonb_build_object('phase',phase,'objective',content->>'objective','rule',content->>'rule',
      'boundary',content->>'boundary','examples',content->'examples');
  elsif phase='repair' then
    state := jsonb_build_object('phase',phase,'explanation',content#>>'{repair,explanation}',
      'example',content#>'{repair,example}');
  else
    select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text') order by x.n) into options
      from unnest(offered.option_order) with ordinality x(id,n)
      join lateral jsonb_array_elements(item->'options') o on o->>'id'=x.id;
    state := jsonb_build_object('phase',phase,'item',jsonb_build_object('id',item->>'id',
      'sentence',item->>'sentence','prompt',item->>'prompt','options',coalesce(options,'[]'::jsonb),'written',item ? 'answerText'));
  end if;
  return response||jsonb_build_object('state',jsonb_build_object('kind','step','position',a.position,'step',state));
end $$;

create or replace function public.grammar_act(p_token uuid,p_assignment_id uuid,p_request_id uuid,
  p_revision integer,p_action text,p_item_id text default null,p_option_id text default null) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare a public.grammar_assignments := public.grammar_student_assignment(p_token,p_assignment_id,true);
  p public.grammar_plans; content jsonb; item jsonb; seen public.grammar_action_requests;
  input jsonb; ok boolean; next_position integer; adaptive boolean;
  terminal boolean := false; initial_last boolean; answer_key text; happened_at timestamptz := clock_timestamp();
begin
  if a.run_id is null then raise exception 'not_open'; end if;
  if p_request_id is null or p_revision is null or p_action is null or p_action not in ('continue','answer')
    then raise exception 'bad_request'; end if;
  if length(p_option_id)>120 then raise exception 'bad_answer'; end if;
  select * into strict p from public.grammar_plans where id=a.plan_id;
  adaptive := p.rule_version='grammar-v2';
  initial_last := a.position=case when adaptive then 33 else 4 end;
  -- Store a fingerprint for replay checks instead of the student's typed response.
  input := jsonb_build_array(p_revision,p_action,p_item_id,
    case when adaptive then md5(p_option_id) else p_option_id end);
  select * into seen from public.grammar_action_requests where assignment_id=a.id and request_id=p_request_id;
  if seen.request_id is not null then
    if seen.input is distinct from input then raise exception 'request_changed'; end if;
    return public.grammar_state(a.id)||jsonb_build_object('appliedRevision',seen.applied_revision,'duplicate',true);
  end if;
  if a.revision<>p_revision or a.finished_at is not null then raise exception 'grammar_changed'; end if;
  if (a.position=5 or a.position between 40 and 45) and not a.feedback_pending and (a.review_due_at is null or a.review_due_at>happened_at)
    then raise exception 'not_due'; end if;
  if not exists(select 1 from public.grammar_presentations where assignment_id=a.id and position=a.position)
    then raise exception 'step_not_open'; end if;
  if p_action='continue' then
    if p_item_id is not null or p_option_id is not null or (not a.feedback_pending and a.position not in (0,2,20))
      then raise exception 'bad_action'; end if;
    next_position := a.position;
    if adaptive then
      if a.position=0 then
        next_position := 10;
      elsif a.position=12 then
        select count(*) filter (where correct)=3 into ok
          from public.grammar_answers where assignment_id=a.id and position between 10 and 12;
        next_position := case when ok then 21 else 20 end;
      elsif a.position=25 then
        select count(*) filter (where correct)>=4 and count(*) filter (where position>=24 and correct)=2 into ok
          from public.grammar_answers where assignment_id=a.id and position between 21 and 25;
        next_position := case when ok then 30 else 26 end;
      elsif a.position=33 then
        next_position := 40;
      elsif a.position=43 then
        select count(*) filter (where correct)=4 into terminal
          from public.grammar_answers where assignment_id=a.id and position between 30 and 33;
        if not terminal then next_position := 44; end if;
      elsif a.position=45 then
        terminal := true;
      else
        next_position := a.position+1;
      end if;
    elsif a.position=1 then
      select correct into strict ok from public.grammar_answers where assignment_id=a.id and position=1;
      next_position := case when ok then 4 else 2 end;
    elsif a.position<5 then
      next_position := a.position+1;
    end if;
    update public.grammar_assignments set position=next_position,feedback_pending=false,
      finished_at=case when terminal or (not adaptive and a.position=5) then happened_at else null end,revision=revision+1 where id=a.id;
  else
    if a.feedback_pending or p_item_id is null or nullif(btrim(p_option_id),'') is null
      then raise exception 'bad_action'; end if;
    select v.content into strict content from public.grammar_content_versions v
      where v.goal_id=p.goal_id and v.version=p.version;
    item := public.grammar_item(content,a.position);
    if p_item_id is distinct from item->>'id' then raise exception 'bad_answer'; end if;
    if item ? 'answerText' then
      ok := public.grammar_normalize_written(p_option_id)=public.grammar_normalize_written(item->>'answerText');
      answer_key := 'written';
    else
      if not exists(select 1 from public.grammar_presentations x
        where x.assignment_id=a.id and x.position=a.position and x.item_id=p_item_id and p_option_id=any(x.option_order))
        then raise exception 'bad_answer'; end if;
      ok := p_option_id=item->>'correctOptionId';
      answer_key := p_option_id;
    end if;
    insert into public.grammar_answers values(a.id,a.position,p_item_id,answer_key,ok,happened_at);
    update public.grammar_assignments set feedback_pending=true,revision=revision+1,
      initial_completed_at=case when initial_last then happened_at else initial_completed_at end,
      review_due_at=case when initial_last then happened_at+make_interval(secs=>p.review_delay_seconds) else review_due_at end
      where id=a.id;
  end if;
  insert into public.grammar_action_requests values(a.id,p_request_id,input,a.revision+1);
  return public.grammar_state(a.id)||jsonb_build_object('appliedRevision',a.revision+1,'duplicate',false);
end $$;

create or replace view public.grammar_result_rows with (security_invoker=true) as
select a.id as assignment_id,p.academy_id,p.class_id,p.mode,p.goal_id,p.version,p.approved_at,
  case when s.academy_id=p.academy_id then s.name else '학원 이동' end as student,v.content->>'title' as title,
  case when p.rule_version='grammar-v2' then case when counts.diagnosed=3 then counts.diagnosed_ok=3 end else r.correct end as reasoning,
  case when p.rule_version='grammar-v2' then case when counts.practiced>0 then counts.practiced_ok=counts.practiced end else b.correct end as practice,
  case when p.rule_version='grammar-v2' then case when counts.transferred=4 then counts.transferred_ok=4 end else t.correct end as transfer,
  case
    when a.revoked_at is not null or s.archived_at is not null or s.academy_id is distinct from p.academy_id then 'excluded'
    when d.correct is true then 'correct'
    when d.correct is false then 'wrong'
    when not public.grammar_feature_open(p.academy_id,p.mode) then 'excluded'
    when p.rule_version='grammar-v2' and counts.reviewed=(case when counts.transferred_ok=4 then 4 else 6 end)
      then case when counts.reviewed_ok=counts.reviewed then 'correct' else 'wrong' end
    when a.review_due_at is null then 'unscheduled'
    when a.review_due_at>statement_timestamp() then 'waiting'
    else 'missing'
  end as review,
  case when p.rule_version='grammar-v2' then to_jsonb(counts) end as evidence
from public.grammar_assignments a
join public.grammar_plans p on p.id=a.plan_id
join public.students s on s.id=a.student_id
join public.grammar_content_versions v using (goal_id,version)
left join public.grammar_answers r on r.assignment_id=a.id and r.position=1
left join public.grammar_answers b on b.assignment_id=a.id and b.position=3
left join public.grammar_answers t on t.assignment_id=a.id and t.position=4
left join public.grammar_answers d on d.assignment_id=a.id and d.position=5
left join lateral (
  select count(*) filter(where position between 10 and 12) as diagnosed,
    count(*) filter(where position between 10 and 12 and correct) as diagnosed_ok,
    count(*) filter(where position between 21 and 29) as practiced,
    count(*) filter(where position between 21 and 29 and correct) as practiced_ok,
    count(*) filter(where position between 30 and 33) as transferred,
    count(*) filter(where position between 30 and 33 and correct) as transferred_ok,
    count(*) filter(where position between 40 and 45) as reviewed,
    count(*) filter(where position between 40 and 45 and correct) as reviewed_ok
  from public.grammar_answers where assignment_id=a.id
) counts on p.rule_version='grammar-v2';
revoke all on public.grammar_result_rows from public,anon,authenticated;

create or replace function public.grammar_teacher_summary(p_class_id uuid,p_mode text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public as $$
declare ac uuid := public.hw_staff_academy();
begin
  if p_mode is null or p_mode not in ('homework','individual') then raise exception 'bad_mode'; end if;
  if not exists(select 1 from public.classes where id=p_class_id and academy_id=ac) then raise exception 'not_found'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('assignmentId',assignment_id,'student',student,
    'title',title,'reasoning',reasoning,'practice',practice,'transfer',transfer,'review',review,'evidence',evidence)
    order by approved_at desc,student,assignment_id) from (
    select * from public.grammar_result_rows where academy_id=ac and class_id=p_class_id and mode=p_mode
      and approved_at>=statement_timestamp()-interval '30 days'
      order by approved_at desc,student,assignment_id limit 200
  ) recent), '[]'::jsonb);
end $$;


commit;
