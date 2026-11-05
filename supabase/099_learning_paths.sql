-- New individual lesson flow: teacher-approved plan -> diagnostic/learn/practice/check -> delayed checks.
-- Vocabulary recall v1. Requires 098 and existing solo helpers. No automatic new assignment.
begin;
-- Preflight: exact signatures (and return types where this layer depends on them), not just names.
-- Wrapped endpoints may already be renamed to <name>_before_paths by an earlier run of this file.
do $$ declare m text; begin
  select string_agg(x,', ') into m from (
    select t as x from unnest(array['learning_delivery_runs','learning_solo_versions','learning_delivery_items','solo_lessons','solo_assignments']) t where to_regclass('public.'||t) is null
    union all
    select r.sig||' -> '||r.ret from (values
      ('learning_run_open(text,text,uuid)','jsonb',false),('learning_run_action(uuid,text,int,text,jsonb)','jsonb',false),
      ('solo_assignment_for(uuid,uuid)','solo_assignments',false),('solo_assign(uuid,uuid[],timestamptz,text)','integer',false),
      ('solo_public_step(jsonb)','jsonb',false),('solo_correct_text(jsonb)','text',false),
      ('hw_staff_academy()','uuid',false),('academy_feature(uuid,text)','boolean',false),
      ('solo_open(uuid,uuid)','jsonb',true),('student_home(uuid)','jsonb',true),('solo_answer(uuid,uuid,int,text)','jsonb',true),
      ('solo_advance(uuid,uuid,int,boolean)','jsonb',true),('solo_reveal(uuid,uuid,int)','jsonb',true),('solo_test_submit(uuid,uuid,int,jsonb)','jsonb',true)
    ) r(sig,ret,wrapped)
    where not exists(select 1 from pg_proc p where p.oid in (
        to_regprocedure('public.'||r.sig),
        case when r.wrapped then to_regprocedure('public.'||regexp_replace(r.sig,'^(\w+)\(','\1_before_paths(')) end)
      and (r.ret='' or p.prorettype=r.ret::regtype))
  ) q;
  if m is not null then raise exception '099 requires 098 and existing solo objects with compatible signatures; missing or incompatible: %',m; end if;
end $$;

-- Compatibility boundary. 099 renames some existing endpoints to <name>_before_paths and installs thin wrappers that
-- carry the marker below. Rules, enforced by code instead of by memory:
--  * re-running this file never overwrites a function body it did not install;
--  * if a later migration replaces a wrapper with a newer body, 099 stops with an explicit error;
--  * learning_path_assert_compat() re-checks the whole boundary and is called when a teacher assigns a path.
create table if not exists public.learning_path_compat(
  fn text not null, args text not null, legacy text not null, wrapper_version text not null default 'v1',
  wrapped_at timestamptz not null default now(), primary key(fn,args));
alter table public.learning_path_compat add column if not exists wrapper_hash text;
alter table public.learning_path_compat enable row level security;
revoke all on public.learning_path_compat from public,anon,authenticated;

-- Fingerprint the installed definition, settings, security mode and owner. A marker is documentation only.
create or replace function public.learning_path_wrapper_hash(p_fn regprocedure) returns text
language sql stable set search_path=public as $$
  select md5(pg_get_functiondef(p.oid)||':'||p.proowner::text) from pg_proc p where p.oid=p_fn
$$;

create or replace function public.learning_path_wrap_legacy(p_fn text,p_args text) returns void
language plpgsql set search_path=public as $$
declare cur regprocedure:=to_regprocedure(format('public.%s(%s)',p_fn,p_args)); leg regprocedure:=to_regprocedure(format('public.%s_before_paths(%s)',p_fn,p_args)); wrapped boolean:=false; expected text;
begin
  select wrapper_hash into expected from public.learning_path_compat where fn=p_fn and args=p_args;
  if cur is not null then
    select position('learning-path-wrapper:v1' in prosrc)>0 into wrapped from pg_proc where oid=cur;
    if leg is not null and (expected is null or public.learning_path_wrapper_hash(cur) is distinct from expected) then
      raise exception 'compat_newer_function: public.%(%) has an unverified or changed definition. It was NOT overwritten. Review it, then explicitly use learning_path_adopt_legacy.',p_fn,p_args;
    end if;
  end if;
  if cur is null and leg is null then raise exception 'compat_missing_function: public.%(%)',p_fn,p_args; end if;
  if cur is not null and leg is null then
    if wrapped then raise exception 'compat_inconsistent: public.%(%) is a wrapper but public.%_before_paths does not exist',p_fn,p_args,p_fn; end if;
    execute format('alter function %s rename to %I',cur,p_fn||'_before_paths');
  elsif cur is not null and not wrapped then
    raise exception 'compat_newer_function: public.%(%) was replaced after path protection was installed. It was NOT overwritten. Review the new body, then run select public.learning_path_adopt_legacy(%L,%L) and apply 099 again.',p_fn,p_args,p_fn,p_args;
  end if;
  insert into public.learning_path_compat(fn,args,legacy) values(p_fn,p_args,p_fn||'_before_paths')
    on conflict(fn,args) do update set legacy=excluded.legacy;
end$$;

-- Explicit, operator-only step: treat the current (newer, unwrapped) public function as the new legacy behaviour.
create or replace function public.learning_path_adopt_legacy(p_fn text,p_args text) returns void
language plpgsql set search_path=public as $$
declare cur regprocedure:=to_regprocedure(format('public.%s(%s)',p_fn,p_args)); leg regprocedure:=to_regprocedure(format('public.%s_before_paths(%s)',p_fn,p_args));
begin
  if cur is null then raise exception 'compat_missing_function: public.%(%)',p_fn,p_args; end if;
  if not exists(select 1 from public.learning_path_compat where fn=p_fn and args=p_args) then raise exception 'compat_not_registered'; end if;
  if public.learning_path_wrapper_hash(cur)=(select wrapper_hash from public.learning_path_compat where fn=p_fn and args=p_args) then raise exception 'compat_already_wrapped: public.%(%)',p_fn,p_args; end if;
  if leg is not null then execute format('drop function %s',leg); end if;
  execute format('alter function %s rename to %I',cur,p_fn||'_before_paths');
  execute format('revoke all on function public.%I(%s) from public,anon,authenticated',p_fn||'_before_paths',p_args);
end$$;

create or replace function public.learning_path_compat_problems() returns text[]
language plpgsql stable security definer set search_path=public as $$
declare r public.learning_path_compat; cur regprocedure; leg regprocedure; out text[]:='{}'; src text; ret regtype;
begin
  if (select count(*) from public.learning_path_compat)<6 then out:=out||'registry_incomplete'; end if;
  for r in select * from public.learning_path_compat order by fn loop
    cur:=to_regprocedure(format('public.%s(%s)',r.fn,r.args)); leg:=to_regprocedure(format('public.%s(%s)',r.legacy,r.args));
    if cur is null then out:=out||(r.fn||':missing'); continue; end if;
    if leg is null then out:=out||(r.fn||':legacy_missing'); continue; end if;
    select prosrc,prorettype::regtype into src,ret from pg_proc where oid=cur;
    if position('learning-path-wrapper:v1' in src)=0 then out:=out||(r.fn||':wrapper_replaced'); end if;
    if r.wrapper_hash is null or public.learning_path_wrapper_hash(cur) is distinct from r.wrapper_hash then out:=out||(r.fn||':wrapper_definition_changed'); end if;
    if ret<>'jsonb'::regtype or (select prorettype from pg_proc where oid=leg)<>'jsonb'::regtype then out:=out||(r.fn||':return_type'); end if;
    if not (select prosecdef from pg_proc where oid=cur) then out:=out||(r.fn||':not_security_definer'); end if;
    if has_function_privilege('anon',leg,'EXECUTE') or has_function_privilege('authenticated',leg,'EXECUTE') then out:=out||(r.fn||':legacy_exposed'); end if;
    if not has_function_privilege('anon',cur,'EXECUTE') then out:=out||(r.fn||':wrapper_not_callable'); end if;
  end loop;
  return out;
end$$;

create or replace function public.learning_path_assert_compat() returns void
language plpgsql stable security definer set search_path=public as $$
declare p text[]:=public.learning_path_compat_problems();
begin
  if cardinality(p)>0 then raise exception 'learning_path_protection_changed: %',array_to_string(p,', '); end if;
end$$;

create table if not exists public.learning_path_plans (
  lesson_id uuid primary key references public.solo_lessons(id) on delete cascade,
  academy_id uuid not null references public.academies(id) on delete cascade,
  class_id uuid not null,
  request_id uuid not null,
  cards jsonb not null,
  practice text not null check(practice in ('recall','letters')),
  created_at timestamptz not null default now(),
  unique(academy_id,request_id)
);
create index if not exists learning_path_plan_scope_idx on public.learning_path_plans(academy_id,class_id,created_at desc);
create table if not exists public.learning_path_states (
  assignment_id uuid primary key references public.solo_assignments(id) on delete cascade,
  run_id uuid not null references public.learning_delivery_runs(id),
  goal_index int not null default 0,
  position int not null default 1,
  round int not null default 0 check(round between 0 and 2),
  helped boolean not null default false,
  revisited boolean not null default false,
  first_completed_at timestamptz,
  due_at timestamptz,
  finished_at timestamptz,
  updated_at timestamptz not null default now()
);
create table if not exists public.learning_path_checks (
  assignment_id uuid not null references public.solo_assignments(id) on delete cascade,
  goal_index int not null,
  round int not null,
  correct boolean not null,
  helped boolean not null,
  checked_at timestamptz not null default now(),
  primary key(assignment_id,goal_index,round)
);
create table if not exists public.learning_path_requests (
  id uuid primary key,
  assignment_id uuid not null references public.solo_assignments(id) on delete cascade,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create table if not exists public.learning_path_feedback_actions (
  assignment_id uuid not null references public.solo_assignments(id) on delete cascade,
  goal_index int not null,
  decision text not null check(decision in ('assigned','dismissed')),
  new_lesson_id uuid references public.solo_lessons(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key(assignment_id,goal_index)
);
do $$declare t text;begin foreach t in array array['learning_path_plans','learning_path_states','learning_path_checks','learning_path_requests','learning_path_feedback_actions'] loop
  execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);
end loop;end$$;

create or replace function public.learning_path_steps(p_cards jsonb,p_title text,p_practice text)
returns jsonb language plpgsql immutable as $$
declare steps jsonb; c jsonb; i int; practice jsonb;
begin
  steps:=jsonb_build_array(jsonb_build_object('t','intro','title',p_title,'text','뜻을 보고 단어를 떠올려 쓰고, 필요한 만큼 배우고 복습해요.','path_version','path-v1'));
  for c,i in select value,ordinality::int-1 from jsonb_array_elements(p_cards) with ordinality loop
    practice:=case when p_practice='letters' then jsonb_build_object('t','spell','word',c->>'word','meaning',c->>'meaning','letters',(select jsonb_agg(ch order by ord desc) from regexp_split_to_table(c->>'word','') with ordinality x(ch,ord)))
      else jsonb_build_object('t','typeWord','word',c->>'word','meaning',c->>'meaning','length',length(c->>'word'),'first',left(c->>'word',1)) end;
    steps:=steps||jsonb_build_array(
      jsonb_build_object('t','typeWord','word',c->>'word','meaning',c->>'meaning','length',length(c->>'word'),'first',left(c->>'word',1),'path_phase','diagnostic','goal_index',i),
      jsonb_build_object('t','meet','word',c->>'word','meaning',c->>'meaning','imageUrl',c->'imageUrl','example',c->'example','path_phase','learn','goal_index',i),
      practice||jsonb_build_object('path_phase','practice','goal_index',i),
      jsonb_build_object('t','typeWord','word',c->>'word','meaning',c->>'meaning','length',length(c->>'word'),'first',left(c->>'word',1),'path_phase','check','goal_index',i)
    );
  end loop;
  return steps;
end$$;

create or replace function public.learning_path_assign(p_request uuid,p_class uuid,p_students uuid[],p_title text,p_cards jsonb,p_practice text default 'letters')
returns jsonb language plpgsql security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy(); lesson uuid; c jsonb; cards jsonb:='[]'; count_words int; existing public.learning_path_plans; payload_hash text;
begin
  perform public.learning_path_assert_compat();
  if not public.academy_feature(ac,'solo') then raise exception 'feature_closed'; end if;
  if p_request is null or p_title is null or length(btrim(p_title)) not between 1 and 100 or p_practice not in ('recall','letters') then raise exception 'bad_plan'; end if;
  if not exists(select 1 from public.classes where id=p_class and academy_id=ac) then raise exception 'bad_class'; end if;
  if p_students is null or cardinality(p_students)=0 or exists(select 1 from unnest(p_students) sid where not exists(select 1 from public.students where id=sid and academy_id=ac and class_id=p_class and archived_at is null)) then raise exception 'bad_student'; end if;
  if jsonb_typeof(p_cards) is distinct from 'array' or jsonb_array_length(p_cards) not between 1 and 12 then raise exception 'bad_cards'; end if;
  for c in select value from jsonb_array_elements(p_cards) loop
    if coalesce(c->>'word','') !~ '^[A-Za-z][A-Za-z-]{0,39}$' or length(btrim(coalesce(c->>'meaning',''))) not between 1 and 120 then raise exception 'bad_card'; end if;
    if c->>'imageUrl' is not null and c->>'imageUrl'<>'' and c->>'imageUrl' !~ '^(/[^/]|https://)' then raise exception 'bad_image'; end if;
    cards:=cards||jsonb_build_array(jsonb_build_object('word',lower(btrim(c->>'word')),'meaning',btrim(c->>'meaning'),'imageUrl',nullif(c->>'imageUrl',''),'example',left(c->>'example',250)));
  end loop;
  if (select count(distinct (x->>'word',x->>'meaning')) from jsonb_array_elements(cards) x)<>jsonb_array_length(cards) then raise exception 'duplicate_card'; end if;
  perform pg_advisory_xact_lock(hashtext(ac::text||p_request::text));
  select * into existing from public.learning_path_plans where academy_id=ac and request_id=p_request;
  if existing.lesson_id is not null then
    if existing.cards is distinct from cards or existing.class_id<>p_class or existing.practice<>p_practice
      or (select name from public.solo_lessons where id=existing.lesson_id)<>btrim(p_title)
      or (select array_agg(student_id order by student_id) from public.solo_assignments where lesson_id=existing.lesson_id) is distinct from (select array_agg(distinct sid order by sid) from unnest(p_students) sid) then raise exception 'request_changed'; end if;
    return jsonb_build_object('lesson_id',existing.lesson_id,'duplicate',true);
  end if;
  insert into public.solo_lessons(academy_id,class_id,name,level,minutes,steps,source)
    values(ac,p_class,btrim(p_title),null,greatest(3,jsonb_array_length(cards)*2),public.learning_path_steps(cards,btrim(p_title),p_practice),'learning-path-v1') returning id into lesson;
  insert into public.learning_path_plans(lesson_id,academy_id,class_id,request_id,cards,practice) values(lesson,ac,p_class,p_request,cards,p_practice);
  perform public.solo_assign(lesson,p_students,null);
  return jsonb_build_object('lesson_id',lesson,'duplicate',false);
end$$;

create or replace function public.learning_path_payload(p_assignment uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare state public.learning_path_states; d jsonb; q jsonb; phase text; words int;
begin
  select * into state from public.learning_path_states where assignment_id=p_assignment;
  select s.definition->'grading'->'steps' into d from public.learning_delivery_runs r join public.learning_sensor_snapshots s on s.id=r.snapshot_id where r.id=state.run_id;
  words:=(jsonb_array_length(d)-1)/4;
  q:=d->state.position;
  phase:=case when state.round>0 then 'delayed_check' else q->>'path_phase' end;
  return jsonb_build_object('run_id',state.run_id,'position',state.position,'goal_index',state.goal_index,'words',words,'round',state.round,
    'phase',phase,'waiting',coalesce(state.due_at>now(),false),'due_at',state.due_at,'finished',state.finished_at is not null,
    'step',case when state.finished_at is null and (state.due_at is null or state.due_at<=now()) then public.solo_public_step(q)-'first' end,
    'hint',case when state.helped then left(q->>'word',1) end);
end$$;

create or replace function public.learning_path_open(p_token uuid,p_assignment uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.solo_assignments; receipt jsonb;
begin
  a:=public.solo_assignment_for(p_token,p_assignment);
  if not exists(select 1 from public.learning_path_plans where lesson_id=a.lesson_id) then raise exception 'not_found'; end if;
  perform 1 from public.solo_assignments where id=a.id for update;
  receipt:=public.learning_run_open('solo',p_token::text,a.id);
  insert into public.learning_path_states(assignment_id,run_id) values(a.id,(receipt->>'sensor_run_id')::uuid)
    on conflict(assignment_id) do update set run_id=excluded.run_id;
  return public.learning_path_payload(a.id);
end$$;

create or replace function public.learning_path_action(p_token uuid,p_assignment uuid,p_request uuid,p_position int,p_action text,p_value text default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare a public.solo_assignments; state public.learning_path_states; prev public.learning_path_requests; d jsonb; q jsonb; phase text; result jsonb; feedback jsonb; hash text; ok boolean; words int; g int; pos int; next_round int; old_context text;
begin
  a:=public.solo_assignment_for(p_token,p_assignment);
  -- Same lock order as learning_path_open: assignment first, then state (avoids deadlock).
  perform 1 from public.solo_assignments where id=a.id for update;
  select * into state from public.learning_path_states where assignment_id=a.id for update;
  if state.assignment_id is null or p_request is null then raise exception 'not_found'; end if;
  hash:=md5(jsonb_build_array(p_position,p_action,p_value)::text);
  select * into prev from public.learning_path_requests where id=p_request;
  if prev.id is not null then
    if prev.assignment_id<>a.id or prev.request_hash<>hash then raise exception 'bad_request'; end if;
    return prev.result;
  end if;
  if p_position is distinct from state.position or state.finished_at is not null then raise exception 'path_changed'; end if;
  if state.due_at>now() then raise exception 'not_due'; end if;
  select s.definition->'grading'->'steps' into d from public.learning_delivery_runs r join public.learning_sensor_snapshots s on s.id=r.snapshot_id where r.id=state.run_id;
  q:=d->state.position; words:=(jsonb_array_length(d)-1)/4;
  phase:=case when state.round>0 then 'delayed_check' else q->>'path_phase' end;
  if p_action='hint' then
    if phase<>'practice' then raise exception 'hint_not_available'; end if;
    update public.learning_path_states set helped=true where assignment_id=a.id;
    result:=jsonb_build_object('state',public.learning_path_payload(a.id));
  elsif phase='learn' and p_action='continue' then
    update public.learning_path_states set position=position+1,helped=false,updated_at=now() where assignment_id=a.id;
    result:=jsonb_build_object('state',public.learning_path_payload(a.id));
  elsif phase in ('diagnostic','practice','check','delayed_check') and p_action in ('answer','unknown') then
    if p_value is not null and length(p_value)>300 then raise exception 'bad_answer'; end if;
    old_context:=current_setting('app.learning_path_context',true);
    perform set_config('app.learning_path_context',jsonb_build_object('assignment',a.id,'position',state.position)::text,true);
    result:=public.learning_run_action(state.run_id,p_token::text,state.position,'answer',jsonb_build_object('value',case when p_action='unknown' then '' else coalesce(p_value,'') end));
    perform set_config('app.learning_path_context',coalesce(old_context,''),true);
    ok:=coalesce((result->>'correct')::boolean,false);
    feedback:=jsonb_build_object('phase',phase,'correct',ok,'answer',case when phase<>'diagnostic' then public.solo_correct_text(q) end);
    if phase='diagnostic' then
      pos:=state.position+case when ok then 3 else 1 end;
      update public.learning_path_states set position=pos,helped=false,updated_at=now() where assignment_id=a.id;
    elsif phase='practice' then
      update public.learning_path_states set position=position+1,helped=false,updated_at=now() where assignment_id=a.id;
    elsif phase='check' and not ok and not state.revisited then
      update public.learning_path_states set position=1+state.goal_index*4+1,revisited=true,helped=false,updated_at=now() where assignment_id=a.id;
    else
      insert into public.learning_path_checks(assignment_id,goal_index,round,correct,helped) values(a.id,state.goal_index,state.round,ok,state.helped);
      g:=state.goal_index+1; next_round:=state.round;
      if g<words then
        pos:=g*4+case when state.round=0 then 1 else 4 end;
        update public.learning_path_states set goal_index=g,position=pos,revisited=false,helped=false,updated_at=now() where assignment_id=a.id;
      elsif state.round<2 then
        next_round:=state.round+1;
        update public.learning_path_states set goal_index=0,position=4,round=next_round,revisited=false,helped=false,
          first_completed_at=coalesce(first_completed_at,now()),due_at=case when next_round=1 then now()+interval '1 day' else greatest(coalesce(first_completed_at,now())+interval '7 days',now()+interval '1 day') end,updated_at=now() where assignment_id=a.id;
      else
        update public.learning_path_states set finished_at=now(),updated_at=now() where assignment_id=a.id;
        update public.solo_assignments set finished_at=coalesce(finished_at,now()),progress=jsonb_array_length(d) where id=a.id;
      end if;
    end if;
    result:=jsonb_build_object('state',public.learning_path_payload(a.id),'feedback',feedback);
  else raise exception 'bad_path_action'; end if;
  insert into public.learning_path_requests(id,assignment_id,request_hash,result) values(p_request,a.id,hash,result);
  return result;
end$$;

create or replace function public.learning_path_teacher_summary(p_class uuid)
returns jsonb language plpgsql stable security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy();
begin
  if not exists(select 1 from public.classes where id=p_class and academy_id=ac) then raise exception 'not_found'; end if;
  return jsonb_build_object('protection',to_jsonb(public.learning_path_compat_problems()),'plans',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select p.lesson_id,l.name,p.practice,jsonb_array_length(p.cards) as words,p.created_at,
      (select count(*) from public.solo_assignments a where a.lesson_id=p.lesson_id) as assigned,
      (select count(*) from public.solo_assignments a join public.learning_path_states s on s.assignment_id=a.id where a.lesson_id=p.lesson_id and s.first_completed_at is not null) as first_completed,
      (select count(*) from public.solo_assignments a join public.learning_path_checks c on c.assignment_id=a.id where a.lesson_id=p.lesson_id and c.round>0) as delayed_checked,
      (select count(*) from public.solo_assignments a join public.learning_path_checks c on c.assignment_id=a.id where a.lesson_id=p.lesson_id and c.round>0 and c.correct) as delayed_correct,
      (select count(*)*jsonb_array_length(p.cards)*2 from public.solo_assignments a where a.lesson_id=p.lesson_id) as delayed_planned
    from public.learning_path_plans p join public.solo_lessons l on l.id=p.lesson_id where p.academy_id=ac and p.class_id=p_class order by p.created_at desc
  )x),'recommendations',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (
    select a.id as assignment_id,a.student_id,s.name as student_name,c.goal_index,p.cards->c.goal_index as card,
      count(*) filter(where not c.correct) as failed_checks,count(*) filter(where c.round>0) as delayed_checks
    from public.learning_path_checks c join public.solo_assignments a on a.id=c.assignment_id join public.students s on s.id=a.student_id
      join public.learning_path_plans p on p.lesson_id=a.lesson_id
    where p.academy_id=ac and p.class_id=p_class and not exists(select 1 from public.learning_path_feedback_actions f where f.assignment_id=a.id and f.goal_index=c.goal_index)
    group by a.id,a.student_id,s.name,c.goal_index,p.cards having count(*) filter(where not c.correct)>0 limit 100
  )x));
end$$;

create or replace function public.learning_path_feedback(p_assignment uuid,p_goal int,p_decision text,p_request uuid,p_practice text default 'recall')
returns jsonb language plpgsql security definer set search_path=public as $$
declare ac uuid:=public.hw_staff_academy(); plan public.learning_path_plans; a public.solo_assignments; card jsonb; result jsonb; old public.learning_path_feedback_actions;
begin
  select * into a from public.solo_assignments where id=p_assignment and academy_id=ac for update;
  select * into plan from public.learning_path_plans where lesson_id=a.lesson_id;
  card:=plan.cards->p_goal;
  if a.id is null or card is null or p_decision not in ('assigned','dismissed') or not exists(select 1 from public.learning_path_checks where assignment_id=a.id and goal_index=p_goal and not correct) then raise exception 'not_found'; end if;
  select * into old from public.learning_path_feedback_actions where assignment_id=a.id and goal_index=p_goal;
  if old.assignment_id is not null then return jsonb_build_object('decision',old.decision,'lesson_id',old.new_lesson_id,'duplicate',true); end if;
  if p_decision='assigned' then
    result:=public.learning_path_assign(p_request,plan.class_id,array[a.student_id],'짧은 단어 회상 복습',jsonb_build_array(card),p_practice);
  end if;
  insert into public.learning_path_feedback_actions(assignment_id,goal_index,decision,new_lesson_id) values(a.id,p_goal,p_decision,(result->>'lesson_id')::uuid);
  return jsonb_build_object('decision',p_decision,'lesson_id',result->>'lesson_id');
end$$;
do $$declare f text;begin foreach f in array array['learning_path_steps(jsonb,text,text)','learning_path_payload(uuid)','learning_path_assign(uuid,uuid,uuid[],text,jsonb,text)','learning_path_open(uuid,uuid)','learning_path_action(uuid,uuid,uuid,int,text,text)','learning_path_teacher_summary(uuid)','learning_path_feedback(uuid,int,text,uuid,text)','learning_path_wrapper_hash(regprocedure)','learning_path_wrap_legacy(text,text)','learning_path_adopt_legacy(text,text)','learning_path_compat_problems()','learning_path_assert_compat()'] loop
  execute format('revoke all on function public.%s from public,anon,authenticated',f);
end loop;end$$;
grant execute on function public.learning_path_assign(uuid,uuid,uuid[],text,jsonb,text),public.learning_path_teacher_summary(uuid),public.learning_path_feedback(uuid,int,text,uuid,text) to authenticated;
grant execute on function public.learning_path_open(uuid,uuid),public.learning_path_action(uuid,uuid,uuid,int,text,text) to anon,authenticated;
-- Recognize the new plan independently of the optional telemetry flag.
select public.learning_path_wrap_legacy('solo_open','uuid,uuid');
create or replace function public.solo_open(p_token uuid,p_assignment uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
-- learning-path-wrapper:v1
declare result jsonb; frozen jsonb; a public.solo_assignments;
begin
  a:=public.solo_assignment_for(p_token,p_assignment);
  result:=public.solo_open_before_paths(p_token,p_assignment);
  if exists(select 1 from public.learning_path_plans where lesson_id=a.lesson_id) then
    -- Only the launch marker leaves this endpoint. Future teaching cards contain answers and must not
    -- be downloadable before the diagnostic. The state endpoint returns only the current problem.
    return result||jsonb_build_object('learning_path',true,'steps',jsonb_build_array(jsonb_build_object('t','intro','path_version','path-v1','title',result->>'name','text','')));
  end if;
  return result;
end$$;
revoke all on function public.solo_open_before_paths(uuid,uuid),public.solo_open(uuid,uuid) from public,anon,authenticated;
grant execute on function public.solo_open(uuid,uuid) to anon,authenticated;
-- Portal distinguishes waiting-for-review from unfinished initial learning.
select public.learning_path_wrap_legacy('student_home','uuid');
create or replace function public.student_home(p_token uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
-- learning-path-wrapper:v1
declare result jsonb; lessons jsonb;
begin
  result:=public.student_home_before_paths(p_token);
  if result ? 'error' then return result; end if;
  select coalesce(jsonb_agg(x.item||case when p.lesson_id is not null then jsonb_build_object(
    'learning_path',true,'path_waiting',coalesce(s.due_at>now(),false),'path_due_at',s.due_at,
    'path_first_completed',s.first_completed_at is not null,'path_round',coalesce(s.round,0)) else '{}'::jsonb end order by x.n),'[]') into lessons
    from jsonb_array_elements(coalesce(result->'lessons','[]')) with ordinality x(item,n)
    left join public.solo_assignments a on a.id=(x.item->>'id')::uuid
    left join public.learning_path_plans p on p.lesson_id=a.lesson_id
    left join public.learning_path_states s on s.assignment_id=a.id;
  return result||jsonb_build_object('lessons',lessons);
end$$;
revoke all on function public.student_home_before_paths(uuid),public.student_home(uuid) from public,anon,authenticated;
grant execute on function public.student_home(uuid) to anon,authenticated;
-- Legacy endpoints must not bypass the new path's diagnostic order or delayed-check gate.
select public.learning_path_wrap_legacy('solo_answer','uuid,uuid,int,text');
select public.learning_path_wrap_legacy('solo_advance','uuid,uuid,int,boolean');
select public.learning_path_wrap_legacy('solo_reveal','uuid,uuid,int');
select public.learning_path_wrap_legacy('solo_test_submit','uuid,uuid,int,jsonb');
create or replace function public.solo_answer(p_token uuid,p_assignment uuid,p_step int,p_value text) returns jsonb language plpgsql security definer set search_path=public as $$
-- learning-path-wrapper:v1
declare a public.solo_assignments;begin a:=public.solo_assignment_for(p_token,p_assignment);if exists(select 1 from public.learning_path_plans where lesson_id=a.lesson_id)then raise exception 'use_path_flow';end if;return public.solo_answer_before_paths(p_token,p_assignment,p_step,p_value);end$$;
create or replace function public.solo_advance(p_token uuid,p_assignment uuid,p_step int,p_unsure boolean default false) returns jsonb language plpgsql security definer set search_path=public as $$
-- learning-path-wrapper:v1
declare a public.solo_assignments;begin a:=public.solo_assignment_for(p_token,p_assignment);if exists(select 1 from public.learning_path_plans where lesson_id=a.lesson_id)then raise exception 'use_path_flow';end if;return public.solo_advance_before_paths(p_token,p_assignment,p_step,p_unsure);end$$;
create or replace function public.solo_reveal(p_token uuid,p_assignment uuid,p_step int) returns jsonb language plpgsql security definer set search_path=public as $$
-- learning-path-wrapper:v1
declare a public.solo_assignments;begin a:=public.solo_assignment_for(p_token,p_assignment);if exists(select 1 from public.learning_path_plans where lesson_id=a.lesson_id)then raise exception 'use_path_flow';end if;return public.solo_reveal_before_paths(p_token,p_assignment,p_step);end$$;
create or replace function public.solo_test_submit(p_token uuid,p_assignment uuid,p_step int,p_answers jsonb) returns jsonb language plpgsql security definer set search_path=public as $$
-- learning-path-wrapper:v1
declare a public.solo_assignments;begin a:=public.solo_assignment_for(p_token,p_assignment);if exists(select 1 from public.learning_path_plans where lesson_id=a.lesson_id)then raise exception 'use_path_flow';end if;return public.solo_test_submit_before_paths(p_token,p_assignment,p_step,p_answers);end$$;
revoke all on function public.solo_answer_before_paths(uuid,uuid,int,text),public.solo_advance_before_paths(uuid,uuid,int,boolean),public.solo_reveal_before_paths(uuid,uuid,int),public.solo_test_submit_before_paths(uuid,uuid,int,jsonb) from public,anon,authenticated;
revoke all on function public.solo_answer(uuid,uuid,int,text),public.solo_advance(uuid,uuid,int,boolean),public.solo_reveal(uuid,uuid,int),public.solo_test_submit(uuid,uuid,int,jsonb) from public,anon,authenticated;
grant execute on function public.solo_answer(uuid,uuid,int,text),public.solo_advance(uuid,uuid,int,boolean),public.solo_reveal(uuid,uuid,int),public.solo_test_submit(uuid,uuid,int,jsonb) to anon,authenticated;
-- All existing wrappers were verified BEFORE replacement. Only now register definitions installed by this migration.
update public.learning_path_compat set wrapper_hash=public.learning_path_wrapper_hash(to_regprocedure(format('public.%s(%s)',fn,args)));
-- Fail the whole migration (rolled back) if the boundary is not intact.
select public.learning_path_assert_compat();
commit;
