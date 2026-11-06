-- Grammar assignments and evidence. Requires 097–101.
begin;

create table if not exists public.grammar_content_versions (
  goal_id text not null,
  version integer not null check (version > 0),
  content jsonb not null,
  published_at timestamptz not null default now(),
  retired_at timestamptz,
  primary key (goal_id, version),
  check (jsonb_typeof(content) = 'object'
    and content->>'goalId' is not distinct from goal_id
    and content->'version' is not distinct from to_jsonb(version))
);

create table if not exists public.grammar_plans (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  approved_by uuid not null,
  approved_at timestamptz not null default now(),
  request_id uuid not null,
  approval_input jsonb not null,
  mode text not null check (mode in ('homework','individual')),
  goal_id text not null,
  version integer not null,
  initial_due_at timestamptz,
  review_delay_seconds integer not null default 86400 check (review_delay_seconds > 0),
  rule_version text not null default 'grammar-v1',
  unique (academy_id, request_id),
  foreign key (goal_id, version) references public.grammar_content_versions(goal_id, version)
);
create index if not exists grammar_plans_class_idx on public.grammar_plans(class_id, approved_at desc);

create table if not exists public.grammar_assignments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.grammar_plans(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  run_id uuid unique references public.learning_delivery_runs(id) on delete set null,
  position integer not null default 0 check (position between 0 and 5),
  revision integer not null default 0 check (revision >= 0),
  feedback_pending boolean not null default false,
  initial_completed_at timestamptz,
  review_due_at timestamptz,
  finished_at timestamptz,
  revoked_at timestamptz,
  unique (plan_id, student_id)
);
create index if not exists grammar_assignments_student_idx on public.grammar_assignments(student_id);

create table if not exists public.grammar_presentations (
  assignment_id uuid not null references public.grammar_assignments(id) on delete cascade,
  position integer not null,
  item_id text,
  option_order text[],
  presented_at timestamptz not null default clock_timestamp(),
  primary key (assignment_id, position)
);
create table if not exists public.grammar_answers (
  assignment_id uuid not null,
  position integer not null,
  item_id text not null,
  option_id text not null,
  correct boolean not null,
  submitted_at timestamptz not null,
  primary key (assignment_id, position),
  foreign key (assignment_id, position) references public.grammar_presentations on delete cascade
);
create table if not exists public.grammar_action_requests (
  assignment_id uuid not null references public.grammar_assignments(id) on delete cascade,
  request_id uuid not null,
  input jsonb not null,
  applied_revision integer not null,
  primary key (assignment_id, request_id)
);

do $$
declare t text;
begin
  foreach t in array array['grammar_content_versions','grammar_plans','grammar_assignments',
    'grammar_presentations','grammar_answers','grammar_action_requests'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from public, anon, authenticated', t);
  end loop;
end $$;

create or replace function public.grammar_keep_version() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if row(new.goal_id, new.version, new.content, new.published_at)
     is distinct from row(old.goal_id, old.version, old.content, old.published_at) then
    raise exception 'grammar_version_immutable';
  end if;
  return new;
end $$;
drop trigger if exists grammar_keep_version on public.grammar_content_versions;
create trigger grammar_keep_version before update on public.grammar_content_versions
for each row execute function public.grammar_keep_version();

alter table public.learning_delivery_runs drop constraint if exists learning_delivery_runs_source_check;
alter table public.learning_delivery_runs add constraint learning_delivery_runs_source_check
  check (source in ('homework','solo','word_memory','grammar'));
alter table public.learning_sensor_events drop constraint if exists learning_sensor_events_source_check;
alter table public.learning_sensor_events add constraint learning_sensor_events_source_check
  check (source in ('homework','solo','word_memory','group','grammar'));

create or replace function public.grammar_feature_open(p_academy uuid, p_mode text) returns boolean
language sql stable set search_path = pg_catalog, public as $$
  select coalesce(public.academy_feature(p_academy,'solo'), false)
    and (p_mode <> 'homework' or coalesce(public.academy_feature(p_academy,'homework'), false));
$$;

-- Resolve session before taking the assignment lock. All student writers take this same lock.
create or replace function public.grammar_student_assignment(p_token uuid, p_assignment uuid, p_lock boolean)
returns public.grammar_assignments language plpgsql security definer set search_path = pg_catalog, public as $$
declare sid uuid := public.student_session_student(p_token);
  a public.grammar_assignments; p public.grammar_plans;
begin
  if p_lock then
    select * into a from public.grammar_assignments where id=p_assignment and student_id=sid for update;
  else
    select * into a from public.grammar_assignments where id=p_assignment and student_id=sid;
  end if;
  if a.id is null or a.revoked_at is not null then raise exception 'not_found'; end if;
  select * into strict p from public.grammar_plans where id=a.plan_id;
  if not exists(select 1 from public.students where id=sid and academy_id=p.academy_id and archived_at is null)
    then raise exception 'not_found'; end if;
  if not public.grammar_feature_open(p.academy_id,p.mode) then raise exception 'feature_closed'; end if;
  return a;
end $$;

create or replace function public.grammar_catalog() returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
begin
  perform public.hw_staff_academy();
  return coalesce((select jsonb_agg(jsonb_build_object('goalId',goal_id,'version',version,
    'title',content->>'title','objective',content->>'objective','grammarIds',content->'grammarIds')
    order by goal_id) from (
      select distinct on (goal_id) * from public.grammar_content_versions
      where retired_at is null order by goal_id,version desc
    ) v), '[]'::jsonb);
end $$;

create or replace function public.grammar_preview(p_goal_id text,p_version integer) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare result jsonb;
begin
  perform public.hw_staff_academy();
  select content into result from public.grammar_content_versions
    where goal_id=p_goal_id and version=p_version and retired_at is null;
  if result is null then raise exception 'not_found'; end if;
  return result;
end $$;

create or replace function public.grammar_assign(p_request_id uuid,p_class_id uuid,p_student_ids uuid[],
  p_mode text,p_goal_id text,p_version integer,p_initial_due_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare ac uuid := public.hw_staff_academy(); actor uuid := auth.uid();
  selected_students uuid[]; approved jsonb; previous public.grammar_plans; plan uuid;
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
  if not exists(select 1 from public.grammar_content_versions
    where goal_id=p_goal_id and version=p_version and retired_at is null for share)
    then raise exception 'content_unavailable'; end if;
  insert into public.grammar_plans(academy_id,class_id,approved_by,request_id,approval_input,
    mode,goal_id,version,initial_due_at)
    values(ac,p_class_id,actor,p_request_id,approved,p_mode,p_goal_id,p_version,p_initial_due_at)
    returning id into plan;
  insert into public.grammar_assignments(plan_id,student_id) select plan,id from unnest(selected_students) as x(id);
  return jsonb_build_object('planId',plan,'duplicate',false);
end $$;

create or replace function public.grammar_student_list(p_token uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare sid uuid := public.student_session_student(p_token);
begin
  return coalesce((select jsonb_agg(jsonb_build_object('assignmentId',a.id,'title',v.content->>'title',
    'mode',p.mode,'initialDueAt',p.initial_due_at,'reviewDueAt',a.review_due_at,'status',case
      when a.finished_at is not null then 'finished'
      when a.feedback_pending then 'in_progress'
      when a.review_due_at > statement_timestamp() then 'waiting'
      when a.review_due_at is not null then 'review_ready'
      when a.run_id is not null then 'in_progress' else 'assigned' end) order by p.approved_at desc,a.id)
  from public.grammar_assignments a join public.grammar_plans p on p.id=a.plan_id
    join public.students s on s.id=a.student_id and s.academy_id=p.academy_id and s.archived_at is null
    join public.grammar_content_versions v using (goal_id,version)
  where a.student_id=sid and a.revoked_at is null and public.grammar_feature_open(p.academy_id,p.mode)), '[]'::jsonb);
end $$;

create or replace function public.grammar_item(p_content jsonb,p_position integer) returns jsonb
language sql immutable set search_path = pg_catalog, public as $$
  select case p_position when 1 then p_content->'reasoning' when 3 then p_content#>'{repair,practice}'
    when 4 then p_content->'transfer' when 5 then p_content->'delayed' end;
$$;

-- Only called by open/action after acquiring the assignment lock. Never serializes the authored item.
create or replace function public.grammar_state(p_assignment uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare a public.grammar_assignments; content jsonb; item jsonb; choice jsonb; response jsonb;
  answer public.grammar_answers; offered public.grammar_presentations; ids text[]; options jsonb;
  phase text; state jsonb;
begin
  select * into strict a from public.grammar_assignments where id=p_assignment;
  response := jsonb_build_object('assignmentId',a.id,'runId',a.run_id,'revision',a.revision,
    'initialCompletedAt',a.initial_completed_at,'reviewDueAt',a.review_due_at);
  if a.finished_at is not null then
    return response||jsonb_build_object('state',jsonb_build_object('kind','finished','finishedAt',a.finished_at));
  end if;
  if not a.feedback_pending and a.position=5 and (a.review_due_at is null or a.review_due_at>clock_timestamp()) then
    return response||jsonb_build_object('state',jsonb_build_object('kind','waiting','dueAt',a.review_due_at));
  end if;
  select v.content into strict content from public.grammar_plans p
    join public.grammar_content_versions v using (goal_id,version) where p.id=a.plan_id;
  item := public.grammar_item(content,a.position);
  if a.feedback_pending then
    select * into strict answer from public.grammar_answers where assignment_id=a.id and position=a.position;
    select o into strict choice from jsonb_array_elements(item->'options') o where o->>'id'=answer.option_id;
    return response||jsonb_build_object('state',jsonb_build_object('kind','feedback','position',a.position,
      'feedback',jsonb_build_object('correct',answer.correct,'explanation',choice->>'feedback')));
  end if;
  phase := (array['explain','reasoning','repair','practice','transfer','delayed'])[a.position+1];
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
  elsif a.position=2 then
    state := jsonb_build_object('phase',phase,'explanation',content#>>'{repair,explanation}',
      'example',content#>'{repair,example}');
  else
    select jsonb_agg(jsonb_build_object('id',o->>'id','text',o->>'text') order by x.n) into options
      from unnest(offered.option_order) with ordinality x(id,n)
      join lateral jsonb_array_elements(item->'options') o on o->>'id'=x.id;
    state := jsonb_build_object('phase',phase,'item',jsonb_build_object('id',item->>'id',
      'sentence',item->>'sentence','prompt',item->>'prompt','options',options));
  end if;
  return response||jsonb_build_object('state',jsonb_build_object('kind','step','position',a.position,'step',state));
end $$;

create or replace function public.grammar_open(p_token uuid,p_assignment_id uuid) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare a public.grammar_assignments := public.grammar_student_assignment(p_token,p_assignment_id,true);
  p public.grammar_plans; receipt uuid;
begin
  if a.run_id is null then
    select * into strict p from public.grammar_plans where id=a.plan_id;
    receipt := public.learning_delivery_record('grammar',p.academy_id,a.student_id,a.id,
      jsonb_build_object('goalId',p.goal_id,'version',p.version,'ruleVersion',p.rule_version), '{}'::jsonb);
    update public.learning_delivery_runs set learning_mode=p.mode, learning_rule_version=p.rule_version where id=receipt;
    update public.grammar_assignments set run_id=receipt where id=a.id;
  end if;
  return public.grammar_state(a.id);
end $$;

create or replace function public.grammar_act(p_token uuid,p_assignment_id uuid,p_request_id uuid,
  p_revision integer,p_action text,p_item_id text default null,p_option_id text default null) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare a public.grammar_assignments := public.grammar_student_assignment(p_token,p_assignment_id,true);
  p public.grammar_plans; content jsonb; item jsonb; seen public.grammar_action_requests;
  input jsonb; ok boolean; next_position integer; happened_at timestamptz := clock_timestamp();
begin
  if a.run_id is null then raise exception 'not_open'; end if;
  if p_request_id is null or p_revision is null or p_action is null or p_action not in ('continue','answer')
    then raise exception 'bad_request'; end if;
  input := jsonb_build_array(p_revision,p_action,p_item_id,p_option_id);
  select * into seen from public.grammar_action_requests where assignment_id=a.id and request_id=p_request_id;
  if seen.request_id is not null then
    if seen.input is distinct from input then raise exception 'request_changed'; end if;
    return public.grammar_state(a.id)||jsonb_build_object('appliedRevision',seen.applied_revision,'duplicate',true);
  end if;
  if a.revision<>p_revision or a.finished_at is not null then raise exception 'grammar_changed'; end if;
  if a.position=5 and not a.feedback_pending and (a.review_due_at is null or a.review_due_at>happened_at)
    then raise exception 'not_due'; end if;
  if not exists(select 1 from public.grammar_presentations where assignment_id=a.id and position=a.position)
    then raise exception 'step_not_open'; end if;
  if p_action='continue' then
    if p_item_id is not null or p_option_id is not null or (not a.feedback_pending and a.position not in (0,2))
      then raise exception 'bad_action'; end if;
    next_position := a.position;
    if a.position=1 then
      select correct into strict ok from public.grammar_answers where assignment_id=a.id and position=1;
      next_position := case when ok then 4 else 2 end;
    elsif a.position<5 then
      next_position := a.position+1;
    end if;
    update public.grammar_assignments set position=next_position,feedback_pending=false,
      finished_at=case when a.position=5 then happened_at else null end,revision=revision+1 where id=a.id;
  else
    if a.feedback_pending or a.position not in (1,3,4,5) or p_item_id is null or p_option_id is null
      then raise exception 'bad_action'; end if;
    select * into strict p from public.grammar_plans where id=a.plan_id;
    select v.content into strict content from public.grammar_content_versions v
      where v.goal_id=p.goal_id and v.version=p.version;
    item := public.grammar_item(content,a.position);
    if p_item_id is distinct from item->>'id' or not exists(
      select 1 from public.grammar_presentations x where x.assignment_id=a.id and x.position=a.position
        and x.item_id=p_item_id and p_option_id=any(x.option_order)) then raise exception 'bad_answer'; end if;
    ok := p_option_id=item->>'correctOptionId';
    insert into public.grammar_answers values(a.id,a.position,p_item_id,p_option_id,ok,happened_at);
    update public.grammar_assignments set feedback_pending=true,revision=revision+1,
      initial_completed_at=case when a.position=4 then happened_at else initial_completed_at end,
      review_due_at=case when a.position=4 then happened_at+make_interval(secs=>p.review_delay_seconds) else review_due_at end
      where id=a.id;
  end if;
  insert into public.grammar_action_requests values(a.id,p_request_id,input,a.revision+1);
  return public.grammar_state(a.id)||jsonb_build_object('appliedRevision',a.revision+1,'duplicate',false);
end $$;

-- Insert a grammar branch without replacing the deployed implementations of other sources.
do $$
declare ddl text; anchor text; body text;
begin
  select pg_get_functiondef(oid),prosrc into strict ddl,body from pg_proc
    where oid='public.learning_run_authorize(uuid,text)'::regprocedure;
  anchor := $anchor$  if r.source='solo' then$anchor$;
  if position('grammar_student_assignment(' in body)=0 then
    if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then
      raise exception '102 incompatible learning_run_authorize'; end if;
    execute replace(ddl,anchor,$branch$  if r.source='grammar' then
    if not exists(select 1 from public.grammar_assignments ga join public.grammar_plans gp on gp.id=ga.plan_id
      where ga.id=(public.grammar_student_assignment(p_credential::uuid,r.resource_id,false)).id
        and ga.run_id=r.id and ga.student_id=r.student_id and gp.academy_id=r.academy_id)
      then raise exception 'not_found'; end if;
  elsif r.source='solo' then$branch$);
  end if;
  select pg_get_functiondef(oid),prosrc into strict ddl,body from pg_proc
    where oid='public.learning_run_action(uuid,text,int,text,jsonb)'::regprocedure;
  anchor := '  r:=public.learning_run_authorize(p_run,p_credential);';
  if position('use_grammar_flow' in body)=0 then
    if (length(body)-length(replace(body,anchor,'')))/length(anchor)<>1 then
      raise exception '102 incompatible learning_run_action'; end if;
    execute replace(ddl,anchor,anchor||chr(10)||$branch$  if r.source='grammar' then raise exception 'use_grammar_flow'; end if;$branch$);
  end if;
end $$;

do $$
declare f text;
begin
  foreach f in array array['grammar_keep_version()','grammar_feature_open(uuid,text)',
    'grammar_student_assignment(uuid,uuid,boolean)','grammar_state(uuid)','grammar_item(jsonb,integer)',
    'grammar_catalog()','grammar_preview(text,integer)','grammar_assign(uuid,uuid,uuid[],text,text,integer,timestamptz)',
    'grammar_student_list(uuid)','grammar_open(uuid,uuid)','grammar_act(uuid,uuid,uuid,integer,text,text,text)'] loop
    execute format('revoke all on function public.%s from public,anon,authenticated',f);
  end loop;
end $$;
grant execute on function public.grammar_catalog(), public.grammar_preview(text,integer),
  public.grammar_assign(uuid,uuid,uuid[],text,text,integer,timestamptz) to authenticated;
grant execute on function public.grammar_student_list(uuid), public.grammar_open(uuid,uuid),
  public.grammar_act(uuid,uuid,uuid,integer,text,text,text) to anon,authenticated;
select public.learning_path_assert_compat();
commit;
