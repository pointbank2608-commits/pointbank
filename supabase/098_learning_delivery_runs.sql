-- Phase 2: immutable delivery receipts and explicit evidence links. Requires 097.
-- Existing grading, schedules, assignments and teacher approval remain unchanged.
begin;
-- Preflight: fail loudly (and roll back) instead of installing a half-working layer.
do $$ declare m text; begin
  select string_agg(x,', ') into m from (
    select t as x from unnest(array['learning_sensor_events','learning_sensor_snapshots','solo_assignments','solo_step_events','solo_test_results','students','academies']) t where to_regclass('public.'||t) is null
    union all
    select r.sig||' -> '||r.ret from (values
      ('solo_assignment_for(uuid,uuid)','solo_assignments'),('solo_open(uuid,uuid)','jsonb'),
      ('solo_grade(jsonb,text)','boolean'),('solo_correct_text(jsonb)','text'),('solo_step_skill(jsonb)','text'),('solo_step_word(jsonb)','text'),
      ('hw_attempt_for(uuid,boolean)','homework_attempts'),('hw_state(uuid)','jsonb'),('hw_submit(uuid,uuid,int,text,uuid,int)','jsonb'),
      ('wm_answer(text,uuid,int,text,uuid)','jsonb'),('wm_target_for(text)','wm_targets'),('wm_today_state(text)','jsonb'),('is_platform_admin()','boolean')
    ) r(sig,ret) where not exists(select 1 from pg_proc p where p.oid=to_regprocedure('public.'||r.sig) and p.prorettype=r.ret::regtype)
  ) q;
  if m is not null then raise exception '098 requires 097 and existing solo/homework/word-memory objects; missing or incompatible: %',m; end if;
end $$;
create table if not exists public.learning_delivery_runs (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  source text not null check(source in ('homework','solo','word_memory')),
  resource_id uuid not null,
  snapshot_id uuid not null references public.learning_sensor_snapshots(id),
  created_at timestamptz not null default now()
);
create index if not exists learning_delivery_scope_idx on public.learning_delivery_runs(academy_id,created_at desc);
create table if not exists public.learning_solo_versions (
  assignment_id uuid primary key references public.solo_assignments(id) on delete cascade,
  snapshot_id uuid not null references public.learning_sensor_snapshots(id),
  frozen_at timestamptz not null default now()
);
create table if not exists public.learning_goals (
  id uuid primary key default gen_random_uuid(),
  word text not null,
  meaning text not null,
  unique(word,meaning)
);
create table if not exists public.learning_delivery_items (
  run_id uuid not null references public.learning_delivery_runs(id) on delete cascade,
  position int not null,
  question int not null default -1,
  goal_id uuid references public.learning_goals(id),
  skill text,
  step_type text,
  word text,
  primary key(run_id,position,question)
);
create table if not exists public.learning_evidence_links (
  source_table text not null check(source_table in ('learning_events','solo_step_events','wm_answers')),
  evidence_id bigint not null,
  run_id uuid not null references public.learning_delivery_runs(id) on delete cascade,
  position int not null,
  question int,
  goal_id uuid references public.learning_goals(id),
  version_matches boolean not null,
  origin_changed boolean not null default false,
  created_at timestamptz not null default now(),
  primary key(source_table,evidence_id)
);
alter table public.learning_sensor_events add column if not exists run_id uuid references public.learning_delivery_runs(id) on delete cascade;
do $$ declare t text; begin
  foreach t in array array['learning_delivery_runs','learning_solo_versions','learning_goals','learning_delivery_items','learning_evidence_links'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated',t);
  end loop;
end $$;

-- Explicit word+meaning only. Missing meaning is unresolved, never inferred from a student score.
create or replace function public.learning_delivery_item(p_run uuid,p_position int,p_question int,p_q jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare w text; m text; g uuid; sk text;
begin
  w:=nullif(lower(regexp_replace(btrim(coalesce(p_q->>'word',p_q->'card'->>'word',p_q->'_card'->>'word')),'\s+',' ','g')),'');
  m:=nullif(regexp_replace(btrim(coalesce(p_q->>'meaning',p_q->'card'->>'meaning',p_q->'_card'->>'meaning')),'\s+',' ','g'),'');
  if m is null and p_q->>'t'='pickMeaning' and p_q->>'answer' ~ '^\d+$' then m:=nullif(btrim(p_q->'options'->>((p_q->>'answer')::int)),''); end if;
  if w is not null and m is not null then
    insert into public.learning_goals(word,meaning) values(w,m) on conflict do nothing;
    select id into g from public.learning_goals where word=w and meaning=m;
  end if;
  sk:=coalesce(p_q->>'skill',public.solo_step_skill(p_q));
  insert into public.learning_delivery_items(run_id,position,question,goal_id,skill,step_type,word)
    values(p_run,p_position,p_question,g,sk,coalesce(p_q->>'t',p_q->>'qtype',p_q->>'kind'),w);
end $$;

create or replace function public.learning_delivery_record(p_source text,p_academy uuid,p_student uuid,p_resource uuid,p_private jsonb,p_delivered jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare s uuid; r uuid; d jsonb; q jsonb; child jsonb; i int; j int; cards jsonb;
begin
  d:=jsonb_build_object('grading',p_private,'delivered',p_delivered,'receipt_version','delivery-v1');
  insert into public.learning_sensor_snapshots(academy_id,source,resource_id,fingerprint,definition)
    values(p_academy,p_source,p_resource,md5(d::text),d) on conflict do nothing;
  select id into s from public.learning_sensor_snapshots where academy_id=p_academy and source=p_source and resource_id=p_resource and fingerprint=md5(d::text);
  insert into public.learning_delivery_runs(academy_id,student_id,source,resource_id,snapshot_id)
    values(p_academy,p_student,p_source,p_resource,s) returning id into r;
  if p_source='homework' then
    for q,i in select value,ordinality::int-1 from jsonb_array_elements(coalesce(p_private->'content'->'questions','[]')) with ordinality loop
      perform public.learning_delivery_item(r,0,i,q);
    end loop;
  else
    for q,i in select value,ordinality::int-1 from jsonb_array_elements(coalesce(p_private->'steps',p_private->'questions','[]')) with ordinality loop
      if p_source='word_memory' then
        select c into child from jsonb_array_elements(coalesce(p_private->'cards','[]')) c where c->>'key'=q->>'key' limit 1;
        q:=q||jsonb_strip_nulls(jsonb_build_object('word',child->>'word','meaning',child->>'meaning'));
      end if;
      perform public.learning_delivery_item(r,i,-1,q);
      if q->>'t'='test' then
        for child,j in select value,ordinality::int-1 from jsonb_array_elements(coalesce(q->'items','[]')) with ordinality loop
          perform public.learning_delivery_item(r,i,j,child);
        end loop;
      end if;
    end loop;
  end if;
  return r;
end $$;

create or replace function public.learning_run_open(p_source text,p_credential text,p_resource uuid default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.solo_assignments; h public.homework_attempts; wt public.wm_targets; ws public.wm_sessions;
  result jsonb; private jsonb; item public.homework_items; public_item jsonb; r uuid; runs jsonb:='{}'; ac uuid; frozen jsonb;
begin
  if p_source='solo' then
    a:=public.solo_assignment_for(p_credential::uuid,p_resource);
    perform 1 from public.solo_assignments where id=a.id for update;
    select jsonb_build_object('steps',l.steps) into private from public.solo_lessons l where id=a.lesson_id for share;
    result:=public.solo_open(p_credential::uuid,p_resource);
    if result ? 'error' then return result; end if;
    select s.definition into frozen from public.learning_solo_versions v join public.learning_sensor_snapshots s on s.id=v.snapshot_id where v.assignment_id=a.id;
    if frozen is not null then
      private:=frozen->'grading';
      result:=result||jsonb_build_object('steps',frozen->'delivered'->'steps');
    end if;
    r:=public.learning_delivery_record('solo',a.academy_id,a.student_id,a.id,private,jsonb_build_object('steps',result->'steps'));
    insert into public.learning_solo_versions(assignment_id,snapshot_id) select a.id,snapshot_id from public.learning_delivery_runs where id=r on conflict do nothing;
    return result||jsonb_build_object('sensor_run_id',r);
  elsif p_source='homework' then
    h:=public.hw_attempt_for(p_credential::uuid,true);
    select academy_id into ac from public.homework_assignments where id=h.assignment_id;
    perform 1 from public.homework_items where assignment_id=h.assignment_id order by id for share;
    result:=public.hw_state(p_credential::uuid);
    for item in select * from public.homework_items where assignment_id=h.assignment_id order by position loop
      select x into public_item from jsonb_array_elements(result->'items') x where x->>'id'=item.id::text;
      if public_item is null then continue; end if;
      private:=jsonb_build_object('config',item.config,'content',item.content);
      r:=public.learning_delivery_record('homework',ac,h.student_id,item.id,private,public_item);
      runs:=runs||jsonb_build_object(item.id::text,r);
    end loop;
    return result||jsonb_build_object('sensor_runs',runs);
  elsif p_source='word_memory' then
    wt:=public.wm_target_for(p_credential);
    result:=public.wm_today_state(p_credential);
    if result->>'session_id' is null then return result; end if;
    select * into ws from public.wm_sessions where id=(result->>'session_id')::uuid and target_id=wt.id for update;
    if ws.id is null then raise exception 'not_found'; end if;
    -- Re-read under the session lock so the receipt describes the payload actually returned.
    result:=public.wm_today_state(p_credential);
    if result->>'session_id' is distinct from ws.id::text then raise exception 'stale'; end if;
    select p.academy_id,jsonb_build_object('questions',ws.questions,'cards',p.cards,'rule_version',p.rule_version) into ac,private from public.wm_plans p where id=wt.plan_id;
    r:=public.learning_delivery_record('word_memory',ac,wt.student_id,ws.id,private,jsonb_build_object('items',result->'items'));
    return result||jsonb_build_object('sensor_run_id',r);
  end if;
  raise exception 'bad_run_source';
end $$;

-- Measured solo execution grades and reveals exactly the frozen steps, even after source edits.
create or replace function public.learning_solo_action(p_run uuid,p_position int,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.learning_delivery_runs; steps jsonb; q jsonb; child jsonb; ok boolean; val text;
  previous jsonb; results jsonb:='[]'; areas jsonb:='{}'; result jsonb; score int:=0; total int:=0; area text; n int; ctx jsonb;
begin
  select * into r from public.learning_delivery_runs where id=p_run and source='solo';
  select s.definition->'grading'->'steps' into steps from public.learning_sensor_snapshots s where id=r.snapshot_id;
  q:=steps->p_position;
  if q is null then raise exception 'bad_position'; end if;
  if p_action='answer' then
    if p_payload->>'value' is null or length(p_payload->>'value')>300 or q->>'t'='test' then raise exception 'bad_answer'; end if;
    ok:=public.solo_grade(q,p_payload->>'value');
    insert into public.solo_step_events(assignment_id,step_index,step_type,kind,correct,value,skill,word)
      values(r.resource_id,p_position,q->>'t','answer',ok,left(p_payload->>'value',300),public.solo_step_skill(q),public.solo_step_word(q));
    return jsonb_build_object('correct',coalesce(ok,true),'model',case when ok and q->>'t'='condWrite' then q->>'model' end);
  elsif p_action='reveal' then
    if (select count(*) from public.solo_step_events where assignment_id=r.resource_id and step_index=p_position and kind='answer')<2 then raise exception 'not_ready'; end if;
    return jsonb_build_object('answer',public.solo_correct_text(q));
  elsif p_action='advance' then
    if q->>'t'='test' and not exists(select 1 from public.solo_test_results where assignment_id=r.resource_id and step_index=p_position) then raise exception 'test_not_submitted'; end if;
    insert into public.solo_step_events(assignment_id,step_index,step_type,kind,skill,word)
      values(r.resource_id,p_position,q->>'t',case when coalesce((p_payload->>'unsure')::boolean,false) then 'unsure' else 'seen' end,public.solo_step_skill(q),public.solo_step_word(q));
    update public.solo_assignments set progress=greatest(progress,p_position+1),finished_at=case when p_position+1>=jsonb_array_length(steps) then coalesce(finished_at,now()) else finished_at end where id=r.resource_id;
    return jsonb_build_object('answer',case when (p_payload->>'unsure')::boolean then public.solo_correct_text(q) end,'done',p_position+1>=jsonb_array_length(steps));
  elsif p_action='test' then
    if q->>'t'<>'test' or jsonb_typeof(p_payload->'answers') is distinct from 'array' then raise exception 'bad_test'; end if;
    perform 1 from public.solo_assignments where id=r.resource_id for update;
    select t.result into previous from public.solo_test_results t where assignment_id=r.resource_id and step_index=p_position;
    if previous is not null then return previous; end if;
    ctx:=current_setting('app.learning_evidence_context',true)::jsonb;
    for child,n in select value,ordinality::int-1 from jsonb_array_elements(coalesce(q->'items','[]')) with ordinality loop
      val:=nullif(btrim(coalesce(p_payload->'answers'->>n,'')),'');
      begin ok:=case when val is null then false else coalesce(public.solo_grade(child,val),false) end; exception when others then ok:=false; end;
      total:=total+1; if ok then score:=score+1; end if;
      area:=coalesce(nullif(child->>'area',''),'vocab');
      areas:=jsonb_set(areas,array[area],jsonb_build_object('right',coalesce((areas->area->>'right')::int,0)+case when ok then 1 else 0 end,'total',coalesce((areas->area->>'total')::int,0)+1));
      results:=results||jsonb_build_array(jsonb_build_object('correct',ok,'answer',public.solo_correct_text(child)));
      perform set_config('app.learning_evidence_context',(ctx||jsonb_build_object('question',n))::text,true);
      insert into public.solo_step_events(assignment_id,step_index,step_type,kind,correct,value,skill,word)
        values(r.resource_id,p_position,child->>'t','answer',ok,left(coalesce(val,''),80),public.solo_step_skill(child),public.solo_step_word(child));
    end loop;
    result:=jsonb_build_object('score',score,'total',total,'by_area',areas,'items',results);
    insert into public.solo_test_results(assignment_id,step_index,answers,result,score,total) values(r.resource_id,p_position,p_payload->'answers',result,score,total);
    update public.solo_assignments set progress=greatest(progress,p_position+1),finished_at=case when p_position+1>=jsonb_array_length(steps) then coalesce(finished_at,now()) else finished_at end where id=r.resource_id;
    return result;
  end if;
  raise exception 'bad_run_action';
end $$;

create or replace function public.learning_run_authorize(p_run uuid,p_credential text)
returns public.learning_delivery_runs language plpgsql security definer set search_path=public as $$
declare r public.learning_delivery_runs; a public.solo_assignments; h public.homework_attempts; wt public.wm_targets;
begin
  select * into r from public.learning_delivery_runs where id=p_run;
  if r.id is null then raise exception 'not_found'; end if;
  if r.source='solo' then
    a:=public.solo_assignment_for(p_credential::uuid,r.resource_id);
    if a.student_id is distinct from r.student_id or a.academy_id is distinct from r.academy_id then raise exception 'not_found'; end if;
  elsif r.source='homework' then
    h:=public.hw_attempt_for(p_credential::uuid,true);
    if h.student_id is distinct from r.student_id or not exists(select 1 from public.homework_items i join public.homework_assignments ha on ha.id=i.assignment_id where i.id=r.resource_id and i.assignment_id=h.assignment_id and ha.academy_id=r.academy_id) then raise exception 'not_found'; end if;
  else
    wt:=public.wm_target_for(p_credential);
    if wt.student_id is distinct from r.student_id or not exists(select 1 from public.wm_sessions s join public.wm_plans p on p.id=wt.plan_id where s.id=r.resource_id and s.target_id=wt.id and p.academy_id=r.academy_id) then raise exception 'not_found'; end if;
  end if;
  return r;
end $$;

-- Explicit run supplied by the requesting player, never guessed from the latest session/tab.
create or replace function public.learning_run_action(p_run uuid,p_credential text,p_position int,p_action text,p_payload jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.learning_delivery_runs; old_context text; frozen jsonb; current_definition jsonb; q jsonb; result jsonb; matched boolean; changed boolean:=false; managed_path boolean:=false; path_context jsonb;
begin
  r:=public.learning_run_authorize(p_run,p_credential);
  if p_position is null or p_position<0 then raise exception 'bad_position'; end if;
  if r.source='solo' and to_regclass('public.learning_path_plans') is not null then
    execute 'select exists(select 1 from public.learning_path_plans p join public.solo_assignments a on a.lesson_id=p.lesson_id where a.id=$1)' into managed_path using r.resource_id;
    if managed_path then
      path_context:=nullif(current_setting('app.learning_path_context',true),'')::jsonb;
      if path_context is null or path_context->>'assignment' is distinct from r.resource_id::text or (path_context->>'position')::int is distinct from p_position then raise exception 'use_path_flow'; end if;
    end if;
  end if;
  select definition->'grading' into frozen from public.learning_sensor_snapshots where id=r.snapshot_id;
  if r.source='solo' then
    select jsonb_build_object('steps',l.steps) into current_definition from public.solo_assignments a join public.solo_lessons l on l.id=a.lesson_id where a.id=r.resource_id for share of l;
    if not exists(select 1 from public.learning_delivery_items where run_id=r.id and position=p_position) then raise exception 'bad_position'; end if;
    changed:=current_definition is distinct from frozen;
    matched:=true; -- The solo action below always uses the frozen definition.
  elsif r.source='homework' then
    select jsonb_build_object('config',i.config,'content',i.content) into current_definition from public.homework_items i where id=r.resource_id for share;
    if not exists(select 1 from public.learning_delivery_items where run_id=r.id and position=0 and question=p_position) then raise exception 'bad_position'; end if;
    matched:=current_definition=frozen;
  else
    select s.questions->p_position into q from public.wm_sessions s where id=r.resource_id for update;
    if q is null or frozen->'questions'->p_position is null then raise exception 'bad_position'; end if;
    matched:=(q-array['help','elim','hint'])=((frozen->'questions'->p_position)-array['help','elim','hint']);
  end if;
  old_context:=current_setting('app.learning_evidence_context',true);
  perform set_config('app.learning_evidence_context',jsonb_build_object('run',r.id,'position',p_position,'matched',coalesce(matched,false),'origin_changed',changed)::text,true);
  if r.source='solo' then result:=public.learning_solo_action(r.id,p_position,p_action,p_payload);
  elsif r.source='homework' and p_action='answer' then result:=public.hw_submit(p_credential::uuid,r.resource_id,p_position,p_payload->>'response',(p_payload->>'client_id')::uuid,(p_payload->>'ms')::int);
  elsif r.source='word_memory' and p_action='answer' then result:=public.wm_answer(p_credential,r.resource_id,p_position,p_payload->>'response',(p_payload->>'client_id')::uuid);
  else raise exception 'bad_run_action'; end if;
  perform set_config('app.learning_evidence_context',coalesce(old_context,''),true);
  return result;
end $$;

create or replace function public.learning_capture_evidence()
returns trigger language plpgsql security definer set search_path=public as $$
declare ctx jsonb; r public.learning_delivery_runs; e jsonb:=to_jsonb(new); pos int; qi int; g uuid; candidates int;
begin
  ctx:=nullif(current_setting('app.learning_evidence_context',true),'')::jsonb;
  if ctx is null then return new; end if;
  select * into r from public.learning_delivery_runs where id=(ctx->>'run')::uuid;
  if r.id is null then return new; end if;
  pos:=(ctx->>'position')::int;
  if tg_table_name='solo_step_events' then
    if r.source<>'solo' or e->>'assignment_id'<>r.resource_id::text or (e->>'step_index')::int<>pos or e->>'kind'<>'answer' then return new; end if;
    -- Ordinary problems map exactly; test sub-items map only when word/type identify one item.
    if ctx ? 'question' then qi:=(ctx->>'question')::int;
    else
      select count(*),min(question) into candidates,qi from public.learning_delivery_items where run_id=r.id and position=pos and question>=0 and word=lower(btrim(e->>'word')) and step_type=e->>'step_type';
      if candidates<>1 then qi:=-1; end if;
    end if;
  elsif tg_table_name='learning_events' then
    if r.source<>'homework' or e->>'item_id'<>r.resource_id::text or e->>'student_id'<>r.student_id::text or e->>'event_type' not in ('answer','retry_answer') then return new; end if;
    qi:=pos; pos:=0;
  elsif tg_table_name='wm_answers' then
    if r.source<>'word_memory' or e->>'session_id'<>r.resource_id::text or (e->>'q_index')::int<>pos or e->>'kind' not in ('answer','retry') then return new; end if;
    qi:=-1;
  end if;
  select goal_id into g from public.learning_delivery_items where run_id=r.id and position=pos and question=qi;
  insert into public.learning_evidence_links(source_table,evidence_id,run_id,position,question,goal_id,version_matches,origin_changed)
    values(tg_table_name,(e->>'id')::bigint,r.id,pos,nullif(qi,-1),g,(ctx->>'matched')::boolean,coalesce((ctx->>'origin_changed')::boolean,false)) on conflict do nothing;
  return new;
end $$;
do $$ declare t text; begin
  foreach t in array array['learning_events','solo_step_events','wm_answers'] loop
    execute format('drop trigger if exists capture_delivery_evidence on public.%I',t);
    execute format('create trigger capture_delivery_evidence after insert on public.%I for each row execute function public.learning_capture_evidence()',t);
  end loop;
end $$;

create or replace function public.learning_sensor_report_run(p_run uuid,p_credential text,p_events jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare r public.learning_delivery_runs; d jsonb; e jsonb; pos int; qi int; at_time timestamptz; accepted int:=0; n int;
begin
  r:=public.learning_run_authorize(p_run,p_credential);
  select definition->'grading' into d from public.learning_sensor_snapshots where id=r.snapshot_id;
  if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 40 then raise exception 'bad_sensor_batch'; end if;
  if (select count(*) from public.learning_sensor_events where student_id=r.student_id and received_at>now()-interval '1 minute')>1800 then raise exception 'sensor_rate_limit'; end if;
  for e in select value from jsonb_array_elements(p_events) loop
    if not(e ?& array['id','session','position','action','at','visible_ms','input_recent_ms']) or (e-array['id','session','position','question','action','at','visible_ms','input_recent_ms'])<>'{}' then raise exception 'bad_sensor_fields'; end if;
    pos:=(e->>'position')::int; qi:=(e->>'question')::int; at_time:=(e->>'at')::timestamptz;
    if pos is null or pos<0 or (qi is not null and qi<0) then raise exception 'bad_sensor_position'; end if;
    if r.source='homework' then
      if pos<>0 or (qi is not null and not exists(select 1 from public.learning_delivery_items where run_id=r.id and position=0 and question=qi)) then raise exception 'bad_sensor_position'; end if;
    elsif not exists(select 1 from public.learning_delivery_items where run_id=r.id and position=pos and (qi is null or question=qi)) then raise exception 'bad_sensor_position'; end if;
    if at_time is null or at_time>now()+interval '5 minutes' or at_time<now()-interval '7 days' then raise exception 'bad_sensor_time'; end if;
    insert into public.learning_sensor_events(id,academy_id,student_id,source,resource_id,snapshot_id,session_id,position,question,action,client_at,visible_ms,input_recent_ms,run_id)
      values((e->>'id')::uuid,r.academy_id,r.student_id,r.source,r.resource_id,r.snapshot_id,(e->>'session')::uuid,pos,qi,e->>'action',at_time,(e->>'visible_ms')::int,(e->>'input_recent_ms')::int,r.id) on conflict do nothing;
    get diagnostics n=row_count; accepted:=accepted+n;
  end loop;
  return jsonb_build_object('accepted',accepted,'schema_version','delivery-v1');
end $$;

create or replace function public.admin_learning_run_summary(p_days int default 7)
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if public.is_platform_admin() is distinct from true then raise exception 'forbidden'; end if;
  if p_days is null or p_days not between 1 and 90 then raise exception 'bad_days'; end if;
  return jsonb_build_object('days',p_days,'runs',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select r.source,count(distinct r.id) as runs,count(*) filter(where i.goal_id is not null) as goal_items,count(*) filter(where i.goal_id is null) as unresolved_items
    from public.learning_delivery_runs r left join public.learning_delivery_items i on i.run_id=r.id where r.created_at>=now()-make_interval(days=>p_days) group by r.source
  ) x),'evidence',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select o.source,count(*) as outcomes,count(*) filter(where l.run_id is not null) as linked,
      count(*) filter(where l.version_matches) as version_matched,count(*) filter(where l.version_matches=false) as version_changed,
      count(*) filter(where l.origin_changed) as origin_changed,
      count(*) filter(where l.run_id is null) as unlinked,count(*) filter(where l.version_matches and l.goal_id is not null) as goal_linked
    from public.learning_sensor_outcomes o left join public.learning_evidence_links l on o.evidence_id=l.source_table||':'||l.evidence_id
    where o.observed_at>=now()-make_interval(days=>p_days) group by o.source
  ) x));
end $$;
do $$ declare f text; begin
  foreach f in array array['learning_delivery_item(uuid,int,int,jsonb)','learning_delivery_record(text,uuid,uuid,uuid,jsonb,jsonb)','learning_run_authorize(uuid,text)','learning_solo_action(uuid,int,text,jsonb)','learning_capture_evidence()','learning_run_open(text,text,uuid)','learning_run_action(uuid,text,int,text,jsonb)','learning_sensor_report_run(uuid,text,jsonb)','admin_learning_run_summary(int)'] loop
    execute format('revoke all on function public.%s from public,anon,authenticated',f);
  end loop;
end $$;
grant execute on function public.learning_run_open(text,text,uuid), public.learning_run_action(uuid,text,int,text,jsonb), public.learning_sensor_report_run(uuid,text,jsonb) to anon,authenticated;
grant execute on function public.admin_learning_run_summary(int) to authenticated;
commit;
